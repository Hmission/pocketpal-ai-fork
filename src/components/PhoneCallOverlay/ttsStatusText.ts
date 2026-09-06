import type {SpeakBlock, SpeakIssue} from '../../store/TTSStore';

/** 播报状态行需要的六条文案（来自 `l10n.components.phoneCall`）。 */
export interface TtsStatusStrings {
  ttsPlayFailed: string;
  ttsLangMismatch: string;
  ttsDisabled: string;
  ttsNoVoice: string;
  ttsEngineUnavailable: string;
  ttsReady: string;
}

/**
 * 播报状态行文案的唯一映射点（自 PhoneCallOverlay 的内联三元抽出）。
 *
 * 抽出的理由不是「整洁」：下面五条分支里有三条（`device` / `noVoice` /
 * `engine`）**在真机上不可构造**——要让它们出现，得先把设备内存档位、
 * 音色选择或 TTS 引擎弄坏。零测试覆盖时，任何人把两条文案对调（例如
 * `noVoice` 与 `engine` 串台）都不会有任何防线。
 *
 * 优先级由语义决定，不是随手排的：`speakIssue` 是「已经试过且出问题」的
 * 运行期事实，必须盖过静态的 `speakBlock`——否则用户点了没反应，界面却
 * 告诉他「引擎不可用」，属误导。
 */
export function ttsStatusTextFor(
  t: TtsStatusStrings,
  block: SpeakBlock,
  issue: SpeakIssue,
): string {
  if (issue === 'failed') {
    return t.ttsPlayFailed;
  }
  if (issue === 'lang') {
    return t.ttsLangMismatch;
  }
  if (block === 'device') {
    return t.ttsDisabled;
  }
  if (block === 'noVoice') {
    return t.ttsNoVoice;
  }
  if (block === 'engine') {
    return t.ttsEngineUnavailable;
  }
  return t.ttsReady;
}
