/**
 * \u52a8\u6001\u4e0a\u4e0b\u6587\u7ec4\u88c5\u5668\uff08\u52a8\u6001\u77e5\u8bc6\u5e93\u7ba1\u7406\u7a97\u53e3\uff09
 *
 * \u6bcf\u8f6e\u63a8\u7406\u524d\uff0c\u4ece\u77e5\u8bc6\u5e93\u53ec\u56de\u76f8\u5173\u7247\u6bb5 + \u6700\u8fd11-2\u8f6e + system\uff0c\u7ec4\u88c5\u7cbe\u7b80\u7a97\u53e3\u3002
 * \u7a97\u53e3\u4e0d\u518d\u662f"\u88c5\u8f7d\u5386\u53f2\u7684\u5730\u65b9"\uff0c\u800c\u662f"\u52a8\u6001\u53ec\u56de\u7684\u821e\u53f0"\u3002
 * \u4e0a\u4e0b\u6587\u6c38\u4e0d\u8017\u5149\uff0c\u4f1a\u8bdd\u6c38\u4e0d\u9501\u6b7b\u3002
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  AIOS_SOUL_FILE,
  AIOS_USER_FILE,
  AIOS_AGENTS_FILE,
  AIOS_MEMORY_FILE,
  AIOS_CONVERSATIONS_DIR,
} from '../../utils/paths';
import {buildMemoryFragment} from './index';
import {searchMemory} from './searchEngine';
import {buildTodayState, intentGuidance, trackSentiment, classifyIntent} from './rituals';

export interface AssembledContext {
  systemPrompt: string;
  recalledFragments: string[];
  recallCount: number;
  dirtyEnvironment: boolean; // true when conversations/ is empty (fallback mode)
}

// Track last recall info for SessionStatusBar display
let _lastRecallCount = 0;
let _lastRecallPreview: string[] = [];

/** Get the last recall count for UI display. */
export function getLastRecallInfo(): {count: number; preview: string[]} {
  return {count: _lastRecallCount, preview: _lastRecallPreview};
}

async function readFileSafe(path: string): Promise<string> {
  try {
    if (await RNFS.exists(path)) {
      return await RNFS.readFile(path, 'utf8');
    }
  } catch (e) {
    console.warn(`[contextAssembler] read ${path} failed:`, e);
  }
  return '';
}

/**
 * \u7ec4\u88c5\u63a8\u7406\u4e0a\u4e0b\u6587\u3002
 *
 * 1. system \u5c42\uff1aSOUL.md\uff08\u4eba\u8bbe\uff09+ AGENTS.md\uff08\u89c4\u8303\uff09+ buildMemoryFragment
 * 2. \u53ec\u56de\u5c42\uff1asearchMemory(currentUserText) \u4ece conversations + memory \u53ec\u56de top-N
 * 3. \u5373\u65f6\u5c42\uff1a\u6700\u8fd11-2\u8f6e\u539f\u6587\uff08\u7531 useChatSession \u4fdd\u7559\uff09
 * 4. \u5f53\u524d\u5c42\uff1a\u5f53\u524d user \u8f93\u5165\uff08\u7531 useChatSession \u4fdd\u7559\uff09
 *
 * @param currentUserText \u5f53\u524d\u7528\u6237\u8f93\u5165
 * @param recentMessageCount \u6700\u8fd1\u6d88\u606f\u6570\uff08\u7528\u4e8e\u81ea\u9002\u5e94\u53ec\u56de\u7247\u6bb5\u6570\uff09
 * @param maxRecallFragments \u6700\u5927\u53ec\u56de\u7247\u6bb5\u6570
 */
export async function assembleContext(
  currentUserText: string,
  recentMessageCount = 0,
  maxRecallFragments = 5,
): Promise<AssembledContext> {
  // \u81ea\u9002\u5e94\u53ec\u56de\uff1a\u8fd1\u671f\u6d88\u606f\u591a\uff08\u4e0a\u4e0b\u6587\u7a7a\u95f4\u5c11\uff09\u2192\u5c11\u53ec\u56de\uff1b\u8fd1\u671f\u6d88\u606f\u5c11\uff08\u7a7a\u95f4\u591a\uff09\u2192\u591a\u53ec\u56de
  const adaptiveMax = recentMessageCount > 10
    ? Math.max(1, maxRecallFragments - 2)
    : recentMessageCount > 5
      ? Math.max(2, maxRecallFragments - 1)
      : maxRecallFragments;

  // 1. system 层：SOUL（人设）+ USER（大王画像）+ AGENTS（规范）+ MEMORY（注入知识文档，截断防臃肿）+ 记忆碎片
  const soul = await readFileSafe(AIOS_SOUL_FILE);
  const user = await readFileSafe(AIOS_USER_FILE);
  const agents = await readFileSafe(AIOS_AGENTS_FILE);
  const memoryDoc = (await readFileSafe(AIOS_MEMORY_FILE)).slice(0, 2000);
  // 9-3 意图引导装填：classifyIntent 四态 → buildMemoryFragment 按意图选策略
  const intentKind = classifyIntent(currentUserText);
  const memoryFragment = await buildMemoryFragment(currentUserText, intentKind);
  // P4 仪式：开场状态（日期+上次摘要+昨日情绪）+ 意图语气（闲聊/倾诉/问答/任务）
  const todayState = recentMessageCount <= 2 ? await buildTodayState() : '';
  const intent = intentGuidance(currentUserText);
  // M7 情绪：跟踪大王输入情绪，供状态展示
  trackSentiment(currentUserText);
  const systemPrompt = [soul, user, agents, memoryDoc, todayState, intent, memoryFragment]
    .filter(Boolean)
    .join('\n\n---\n\n');

  // 2. 召回层（自适应片段数） — dirty environment: conversations/ empty → skip recall
  let recalledFragments: string[] = [];
  let dirtyEnvironment = false;
  try {
    const convExists = await RNFS.exists(AIOS_CONVERSATIONS_DIR);
    if (convExists) {
      const convFiles = await RNFS.readDir(AIOS_CONVERSATIONS_DIR);
      if (convFiles.length > 0) {
        recalledFragments = await searchMemory(currentUserText, adaptiveMax);
      } else {
        dirtyEnvironment = true; // conversations/ empty → fallback to full context mode
      }
    } else {
      dirtyEnvironment = true;
    }
  } catch (e) {
    console.warn('[contextAssembler] recall failed:', e);
    dirtyEnvironment = true;
  }

  // Track for SessionStatusBar
  _lastRecallCount = recalledFragments.length;
  _lastRecallPreview = recalledFragments.slice(0, 3);

  return {
    systemPrompt,
    recalledFragments,
    recallCount: recalledFragments.length,
    dirtyEnvironment,
  };
}
