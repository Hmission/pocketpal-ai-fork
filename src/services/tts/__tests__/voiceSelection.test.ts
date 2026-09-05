import type {Voice} from '../types';
import {
  isVoiceMismatchedForText,
  pickDefaultVoice,
  textHasCjk,
  voiceReadsChinese,
} from '../voiceSelection';

const voice = (id: string, language?: string): Voice =>
  ({id, name: id, engine: 'kokoro', language}) as Voice;

/**
 * 语种决策点单测（W1a）：钉住大王裁定「默认中文」与「不匹配只提示、不偷改音色」
 * 两条契约。
 *
 * 真机根因（2026-09-05 K90）：默认音色曾一律取 `voices[0]`（完全不看语种），
 * 而全仓中文音色只有 Kokoro 两颗，Kitten / Supertonic 全是英文 →
 * 默认几乎必然落在英文音色上，中文文本就「读不出」。
 */
describe('voiceSelection（播报语种单一决策点）', () => {
  it('textHasCjk：汉字/假名判为含中文，纯英文与符号不判', () => {
    expect(textHasCjk('你好呀')).toBe(true);
    expect(textHasCjk('こんにちは')).toBe(true);
    expect(textHasCjk('hello world')).toBe(false);
    expect(textHasCjk('')).toBe(false);
  });

  it('voiceReadsChinese：按 BCP-47 前缀判（zh / zh-CN / zh-Hans-CN 都算）', () => {
    expect(voiceReadsChinese(voice('zf', 'zh'))).toBe(true);
    expect(voiceReadsChinese(voice('cn', 'zh-CN'))).toBe(true);
    expect(voiceReadsChinese(voice('us', 'en-US'))).toBe(false);
    expect(voiceReadsChinese(voice('na'))).toBe(false);
  });

  it('pickDefaultVoice：中文优先，无中文才退回首颗，空列表给 null', () => {
    const voices = [voice('en_first', 'en'), voice('zh_second', 'zh-CN')];
    expect(pickDefaultVoice(voices)?.id).toBe('zh_second');
    expect(pickDefaultVoice([voice('only_en', 'en')])?.id).toBe('only_en');
    expect(pickDefaultVoice([])).toBeNull();
  });

  it('isVoiceMismatchedForText：中文文本 × 英文音色才算不匹配，其余都不报', () => {
    const en = voice('en_first', 'en');
    const zh = voice('zh_second', 'zh');
    expect(isVoiceMismatchedForText('你好呀', en)).toBe(true);
    expect(isVoiceMismatchedForText('你好呀', zh)).toBe(false);
    expect(isVoiceMismatchedForText('hello', en)).toBe(false);
    // 还没选音色时不报语种问题（由「未选语音」那条文案负责，不重复报）
    expect(isVoiceMismatchedForText('你好呀', null)).toBe(false);
  });
});
