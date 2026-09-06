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
/** 最长重复单元（字符）：超过这个长度的重复基本不可能出现在正常口语 */
const MAX_UNIT = 40;
/** 连续重复次数门槛 */
const MIN_TIMES = 4;
/** 只看末尾这么长：复读必然表现在尾部，全串扫描是浪费 */
const TAIL_WINDOW = 320;

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
    // 尾部窗口必须容得下 MIN_TIMES 个完整单元，否则不算
    if (n - L * MIN_TIMES < windowStart) {
      continue;
    }
    const unit = text.slice(n - L, n);
    let times = 0;
    let pos = n;
    while (pos - L >= windowStart && text.slice(pos - L, pos) === unit) {
      times += 1;
      pos -= L;
    }
    if (times >= MIN_TIMES) {
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
