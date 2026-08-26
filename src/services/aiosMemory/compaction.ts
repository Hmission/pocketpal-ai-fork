/**
 * 对话摘要落盘（pre-compaction flush）
 *
 * 当当日对话日志超过阈值时，用本地模型生成增量摘要，
 * 落盘到 memory/YYYY-MM-DD.md。这是短期记忆→长期记忆的桥梁。
 *
 * 写入方：compactAndFlush（摘要文档）
 * 读取方：searchMemory（检索）、contextAssembler（组装）
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_WORKSPACE_MEMORY_DIR} from '../../utils/paths';
import {modelStore} from '../../store';
import {readConversationLog} from './conversationLog';
import {updateConversationCache} from './searchEngine';

const COMPACTION_THRESHOLD_ENTRIES = 20;
const COMPACTION_THRESHOLD_CHARS = 8000;
const COMPACTION_SYSTEM =
  '你是对话摘要助手。下面给你一段今日对话日志。' +
  '请生成简洁摘要，提炼关键信息（大王提到的事、决定、偏好、待办）。' +
  '用 markdown 列表格式，不超过 500 字。只输出摘要内容。';

let compacting = false;

/**
 * 检查当日对话日志是否达到压缩阈值，如果达到则生成摘要落盘。
 * 在每轮对话落盘后由 useChatSession 调用（fire-and-forget）。
 */
export async function compactAndFlush(): Promise<void> {
  if (compacting) {
    return;
  }
  if (modelStore.inferencing) {
    return;
  }
  const engine = modelStore.engine;
  if (!engine) {
    return;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const logContent = await readConversationLog(dateStr);
  if (!logContent) {
    return;
  }

  // Count entries by ## markers
  const entryCount = (logContent.match(/\n## /g) || []).length;
  if (
    entryCount < COMPACTION_THRESHOLD_ENTRIES &&
    logContent.length < COMPACTION_THRESHOLD_CHARS
  ) {
    return;
  }

  // Check if already compacted today
  const summaryFile = `${AIOS_WORKSPACE_MEMORY_DIR}/${dateStr}.md`;
  try {
    if (await RNFS.exists(summaryFile)) {
      return; // Already compacted today
    }
  } catch {
    // ignore
  }

  compacting = true;
  try {
    let summary = '';
    await engine.completion(
      {
        messages: [
          {role: 'system', content: COMPACTION_SYSTEM},
          {role: 'user', content: logContent.slice(-6000)},
        ],
        n_predict: 300,
        temperature: 0,
      } as any,
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          summary += piece;
        }
      },
    );

    if (summary.trim().length > 20) {
      const header = `# ${dateStr} 对话摘要\n\n`;
      await RNFS.writeFile(summaryFile, header + summary.trim() + '\n', 'utf8');
      // Update search index with the new summary
      updateConversationCache(`memory:${dateStr}`, summary);
      console.log('[compaction] Summary flushed to', summaryFile);
    }
  } catch (e) {
    console.warn('[compaction] Failed:', e);
  } finally {
    compacting = false;
  }
}

/**
 * 列出所有摘要日期（从新到旧）。
 */
export async function listSummaryDates(): Promise<string[]> {
  try {
    const files = await RNFS.readDir(AIOS_WORKSPACE_MEMORY_DIR);
    return files
      .filter(f => f.name.endsWith('.md'))
      .map(f => f.name.replace('.md', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * 读取指定日期的摘要。
 */
export async function readSummary(dateStr: string): Promise<string> {
  try {
    const file = `${AIOS_WORKSPACE_MEMORY_DIR}/${dateStr}.md`;
    if (await RNFS.exists(file)) {
      return await RNFS.readFile(file, 'utf8');
    }
    return '';
  } catch {
    return '';
  }
}
