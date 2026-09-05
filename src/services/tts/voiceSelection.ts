import type {Voice} from './types';

/**
 * 语音选择单一决策点（W1a「播报不骗人」）。
 *
 * 立此文件的根因（2026-09-05 K90 实证）：默认音色一律取 `voices[0]`
 * （`TTSStore` 下载完成后的回落），**完全不看语种**；而全仓中文音色只有
 * Kokoro 两颗，Kitten 8 颗、Supertonic 10 颗全是英文 → 默认几乎必然落在
 * 英文音色上，中文文本播出来就是「读不出」。大王裁定：**默认中文**。
 *
 * 纪律：这里只做「选谁」与「读不读得了」的判定，**不自动替用户跨引擎改选**
 * （不兜底）——读不了就让 UI 明确说出来，用户自己决定换不换。
 */

/** 文本是否含汉字/假名（CJK）。判定只做一次，不引第三方语种库。 */
export const textHasCjk = (text: string): boolean =>
  /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]/.test(text);

/**
 * 该音色读不读得了中文：`language` 以 `zh` 开头。
 * OS 侧可能回报 `zh-CN` / `zh-Hans-CN` 等 BCP-47 变体，故按前缀判。
 */
export const voiceReadsChinese = (voice: Voice): boolean =>
  (voice.language ?? '').toLowerCase().startsWith('zh');

/**
 * 默认音色：中文优先——同引擎内有 `zh*` 就取第一颗，否则退回列表首颗。
 * 只用于「用户尚未显式选择」时的默认派生，**不覆盖用户已选的音色**。
 */
export const pickDefaultVoice = (voices: Voice[]): Voice | null => {
  if (voices.length === 0) {
    return null;
  }
  return voices.find(voiceReadsChinese) ?? voices[0]!;
};

/**
 * 播报前的一致性判定：中文文本 × 不读中文的音色 = 不匹配（UI 须明说）。
 * 文本无 CJK、或音色本就读中文 → 不算问题。
 */
export const isVoiceMismatchedForText = (
  text: string,
  voice: Voice | null,
): boolean => {
  if (!voice || !textHasCjk(text)) {
    return false;
  }
  return !voiceReadsChinese(voice);
};
