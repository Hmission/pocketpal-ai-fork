/**
 * engineReady — LLM 引擎就绪判定（聊天发送门控的唯一事实源）
 *
 * 场景：上一条刚生成完（或用户刚点停止）native context 仍在收尾清理，
 * 立即发新消息会撞 busy context 报错。发送前轮询等待就绪，状态用户可见。
 *
 * 锋利原则：只等待、不静默重试；超时由调用方显式提示。
 */
import {chatSessionStore, modelStore} from '../store';

const POLL_MS = 200;
const TIMEOUT_MS = 8000;

/** 引擎忙碌：推理中 / 流式中 / 生成中 / 停止收尾中 */
export const engineIsBusy = (): boolean =>
  modelStore.inferencing ||
  modelStore.isStreaming ||
  chatSessionStore.isGenerating ||
  chatSessionStore.isStopping;

/**
 * 等待引擎就绪。已就绪立即 true；轮询（200ms）至就绪 true；超时 false。
 */
export async function awaitEngineReady(): Promise<boolean> {
  if (!engineIsBusy()) {
    return true;
  }
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
    if (!engineIsBusy()) {
      return true;
    }
  }
  return false;
}
