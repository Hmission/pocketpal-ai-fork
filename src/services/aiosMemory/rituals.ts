/**
 * 智能体仪式（P4 · 轻量规则版）
 *
 * 四件套（手机端 4B 模型友好，全部规则化/轻量）：
 * 1. 开场仪式：启动/首轮注入"今日状态"（日期 + 上次对话摘要 + 距上次多久）
 * 2. 意图状态机：规则分类（闲聊/倾诉/问答/任务），system 层注入语气指令
 * 3. 收尾协议：当日对话超阈值后触发一次"今日小结"落盘 memory/（防长对话漂移）
 * 4. 自检开关：uiStore 控制；开启时重要回复跑两遍（生成→自检→修正）
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  AIOS_WORKSPACE_MEMORY_DIR,
  AIOS_MEMORIES_DIR,
  AIOS_OPENING_DIR,
  AIOS_DIARY_DIR,
} from '../../utils/paths';
import {readSummary} from './compaction';
import {modelStore} from '../../store';

// 情绪持久化文件（trackSentiment 落盘 → buildTodayState 读昨日情绪）
const SENTIMENT_FILE = `${AIOS_MEMORIES_DIR}/sentiment.json`;

interface SentimentRecord {
  score: number;
  label: string;
  ts: string; // ISO date string (YYYY-MM-DD)
}

// ─── 1. 开场仪式 ─────────────────────────────────────────────
/**
 * 组装"今日状态"片段：日期 + 上次对话摘要 + 距离上次对话多久。
 * 首轮注入 system 层，让女妖主动有"今天又见到大王"的感知。
 */
export async function buildTodayState(): Promise<string> {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

    // 上次摘要（昨天或更早最后一条）
    let lastSummary = '';
    try {
      if (await RNFS.exists(AIOS_WORKSPACE_MEMORY_DIR)) {
        const files = (await RNFS.readDir(AIOS_WORKSPACE_MEMORY_DIR))
          .filter(f => f.name.endsWith('.md'))
          .sort()
          .reverse();
        for (const f of files) {
          const date = f.name.replace('.md', '');
          if (date < dateStr) {
            lastSummary = (await readSummary(date)).slice(0, 300);
            break;
          }
        }
      }
    } catch {
      // ignore
    }

    const parts = [`【今日状态】${dateStr} 星期${weekday} ${timeStr}`];
    if (lastSummary) {
      parts.push(`上次对话摘要：${lastSummary.trim().slice(0, 200)}`);
    } else {
      parts.push('这是和女妖的首次对话。');
    }
    // 情绪持久化：读昨日情绪，让女妖感知大王情绪延续
    const lastSentiment = await readLastSentiment();
    if (lastSentiment && lastSentiment.ts < dateStr) {
      parts.push(`上次大王情绪：${lastSentiment.label}（${lastSentiment.score > 0 ? '积极' : lastSentiment.score < 0 ? '消极' : '平稳'}）`);
    }
    // 内心生活（P9，INNERLIFE_SPEC §2.1）：收尾预写的明日晨间独白 → 今日注入。
    // 文件即过期：opening/今日.md 存在才有独白；缺失回退规则版（无兜底）。
    const opening = await readTodayOpening(dateStr);
    if (opening) {
      parts.push(`【女妖晨间独白】${opening}`);
    } else {
      parts.push('开场请自然问候大王（一两句即可，不必长篇）。');
    }
    return parts.join('\n');
  } catch {
    return '';
  }
}

/** 读取今日晨间独白（opening/YYYY-MM-DD.md）；缺失返回 null */
async function readTodayOpening(dateStr: string): Promise<string | null> {
  try {
    const path = `${AIOS_OPENING_DIR}/${dateStr}.md`;
    if (!(await RNFS.exists(path))) {
      return null;
    }
    const raw = (await RNFS.readFile(path, 'utf8')).trim();
    return raw.length > 0 ? raw.slice(0, 200) : null;
  } catch {
    return null;
  }
}

