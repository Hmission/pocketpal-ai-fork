import {ttsStopFailureIsReal} from '../stopOutcome';

/**
 * 锁 `ttsStopFailureIsReal` 的全部分支（规范：docs/POCKETPAL_TTS_SPEC.md §2）。
 *
 * 为什么必须有这份测试：三条分支在真机上**不可构造**——要弄坏系统 TTS 引擎、
 * 或换设备内存档位才碰得到。零覆盖时任两条分支对调都不会有任何反应，
 * 而后果直接落在用户身上：要么真失败被当噪音吞掉（停不下却无声），
 * 要么假失败继续冒充错误（日志永远脏）。
 */
describe('ttsStopFailureIsReal — stop 失败定性口径', () => {
  it('无活跃引擎 → 不算失败（runtime 已提前 no-op，此分支只为口径完整）', () => {
    expect(ttsStopFailureIsReal(null, null)).toBe(false);
    expect(ttsStopFailureIsReal(null, true)).toBe(false);
    expect(ttsStopFailureIsReal(null, false)).toBe(false);
  });

  it('system 引擎活跃 → 无论 OS 探测结果如何都是真失败（它是唯一发声通道）', () => {
    expect(ttsStopFailureIsReal('system', true)).toBe(true);
    expect(ttsStopFailureIsReal('system', false)).toBe(true);
    expect(ttsStopFailureIsReal('system', null)).toBe(true);
  });

  it('neural 引擎活跃 + OS 本来可用 → 真失败（OS 侧可能还有东西在播）', () => {
    expect(ttsStopFailureIsReal('supertonic', true)).toBe(true);
    expect(ttsStopFailureIsReal('kokoro', true)).toBe(true);
    expect(ttsStopFailureIsReal('kitten', true)).toBe(true);
  });

  it('neural 引擎活跃 + OS 未就绪/未探测 → 假失败（真机现场：HyperOS tts_current_engine=null）', () => {
    // Speech.stop() 已同步置位 neural 停止标志，本仓意图达成；
    // OS 那半段从未初始化，谈不上「该停没停」。
    expect(ttsStopFailureIsReal('supertonic', false)).toBe(false);
    expect(ttsStopFailureIsReal('supertonic', null)).toBe(false);
  });
});
