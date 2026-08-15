/**
 * speakable — AI 消息可朗读性判定（单一事实源）
 *
 * PlayButton 渲染 self-gate 与 AssistantTurnFooter 显示 gate 共用，
 * 保证「AI 回复卡片下方的朗读按钮」只出现在真正值得朗读的消息上。
 *
 * 锋利边界：
 *  - 排除生图任务卡片（metadata.imageTask）：内容是"已为你生成：prompt"
 *    与图片，无朗读价值。
 *  - 单词/空文本不朗读。
 */
import {assistant, derivedText} from './chat';
import {MessageType} from './types';

/** 空白分词词数（英文等空格语言） */
export const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
};

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * 是否有实质可朗读内容：
 *  - CJK 文本：按字符数（中文无空格，空白分词会误判整句为 1 词）
 *  - 空格语言：按词数
 */
function hasSpeakableContent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  if (CJK_RE.test(trimmed)) {
    return trimmed.length >= 4;
  }
  return countWords(trimmed) > 1;
}

/**
 * 消息是否具备可朗读内容（纯内容判定，不含 TTS 可用性——
 * 避免 utils→store 循环依赖，调用方自行组合 ttsStore.isTTSAvailable）。
 * 类型守卫：命中后收窄为 Text | AssistantTurn。
 */
export function isSpeakableMessage(
  message: MessageType.Any,
): message is MessageType.Text | MessageType.AssistantTurn {
  if (message.type !== 'text' && message.type !== 'assistant_turn') {
    return false;
  }
  if (message.author?.id !== assistant.id) {
    return false;
  }
  // 生图任务卡片（生成中/成功/失败）一律不朗读
  if ((message.metadata as Record<string, any> | undefined)?.imageTask) {
    return false;
  }
  return hasSpeakableContent(derivedText(message));
}