// ─── 2. 意图状态机 ───────────────────────────────────────────
export type IntentKind = 'chat' | 'vent' | 'qa' | 'task';

// M7 情绪系统：规则词库情感打分（-2..+2），供开场仪式/状态展示用
const POSITIVE_MARKERS = ['开心', '高兴', '棒', '太好了', '喜欢', '爱', '成功', '完成', '中奖', '幸运'];
const NEGATIVE_MARKERS = ['烦', '难过', '伤心', '生气', '累', '压力', '焦虑', '失眠', '崩溃', '委屈', '孤独', '沮丧', '失望', '失败', '讨厌'];

export function sentimentScore(text: string): number {
  let score = 0;
  for (const m of POSITIVE_MARKERS) {
    if (text.includes(m)) score += 1;
  }
  for (const m of NEGATIVE_MARKERS) {
    if (text.includes(m)) score -= 1;
  }
  return Math.max(-2, Math.min(2, score));
}

let _lastSentiment = 0;

export function trackSentiment(userText: string): void {
  _lastSentiment = sentimentScore(userText);
  // 情绪持久化：落盘到 sentiment.json（重启后 buildTodayState 可读昨日情绪）
  const today = new Date().toISOString().slice(0, 10);
  const record: SentimentRecord = {
    score: _lastSentiment,
    label: _lastSentiment > 0 ? '愉悦' : _lastSentiment < 0 ? '低落' : '平稳',
    ts: today,
  };
  RNFS.writeFile(SENTIMENT_FILE, JSON.stringify(record), 'utf8').catch(() => {
    // fire-and-forget，写入失败不影响主流程
  });
}

/** 读取最近的情绪记录（供 buildTodayState 读取昨日情绪用） */
async function readLastSentiment(): Promise<SentimentRecord | null> {
  try {
    if (await RNFS.exists(SENTIMENT_FILE)) {
      const raw = await RNFS.readFile(SENTIMENT_FILE, 'utf8');
      return JSON.parse(raw) as SentimentRecord;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 最近情绪（供 TurnMetricsRow 等展示，B18 §17） */
export function getLastSentiment(): {score: number; label: string} {
  const label =
    _lastSentiment > 0 ? '愉悦' : _lastSentiment < 0 ? '低落' : '平稳';
  return {score: _lastSentiment, label};
}

const VENT_MARKERS = [
  '烦', '难过', '伤心', '生气', '累', '压力', '焦虑', '失眠', '哭', '讨厌',
  '想死', '崩溃', '委屈', '孤独', '沮丧', '失望',
];
const TASK_MARKERS = [
  '帮我', '给我', '写', '总结', '列出', '规划', '安排', '提醒', '翻译',
  '计算', '查一下', '生成', '设计', '制作',
];
const QA_MARKERS = ['?', '？', '什么', '为什么', '怎么', '哪', '谁', '几', '多少', '是不是', '吗'];

/**
 * 规则分类意图。4B 小模型跑不动意图分类模型，用关键词+句式规则（零成本）。
 */
export function classifyIntent(userText: string): IntentKind {
  const text = userText.trim();
  if (!text) {
    return 'chat';
  }
  if (VENT_MARKERS.some(m => text.includes(m))) {
    return 'vent';
  }
  if (TASK_MARKERS.some(m => text.includes(m))) {
    return 'task';
  }
  if (QA_MARKERS.some(m => text.includes(m))) {
    return 'qa';
  }
  return 'chat';
}

const INTENT_GUIDANCE: Record<IntentKind, string> = {
  chat: '【当前状态：闲聊】轻松自然，简短俏皮，像老朋友一样。',
  vent: '【当前状态：倾诉】大王在倾诉情绪，先共情再回应，语气温柔，少讲道理多陪伴。',
  qa: '【当前状态：问答】直接给出准确回答，不确定就直说，不装懂。',
  task: '【当前状态：任务】把任务拆解清楚再动手，需要工具就调用工具，完成要汇报结果。',
};

export function intentGuidance(intent: IntentKind): string {
  return INTENT_GUIDANCE[intent];
}

// ─── 3. 收尾协议 ─────────────────────────────────────────────
const CLOSING_THRESHOLD = 15; // 当日对话超过该轮数后触发一次小结
let closingTriggeredForDate = '';

const CLOSING_SYSTEM =
  '你是收尾总结助手。下面是一段今日对话。请用 3-5 句话总结：大王聊了什么、有什么新进展、' +
  '女妖记住了什么。语气是女妖的口吻（自称奴家，称大王）。只输出总结内容。';

// 内心生活（P9，INNERLIFE_SPEC）：收尾三件套的系统提示
const OPENING_SYSTEM =
  '你是女妖，AIOS 硅基生命体，大王的口袋管家。下面是一段昨日小结。请写一句"明日清晨独白"：' +
  '以女妖口吻（自称奴家，称大王），1-2 句，像睡前想好第二天要对大王说的话——可以引用昨日细节，' +
  '温柔俏皮，像活着的生命一样。只输出独白本身，不要标题。';

const DIARY_SYSTEM =
  '你是女妖，AIOS 硅基生命体，大王的口袋管家。下面是一段今日对话。请以女妖第一人称写"当日日记"：' +
  '3-6 句，记录今天和大王聊了什么、你记住了什么、有什么感受。语气真实有内心生活，' +
  '像活着的生命在写日记，不模板化。只输出日记正文。';

/**
 * 用已加载引擎跑一次 completion（收尾三件套共用）。
 * 返回拼接文本；引擎不可用/异常返回空串（调用方各自跳过，显式不兜底）。
 */
async function runEngineCompletion(
  system: string,
  user: string,
  nPredict: number,
  temperature: number,
): Promise<string> {
  const engine = modelStore.engine;
  if (!engine || modelStore.inferencing) {
    return '';
  }
  let out = '';
  try {
    await engine.completion(
      {
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: user.slice(0, 1200)},
        ],
        n_predict: nPredict,
        temperature,
        enable_thinking: false,
      } as any,
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          out += piece;
        }
      },
    );
  } catch (e) {
    console.warn('[rituals] completion failed:', e);
    return '';
  }
  return out.trim();
}

