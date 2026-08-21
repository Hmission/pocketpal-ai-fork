/**
 * 管家轻量上下文组装（管家直答记忆读侧闭环，2026-08-21）
 *
 * 复用既有记忆函数组装 1B 可承载的上下文片段，注入 promptWriter.chat：
 *   【今日状态】日期/上次摘要/昨日情绪/晨间独白  ← buildTodayState
 *   【你对大王的记忆】top≤4                     ← buildMemoryFragment
 *   【召回的历史片段】top≤3                     ← searchMemory
 *   【意图语气】                                ← intentGuidance
 * 与 useChatSession 的 assembleContext 同构但更轻（不读 SOUL/USER/AGENTS 大文件，
 * 管家 n_ctx 2048 预算内）。文件缺失/空 = 片段自然为空（文件即过期公理，不加兜底）。
 */
import {buildMemoryFragment} from './index';
import {buildTodayState, intentGuidance, IntentKind} from './rituals';
import {searchMemory} from './searchEngine';

export async function buildButlerContext(
  userText: string,
  intent: IntentKind,
): Promise<string> {
  const parts: string[] = [];
  const todayState = await buildTodayState();
  if (todayState) {
    parts.push(todayState);
  }
  const memoryFragment = await buildMemoryFragment(userText, intent);
  if (memoryFragment) {
    parts.push(memoryFragment);
  }
  const recalled = await searchMemory(userText, 3);
  if (recalled.length > 0) {
    parts.push(
      '【召回的历史片段】(参考，别全部复述):\n' + recalled.join('\n---\n'),
    );
  }
  const guidance = intentGuidance(intent);
  if (guidance) {
    parts.push(guidance);
  }
  return parts.length > 0 ? parts.join('\n\n---\n\n') : '';
}
