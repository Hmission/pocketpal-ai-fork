import type {EngineId} from './types';

/**
 * 「这次 stop 的失败算不算真失败」的唯一判定口径。
 * 规范：docs/POCKETPAL_TTS_SPEC.md §2。
 *
 * 为什么必须有这个函数、且必须有单测：lib 的 `Speech.stop()` 是**合体 API**
 * （先同步置 neural 停止标志，再 `await TurboSpeech.stop()` 打系统合成器），
 * 本仓拿不到「只停 neural」的 API，所以只能对返回的失败**按事实定性**。
 * 三种情形在真机上不可构造（要弄坏系统 TTS 引擎或换内存档位才碰得到），
 * 按 POCKETPAL_TEST_INFRA_SPEC 四条自查第 4 条，单测是唯一防线——
 * 否则任何人把两条分支对调都不会有反应。
 *
 * 口径：
 * - `activeEngineId === null`：runtime 已提前 no-op，走不到这里；保留分支只为口径完整。
 * - `'system'`：系统合成器是唯一发声通道，失败即真失败。
 * - neural：停止标志已同步置位（意图已达成），只有 OS 侧本来可用时，
 *   那半段失败才意味着「可能还有东西在播」——此时才是真失败。
 */
export function ttsStopFailureIsReal(
  activeEngineId: EngineId | null,
  osTTSReady: boolean | null,
): boolean {
  if (activeEngineId === null) {
    return false;
  }
  if (activeEngineId === 'system') {
    return true;
  }
  return osTTSReady === true;
}