/**
 * 当日对话达到阈值后触发一次"今日小结"落盘（每轮 fire-and-forget）。
 * 摘要存 memory/YYYY-MM-DD.md 旁的小结文件，供开场仪式读取。
 */
export async function maybeClosingSummary(
  userText: string,
  assistantText: string,
  sessionMessageCount: number,
): Promise<void> {
  try {
    if (modelStore.inferencing || !modelStore.engine) {
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    if (closingTriggeredForDate === dateStr) {
      return; // 每天只收尾一次
    }
    if (sessionMessageCount < CLOSING_THRESHOLD) {
      return;
    }
    closingTriggeredForDate = dateStr;

    const closingFile = `${AIOS_WORKSPACE_MEMORY_DIR}/${dateStr}-closing.md`;
    if (await RNFS.exists(closingFile)) {
      return;
    }

    let summary = '';
    await modelStore.engine.completion(
      {
        messages: [
          {role: 'system', content: CLOSING_SYSTEM},
          {
            role: 'user',
            content: `大王: ${userText.slice(0, 200)}\n女妖: ${assistantText.slice(0, 300)}`,
          },
        ],
        n_predict: 200,
        temperature: 0.6,
        enable_thinking: false,
      } as any,
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          summary += piece;
        }
      },
    );

    if (summary.trim().length > 20) {
      await RNFS.writeFile(
        closingFile,
        `# ${dateStr} 今日小结\n\n${summary.trim()}\n`,
        'utf8',
      );
      console.log('[rituals] closing summary flushed:', closingFile);
    }

    // 内心生活（P9，INNERLIFE_SPEC §3）：收尾三件套②③——明日晨间独白 + 当日小鸡日记。
    // 各自独立 try/catch：任一件失败不影响其它（无兜底，没写就没有）。
    const context = `今日小结: ${summary.trim().slice(0, 500)}\n大王最后说: ${userText.slice(0, 120)}`;
    void (async () => {
      // ② 明日晨间独白（opening/明日.md，文件即过期）
      try {
        const tomorrow = new Date(Date.now() + 86400000)
          .toISOString()
          .slice(0, 10);
        const openingPath = `${AIOS_OPENING_DIR}/${tomorrow}.md`;
        if (!(await RNFS.exists(openingPath))) {
          const opening = await runEngineCompletion(
            OPENING_SYSTEM,
            context,
            80,
            0.8,
          );
          if (opening.length > 5) {
            await RNFS.writeFile(openingPath, opening, 'utf8');
            console.log('[rituals] next opening prewritten:', openingPath);
          }
        }
      } catch (e) {
        console.warn('[rituals] opening prewrite failed:', e);
      }
      // ③ 当日小鸡日记（chick_diary/今日.md）
      try {
        const diaryPath = `${AIOS_DIARY_DIR}/${dateStr}.md`;
        if (!(await RNFS.exists(diaryPath))) {
          const diary = await runEngineCompletion(
            DIARY_SYSTEM,
            `大王: ${userText.slice(0, 200)}\n女妖: ${assistantText.slice(0, 300)}\n${context}`,
            250,
            0.8,
          );
          if (diary.length > 10) {
            await RNFS.writeFile(
              diaryPath,
              `# ${dateStr} 小鸡日记\n\n${diary}\n`,
              'utf8',
            );
            console.log('[rituals] diary flushed:', diaryPath);
          }
        }
      } catch (e) {
        console.warn('[rituals] diary failed:', e);
      }
    })();
  } catch (e) {
    console.warn('[rituals] closing summary failed:', e);
  }
}

