/**
 * repetitionGuard — 流式生成的退化复读检测（纯函数，零依赖可单测）。
 *
 * 为什么必须有：管家（MiniCPM-1B）闲聊路径此前**没有任何复读防线**——同文件的
 * 生图扩写路径有 `temperature: 0.4`（注释就写着"低温抑制复读"）加 `isParrotingExample`
 * 闸，而闲聊路径是 `temperature: 0.7 / n_predict: 512` 裸奔。真机翻车实录
 * （2026-09-07 aab688d9）：一句「我想。」换来
 * 「您想先写什么？您想先写什么？…」连复 20+ 遍、716 字、25.9s 才生成完，
 * 电话里用户会听到同一句话重复几十遍。
 *
 * 口径与取舍：
 * - 判据是「**末尾同一子串连续完整重复 ≥ MIN_TIMES 次**」，不是词频/相似度——
 *   退化循环的形态就是这个，判据越具体越不会误伤正常排比。
 * - `MIN_TIMES = 4` 是刻意取高：真复读动辄几十次，4 次足够早停（省掉 ~20s），
 *   同时给正常口语的三连（"好的好的好的"）留出余量。
 * - **命中即早停，不事后大段删**：`cutAt` 保留**第一次**重复内容，
 *   后续复读整段丢弃——宁可少说，不可复读。
 * - 只判定不决策：是否中断生成、如何提示，由调用方（promptWriter）负责。
 */

export interface RepetitionVerdict {
  /** 是否已判定为退化复读 */
  hit: boolean;
  /**
   * 安全截断点：`text.slice(0, cutAt)` 保留第一份重复、丢弃其余。
   * 未命中时等于文本长度。
   */
  cutAt: number;
  /** 命中的重复单元（留痕用） */
  unit: string;
  /** 连续重复次数 */
  times: number;
}

/** 最短重复单元（字符）：低于此长度的重复按排比/语气词处理，不算退化 */
const MIN_UNIT = 4;
/**
 * 最长重复单元（字符）。
 *
 * 旧值 40 的注释断言「超过这个长度的重复基本不可能出现在正常口语」——已被真机实测推翻：
 * 2026-09-09 aab688d9 一条 `[kg:memory] …` 泄漏复读的**周期是 46 字符**，刚好落在 40 之外，
 * 守卫在 4..40 区间内找不到任何候选（实测 best=null），于是 759 字的复读一路跑到底。
 */
const MAX_UNIT = 200;
/** 短单元（≤ SHORT_UNIT_CEILING）门槛：沿用旧行为，不动旧已验证面。 */
const MIN_TIMES = 4;
/** 短/长单元分界：此长度以下维持「4 次即判」的旧口径。 */
const SHORT_UNIT_CEILING = 40;
/**
 * 长单元门槛（> SHORT_UNIT_CEILING 时适用）——为什么不能跟短单元同为一个 4：
 *
 * 把 MAX_UNIT 从 40 抬到 200 的同一刻，就新开了一个误杀面：实测（流式每 24 字检一次）
 * 一行 47 字的 markdown 表格行逐字重复 4 遍，**旧参数不中、新参数中**，直接 drop 1042 字
 * 并中断生成。模型复述同一行长内容（表格行/列表项/代码模板）是可预期的正常输出，
 * 不是退化。上一版注释写的「拉长单元不会增加误伤……正常文本不可能命中」是被自己的
 * 代码推翻的断言（现按实测改正）。
 *
 * 取 6 的理由：真机那条泄漏复读实测重复了 **6 遍**（见 regression 用例），所以提门槛到 6
 * 仍能拦住血证案例；而「同一段 >40 字文本逐字出现 5 遍」在正常回答里已属罕见。
 * 方向是拦真退化 + 不拦长复述，而不是把 MAX_UNIT 调回 40（那会退回原漏检）。
 */
const LONG_UNIT_MIN_TIMES = 6;
/**
 * 只看末尾这么长：复读必然表现在尾部，全串扫描是浪费。
 *
 * 🔴 下限约束（两条，缺一则守卫静默失效）：
 *   TAIL_WINDOW ≥ MAX_UNIT * LONG_UNIT_MIN_TIMES
 * 旧注释只写了 `MAX_UNIT * MIN_TIMES`，而门槛按长度分档后必须按**最大门槛**算；
 * 否则 `L` 大的候选会在 `n - L * threshold < windowStart` 处被一路 `continue` 静默跳过——
 * 就是本文件刚修掉的那个病（当时 46 字周期因 MAX_UNIT=40 面看不见）的同类复发。
 * 该不变式由 `REPETITION_GUARD_PARAMS` 导出并在单测直接断言，不再靠人算。
 */
const TAIL_WINDOW = 1200;

/**
 * 阈值与窗口常量对外自证面：专供单测卡不变式。
 * 不导出则测试只能靠硬编码样本长度卡线（旧版就是靠 199 字卡线，刚好中上而无式子保护）。
 */
export const REPETITION_GUARD_PARAMS = Object.freeze({
  MIN_UNIT,
  MAX_UNIT,
  MIN_TIMES,
  LONG_UNIT_MIN_TIMES,
  SHORT_UNIT_CEILING,
  TAIL_WINDOW,
});

/** 按单元长度取门槛：短单元维持旧口径，长单元要更多遍才算退化。 */
function minTimesFor(unitLen: number): number {
  return unitLen > SHORT_UNIT_CEILING ? LONG_UNIT_MIN_TIMES : MIN_TIMES;
}

const miss = (len: number): RepetitionVerdict => ({
  hit: false,
  cutAt: len,
  unit: '',
  times: 0,
});

export function detectRepetitionLoop(text: string): RepetitionVerdict {
  const n = text.length;
  if (n < MIN_UNIT * MIN_TIMES) {
    return miss(n);
  }
  const windowStart = Math.max(0, n - TAIL_WINDOW);
  let best = miss(n);

  for (let L = MIN_UNIT; L <= MAX_UNIT; L += 1) {
    const threshold = minTimesFor(L);
    // 尾部窗口必须容得下 threshold 个完整单元，否则不算
    if (n - L * threshold < windowStart) {
      continue;
    }
    const unit = text.slice(n - L, n);
    let times = 0;
    let pos = n;
    while (pos - L >= windowStart && text.slice(pos - L, pos) === unit) {
      times += 1;
      pos -= L;
    }
    if (times >= threshold) {
      const span = times * L;
      if (span > best.times * best.unit.length) {
        best = {
          hit: true,
          // 保留第一份重复：pos 是整段重复的起点，+L 即跳过第一次
          cutAt: pos + L,
          unit,
          times,
        };
      }
    }
  }
  return best;
}

/**
 * 节流判定：流式回调整字符数递增，没必要每个 token 都扫一遍。
 * 返回 true 表示本次应当执行检测。
 */
export function shouldCheckRepetition(prevCheckedLen: number, curLen: number) {
  return curLen - prevCheckedLen >= 24;
}
