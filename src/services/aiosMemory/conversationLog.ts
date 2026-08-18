/**
 * \u5bf9\u8bdd\u65e5\u5fd7\u843d\u76d8\uff08\u751f\u6210\u5373\u843d\u76d8\uff09
 *
 * \u6bcf\u8f6e assistant \u56de\u590d\u5b8c\u6210\u540e\uff0c\u7acb\u5373\u8ffd\u52a0\u5199\u5165 conversations/YYYY-MM-DD.md
 * \u5386\u53f2\u5168\u5728\u843d\u76d8\u6587\u4ef6\u91cc\uff0c\u4e0d\u4f9d\u8d56\u7a97\u53e3\u4e0a\u4e0b\u6587\u4fdd\u7559\u3002
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_CONVERSATIONS_DIR} from '../../utils/paths';
import {updateConversationCache} from './searchEngine';

// Track last write time for TurnMetricsRow display (B18 §17)
let _lastWriteTime: number | null = null;

/** Get the timestamp of the last successful conversation append (for UI display). */
export function getLastWriteTime(): number | null {
  return _lastWriteTime;
}

/**
 * \u8ffd\u52a0\u4e00\u8f6e\u5bf9\u8bdd\u5230\u5f53\u65e5\u5bf9\u8bdd\u65e5\u5fd7\u3002
 * \u5f02\u6b65 fire-and-forget\uff0c\u4e0d\u963b\u585e UI\u3002
 */
export async function appendConversation(
  userText: string,
  assistantText: string,
): Promise<void> {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);
    const file = `${AIOS_CONVERSATIONS_DIR}/${dateStr}.md`;

    const entry =
      `\n## ${timeStr}\n` +
      `\u5927\u738b: ${userText.slice(0, 2000)}\n` +
      `\u5973\u5996: ${assistantText.slice(0, 4000)}\n`;

    if (!(await RNFS.exists(file))) {
      await RNFS.writeFile(file, `# \u5bf9\u8bdd\u65e5\u5fd7 ${dateStr}\n`, 'utf8');
    }
    await RNFS.appendFile(file, entry, 'utf8');
    // Update search index cache so new conversations are immediately searchable
    const fullContent = await RNFS.readFile(file, 'utf8');
    updateConversationCache(`conversation:${dateStr}`, fullContent);
    _lastWriteTime = Date.now();
  } catch (e) {
    console.warn('[conversationLog] append failed:', e);
  }
}

/**
 * \u8bfb\u53d6\u6307\u5b9a\u65e5\u671f\u7684\u5bf9\u8bdd\u65e5\u5fd7\u3002
 */
export async function readConversationLog(dateStr: string): Promise<string> {
  try {
    const file = `${AIOS_CONVERSATIONS_DIR}/${dateStr}.md`;
    if (await RNFS.exists(file)) {
      return await RNFS.readFile(file, 'utf8');
    }
    return '';
  } catch (e) {
    console.warn('[conversationLog] read failed:', e);
    return '';
  }
}

/**
 * \u5217\u51fa\u6240\u6709\u5bf9\u8bdd\u65e5\u5fd7\u65e5\u671f\uff08\u4ece\u65b0\u5230\u65e7\uff09\u3002
 */
export async function listConversationDates(): Promise<string[]> {
  try {
    const files = await RNFS.readDir(AIOS_CONVERSATIONS_DIR);
    return files
      .filter(f => f.name.endsWith('.md'))
      .map(f => f.name.replace('.md', ''))
      .sort()
      .reverse();
  } catch (e) {
    console.warn('[conversationLog] list failed:', e);
    return [];
  }
}