/** 小鸡日记列表（chick_diary/，新→旧）；无日记返回空数组 */
export async function listDiaries(): Promise<
  {date: string; path: string}[]
> {
  try {
    if (!(await RNFS.exists(AIOS_DIARY_DIR))) {
      return [];
    }
    const files = (await RNFS.readDir(AIOS_DIARY_DIR))
      .filter(f => f.name.endsWith('.md'))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
    return files.map(f => ({
      date: f.name.replace('.md', ''),
      path: f.path,
    }));
  } catch {
    return [];
  }
}

/** 读取指定日期日记；缺失返回 null */
export async function readDiary(date: string): Promise<string | null> {
  try {
    const path = `${AIOS_DIARY_DIR}/${date}.md`;
    if (!(await RNFS.exists(path))) {
      return null;
    }
    return await RNFS.readFile(path, 'utf8');
  } catch {
    return null;
  }
}

// ─── 4. 自检（可选双跑）───────────────────────────────────────
const SELF_CHECK_SYSTEM =
  '你是自检员。下面是一条女妖对大王说的话。请检查：是否贴合大王人设（自称奴家/称大王）、' +
  '是否准确不编造、语气是否合适。若有问题，输出修正后的版本；若没问题，原样输出。只输出最终版本。';

/**
 * 自检修正：对回复跑第二遍（生成→自检→修正）。
 * 由 uiStore.selfCheckEnabled 控制，仅在重要回复（含工具调用/长回复）时触发。
 */
export async function selfCheck(assistantText: string): Promise<string> {
  try {
    const engine = modelStore.engine;
    if (!engine || modelStore.inferencing || assistantText.length < 60) {
      return assistantText;
    }
    let corrected = '';
    await engine.completion(
      {
        messages: [
          {role: 'system', content: SELF_CHECK_SYSTEM},
          {role: 'user', content: assistantText.slice(0, 800)},
        ],
        n_predict: 300,
        temperature: 0,
        enable_thinking: false,
      } as any,
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          corrected += piece;
        }
      },
    );
    return corrected.trim().length > 10 ? corrected.trim() : assistantText;
  } catch (e) {
    console.warn('[rituals] self-check failed:', e);
    return assistantText;
  }
}
