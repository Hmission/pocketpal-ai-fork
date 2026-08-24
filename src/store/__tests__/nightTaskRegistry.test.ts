/**
 * nightTaskRegistry 单测（ONDEVICE_VIDEO_GEN_ANALYSIS §7.1 夜间长任务模式）
 *
 * 覆盖：begin/end 计数语义、isBusy 翻转、count 非负下界、_reset。
 */
import {nightTaskRegistry} from '../nightTaskRegistry';

describe('nightTaskRegistry', () => {
  beforeEach(() => {
    nightTaskRegistry._reset();
  });

  it('初始为 idle（isBusy=false, count=0）', () => {
    expect(nightTaskRegistry.isBusy).toBe(false);
    expect(nightTaskRegistry.count).toBe(0);
  });

  it('begin 后置 busy，end 后回 idle', () => {
    nightTaskRegistry.begin();
    expect(nightTaskRegistry.isBusy).toBe(true);
    expect(nightTaskRegistry.count).toBe(1);
    nightTaskRegistry.end();
    expect(nightTaskRegistry.isBusy).toBe(false);
    expect(nightTaskRegistry.count).toBe(0);
  });

  it('多个并发任务：计数累加，全部 end 才回 idle', () => {
    nightTaskRegistry.begin();
    nightTaskRegistry.begin();
    expect(nightTaskRegistry.count).toBe(2);
    nightTaskRegistry.end();
    // 仍有一个任务在跑
    expect(nightTaskRegistry.isBusy).toBe(true);
    expect(nightTaskRegistry.count).toBe(1);
    nightTaskRegistry.end();
    expect(nightTaskRegistry.isBusy).toBe(false);
  });

  it('end 多于 begin 时计数不下穿 0（非负下界）', () => {
    nightTaskRegistry.end();
    expect(nightTaskRegistry.count).toBe(0);
    expect(nightTaskRegistry.isBusy).toBe(false);
    nightTaskRegistry.end();
    expect(nightTaskRegistry.count).toBe(0);
  });

  it('_reset 清零（测试隔离用）', () => {
    nightTaskRegistry.begin();
    nightTaskRegistry.begin();
    expect(nightTaskRegistry.count).toBe(2);
    nightTaskRegistry._reset();
    expect(nightTaskRegistry.count).toBe(0);
    expect(nightTaskRegistry.isBusy).toBe(false);
  });
});
