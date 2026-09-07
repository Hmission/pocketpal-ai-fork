/**
 * nightTaskRegistry 单测（ONDEVICE_VIDEO_GEN_ANALYSIS §7.1 夜间长任务模式）
 *
 * 覆盖：票据制 begin/end 语义、isBusy 翻转、**跨域不互扣**（W2 根治点）、
 * 重复释放幂等、伪造票据、owners 诊断面、_reset。
 */
import {nightTaskRegistry} from '../nightTaskRegistry';

describe('nightTaskRegistry（票据制）', () => {
  beforeEach(() => {
    nightTaskRegistry._reset();
  });

  it('初始为 idle（isBusy=false, count=0）', () => {
    expect(nightTaskRegistry.isBusy).toBe(false);
    expect(nightTaskRegistry.count).toBe(0);
    expect(nightTaskRegistry.owners).toEqual([]);
  });

  it('begin 发票据 → 置 busy；凭票 end 回 idle', () => {
    const ticket = nightTaskRegistry.begin('imageGen');
    expect(nightTaskRegistry.isBusy).toBe(true);
    expect(nightTaskRegistry.count).toBe(1);
    expect(nightTaskRegistry.end(ticket)).toBe(true);
    expect(nightTaskRegistry.isBusy).toBe(false);
    expect(nightTaskRegistry.count).toBe(0);
  });

  it('多任务并发：各自持票，全部释放才回 idle', () => {
    const a = nightTaskRegistry.begin('imageGen');
    const b = nightTaskRegistry.begin('phoneCall');
    expect(a).not.toBe(b); // 票据必须唯一，否则两域会互相释放
    expect(nightTaskRegistry.count).toBe(2);
    expect(nightTaskRegistry.end(a)).toBe(true);
    expect(nightTaskRegistry.isBusy).toBe(true); // 另一个仍在跑
    expect(nightTaskRegistry.count).toBe(1);
    nightTaskRegistry.end(b);
    expect(nightTaskRegistry.isBusy).toBe(false);
  });

  /**
   * W2 根治点（2026-09-07 全量排查）：旧 API 是裸 begin()/end()，计数不记归属，
   * 于是夜间队列长跑期间一次通话结束就能把队列的保活额度扣没——前台服务停、
   * wakelock 释放、队列息屏即被杀。这条用例直接钉住「谁 begin 谁 end」。
   */
  it('跨域不互扣：挂断电话不得释放生图队列的保活', () => {
    const queue = nightTaskRegistry.begin('imageGen');
    const call = nightTaskRegistry.begin('phoneCall');
    expect(nightTaskRegistry.end(call)).toBe(true); // 用户挂断
    expect(nightTaskRegistry.isBusy).toBe(true); // 队列仍受保
    expect(nightTaskRegistry.owners).toEqual(['imageGen']);
    expect(nightTaskRegistry.end(queue)).toBe(true); // 队列自己结束
    expect(nightTaskRegistry.isBusy).toBe(false);
  });

  it('同一票据不可重复释放', () => {
    const ticket = nightTaskRegistry.begin('imageGen');
    expect(nightTaskRegistry.end(ticket)).toBe(true);
    expect(nightTaskRegistry.end(ticket)).toBe(false);
    expect(nightTaskRegistry.count).toBe(0);
  });

  it('空票据 / 伪造票据释放无效，计数不下穿 0', () => {
    expect(nightTaskRegistry.end(null)).toBe(false);
    expect(nightTaskRegistry.end(999999)).toBe(false);
    expect(nightTaskRegistry.count).toBe(0);
    expect(nightTaskRegistry.isBusy).toBe(false);
  });

  it('owners 反映归属与登记顺序（诊断面）', () => {
    nightTaskRegistry.begin('imageGen');
    nightTaskRegistry.begin('video');
    expect(nightTaskRegistry.owners).toEqual(['imageGen', 'video']);
  });

  it('_reset 清零（测试隔离用）', () => {
    nightTaskRegistry.begin('imageGen');
    nightTaskRegistry.begin('phoneCall');
    expect(nightTaskRegistry.count).toBe(2);
    nightTaskRegistry._reset();
    expect(nightTaskRegistry.count).toBe(0);
    expect(nightTaskRegistry.isBusy).toBe(false);
  });
});
