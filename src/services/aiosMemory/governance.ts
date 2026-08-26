/**
 * 记忆治理引擎（批次 9-2 · 存→治→用 之「治」）
 *
 * 大王纲领：「治理——如何抽取有价值内容，让 AI 快速能读到，而不是全量读取」。
 *
 * 1. governMemories()：调端侧模型蒸馏结构化（去重合并 + 精炼重写 + 200→~40 条）
 * 2. rotateOldLogs()：conversations/ 日志轮转（保留 90 天，摘要永存）
 *
 * 设计依据：dawangshanAIOS AIOS_EVOLUTION_DIGESTION（演化消化范式）+
 * eng-9d-memory-bus（裁决/新鲜度字段）
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_CONVERSATIONS_DIR} from '../../utils/paths';
import {modelStore} from '../../store';
import {promptWriter} from '../promptWriter';
import {
  load,
  save,
  refreshUserMd,
  extractAttrSlot,
  generateKeywords,
  AiosMemory,
} from './index';

export interface GovernanceResult {
  before: number;
  after: number;
  distilled: boolean;
  error?: string;
}

const GOVERN_SYSTEM =
  '你是记忆治理助手。下面是大王的记忆条目列表（JSON 数组）。' +
  '请蒸馏结构化：\n' +
  '1. 去重：同义/重复的记忆合并为一条\n' +
  '2. 精炼：散条目蒸馏为简洁表达（如 5 条「喜欢X」→ 1 条偏好画像）\n' +
  '3. 保留高价值：身份/偏好/长期属性优先，临时事件可删\n' +
  '4. 删除：瞬时状态（正在等待X/工具不可用）、时效内容（新闻/当日事实）、失败记录（工具调用失败/错误）、女妖自述与寒暄——这些不是长期记忆' +
  '输出严格 JSON 数组，每条含 type 和 content，不超过 40 条。只输出JSON。';

/**
 * 记忆治理：调端侧模型蒸馏结构化（去重合并 + 精炼重写 + 降量）。
 * 由 MemoryScreen 治理按钮触发。
 */
export async function governMemories(): Promise<GovernanceResult> {
  const memories = await load();
  const before = memories.length;

  // 引擎选择：优先当前对话大模型；管家直答回退到管家引擎
  const engine =
    modelStore.engine ?? (promptWriter.isLoaded ? promptWriter : null);
  if (!engine) {
    return {
      before,
      after: before,
      distilled: false,
      error: '没有可用的模型引擎',
    };
  }
  if (modelStore.inferencing) {
    return {
      before,
      after: before,
      distilled: false,
      error: '模型正在推理中，请稍后',
    };
  }

  // 准备输入：只取链尾（未被替代的）+ 非 episode 过期的
  const now = Date.now();
  const input = memories.filter(m => {
    if (m.supersededBy) return false;
    if (m.type === 'episode' && now - m.ts > 30 * 24 * 60 * 60 * 1000)
      return false;
    return true;
  });

  if (input.length < 10) {
    // 条目太少，不需要治理
    return {
      before,
      after: before,
      distilled: false,
      error: '记忆条目不足 10 条，无需治理',
    };
  }

  try {
    let output = '';
    const inputText = JSON.stringify(
      input.map(m => ({type: m.type, content: m.content, ts: m.ts})),
    ).slice(0, 4000); // 截断防过长

    await engine.completion(
      {
        messages: [
          {role: 'system', content: GOVERN_SYSTEM},
          {role: 'user', content: inputText},
        ],
        n_predict: 800,
        temperature: 0,
        enable_thinking: false,
      } as any,
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          output += piece;
        }
      },
    );

    // 解析蒸馏后的记忆
    const jsonText = output
      .trim()
      .replace(/^<s>\s*/i, '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/s, '');
    let first = jsonText.indexOf('[');
    let last = jsonText.lastIndexOf(']');
    if (first < 0 || last <= first) {
      return {
        before,
        after: before,
        distilled: false,
        error: '蒸馏输出解析失败',
      };
    }
    const distilled = JSON.parse(jsonText.slice(first, last + 1)) as Array<{
      type: string;
      content: string;
    }>;

    // 构建新的记忆列表
    const newMemories: AiosMemory[] = distilled.slice(0, 40).map((item, i) => {
      const type = ['fact', 'episode', 'insight'].includes(item.type)
        ? (item.type as AiosMemory['type'])
        : 'episode';
      const content = (item.content || '').trim().slice(0, 200);
      return {
        id: `${Date.now()}-${i}`,
        type,
        content,
        attrSlot: type === 'fact' ? extractAttrSlot(content) : undefined,
        keywords: [], // 治理后重新生成 keywords 由 save 不处理，buildMemoryFragment 用 generateKeywords
        ts: Date.now(),
      };
    });

    // 为蒸馏后记忆补上 keywords
    for (const m of newMemories) {
      m.keywords = generateKeywords(m.content);
    }

    await save(newMemories);
    await refreshUserMd();

    console.log(`[governance] 蒸馏完成: ${before}→${newMemories.length} 条`);
    return {before, after: newMemories.length, distilled: true};
  } catch (e) {
    console.warn('[governance] distillation failed:', e);
    return {before, after: before, distilled: false, error: String(e)};
  }
}

const LOG_ROTATION_DAYS = 90;

/**
 * 日志轮转：删除 conversations/ 超过 90 天的对话日志。
 * 摘要文件（memory/ 目录）永久保留，不删除。
 * 触发：App 启动 + 治理按钮。
 */
export async function rotateOldLogs(): Promise<number> {
  try {
    if (!(await RNFS.exists(AIOS_CONVERSATIONS_DIR))) {
      return 0;
    }
    const files = await RNFS.readDir(AIOS_CONVERSATIONS_DIR);
    const cutoff = Date.now() - LOG_ROTATION_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const f of files) {
      // 文件名格式 YYYY-MM-DD.md
      const dateStr = f.name.replace('.md', '');
      const fileDate = new Date(dateStr).getTime();
      if (!isNaN(fileDate) && fileDate < cutoff) {
        try {
          await RNFS.unlink(f.path);
          deleted++;
        } catch {
          // 单个文件删除失败不影响整体
        }
      }
    }
    if (deleted > 0) {
      console.log(
        `[governance] 日志轮转: 删除 ${deleted} 个过期对话日志（>90天）`,
      );
    }
    return deleted;
  } catch (e) {
    console.warn('[governance] rotateOldLogs failed:', e);
    return 0;
  }
}
