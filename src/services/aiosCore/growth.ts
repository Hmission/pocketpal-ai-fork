/**
 * growth — 生长器官（AIOS_CORE_SPEC Wave D）：三问迭代账本 + gap 清单 + 情绪台账
 *
 * 母仓协议：NV_YAO_GROWTH_ITERATION_SSOT（inspect→plan→upgrade→reflect 四拍）。
 * 端侧形态：全部落共享存储（AIOS_GROWTH_DIR / AIOS_LOGS_DIR），与 App 核心解耦——
 * 卸载重装不丢，wakeCheck 重新认领后继续长。
 *
 * **2026-09-08 注释对齐代码实况（G0-4）**：母仓四拍 = 端侧三问 jsonl，母仓自身
 * 的 growth_iteration.py 也是不调 LLM 的骨架版——端侧三问已对齐母仓实际水位。
 * plan/upgrade 拍 = 待有消费方再加（非缺失，是锋利设计）。
 *
 * 反射三问（母仓 reflect 拍端侧化）：
 * ① saw：本轮是否看到了上一轮看不到的东西？
 * ② noise：是否有演化噪音在作祟？（讨好/过度谨慎/装成熟/交作业）
 * ③ nextFocus：下一轮该审视什么？
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {emit} from '../../debug/eventStream';
import {AIOS_GROWTH_DIR, AIOS_LOGS_DIR} from '../../utils/paths';

export interface IterationRecord {
  /** 迭代日期 YYYY-MM-DD */
  date: string;
  /** 今日摘要（收尾小结前 200 字，真内容非模板） */
  saw: string;
  /** reflect ②：演化噪音识别（空串 = 未察觉） */
  noise?: string;
  /** reflect ③：下轮审视方向（空串 = 待定） */
  nextFocus?: string;
  /** 上游事件源：closing（收尾）/ manual（手动） */
  source: 'closing' | 'manual';
  ts: string;
}

export interface EmotionRecord {
  ts: string;
  score: number;
  label: string;
  source: 'trackSentiment' | 'closing' | 'manual';
}

const ITERATIONS_FILE = `${AIOS_GROWTH_DIR}/iterations.jsonl`;
const EMOTION_FILE_PREFIX = `${AIOS_LOGS_DIR}/emotion_`;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function appendJsonl(file: string, record: unknown): Promise<void> {
  try {
    await RNFS.appendFile(file, JSON.stringify(record) + '\n', 'utf8');
  } catch (e) {
    console.warn('[growth] append failed:', file, e);
  }
}

/**
 * 追加一行生长迭代账本（reflect 三问落成文件）。
 * 账本即身份骨节——连续记录 = 连续生长；失败静默（不阻塞收尾主链）。
 */
export async function appendIteration(
  record: Omit<IterationRecord, 'date' | 'ts'>,
): Promise<void> {
  const full: IterationRecord = {
    date: todayStr(),
    ts: new Date().toISOString(),
    ...record,
  };
  await appendJsonl(ITERATIONS_FILE, full);
  emit('app', 'growth.iteration', {date: full.date, source: full.source});
}

/**
 * 写当日 gap 清单（inspect 产出，AIOS_CORE_SPEC §三）。
 * 以日期为文件名天然轮转（文件即过期公理）：今天没写就没有。
 * content 空 → 显式拒绝写（宁缺勿滥，不写空壳模板）。
 */
export async function writeGap(content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }
  const dateStr = todayStr();
  try {
    const file = `${AIOS_GROWTH_DIR}/gap_${dateStr}.md`;
    if (await RNFS.exists(file)) {
      return; // 当日已写过，不覆盖（day 一次）
    }
    await RNFS.writeFile(file, `# ${dateStr} · 审视\n\n${trimmed}\n`, 'utf8');
    console.log('[growth] gap flushed:', file);
  } catch (e) {
    console.warn('[growth] writeGap failed:', e);
  }
}

/**
 * 追加情绪台账（母仓 kal_inner_life/emotion_*.jsonl 同构，日志面）。
 * 保留既有 sentiment.json 单条（规则版状态展示 E 用），此台账做长线积累。
 * 按日分文件：emotion_YYYYMMDD.jsonl。
 */
export async function appendEmotion(
  record: Omit<EmotionRecord, 'ts'>,
): Promise<void> {
  const full: EmotionRecord = {
    ts: new Date().toISOString(),
    ...record,
  };
  await appendJsonl(`${EMOTION_FILE_PREFIX}${todayStr()}.jsonl`, full);
  emit('app', 'growth.emotion', {score: full.score, source: full.source});
}

/** 读取指定日期的情绪台账（新→旧）；缺失返回空数组 */
export async function readEmotions(date: string): Promise<EmotionRecord[]> {
  try {
    const file = `${EMOTION_FILE_PREFIX}${date}.jsonl`;
    if (!(await RNFS.exists(file))) {
      return [];
    }
    const raw = await RNFS.readFile(file, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line) as EmotionRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is EmotionRecord => r !== null)
      .reverse();
  } catch {
    return [];
  }
}

/** 读取截至今日的迭代账本（新→旧）；缺失返回空数组 */
export async function readIterations(): Promise<IterationRecord[]> {
  try {
    if (!(await RNFS.exists(ITERATIONS_FILE))) {
      return [];
    }
    const raw = await RNFS.readFile(ITERATIONS_FILE, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line) as IterationRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is IterationRecord => r !== null)
      .reverse();
  } catch {
    return [];
  }
}
