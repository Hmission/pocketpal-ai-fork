/**
 * nightTaskRegistry — 夜间长任务模式注册表（ONDEVICE_VIDEO_GEN_ANALYSIS §7.1）
 *
 * 设计：票据制引用计数 + 只读 getter，各 store 不反向引用 imageGenStore（零循环依赖）。
 * ModelStore/TTSStore 进后台释放前查 isBusy，busy 则跳过释放。
 *
 * 2026-09-07 归属收口（W2）：旧 API 是裸 `begin()`/`end()` 对一个计数器做加减，
 * **不记是谁申请的**——于是任何域的 `end()` 都能扣掉别域的保活额度：夜间队列长跑
 * 期间用户结束一次通话，计数被扣到 0、前台服务停止、wakelock 释放，队列息屏即被杀
 * （正是 §7.1 要根治的反例）。现在 `begin()` 返回票据、`end()` 只认票据，且同一
 * 票据不可重复释放（`Map.delete` 天然保证）。
 */
let seq = 0;
const holders = new Map<number, string>();

export const nightTaskRegistry = {
  /**
   * 长任务开始：登记归属并返回释放票据（调用方自己持有该 ticket，结束时凭票释放）。
   * @param owner 归属标识（'imageGen' / 'phoneCall' / 'video'…），仅用于诊断
   */
  begin(owner: string): number {
    const ticket = ++seq;
    holders.set(ticket, owner);
    return ticket;
  },

  /**
   * 长任务结束：凭票释放。
   * @returns true=确实释放了一个持有者；false=票据无效（未持有或已释放过）
   */
  end(ticket: number | null): boolean {
    if (ticket === null) {
      return false;
    }
    return holders.delete(ticket);
  },

  /** 当前持有者清单（诊断 / DRC 取证用；业务判定只读 isBusy） */
  get owners(): string[] {
    return [...holders.values()];
  },

  /** 是否有夜间任务进行中（ModelStore/TTSStore 查询） */
  get isBusy(): boolean {
    return holders.size > 0;
  },

  /** 调试用：当前计数 */
  get count(): number {
    return holders.size;
  },

  /** 测试专用：重置计数（生产代码不调用） */
  _reset(): void {
    holders.clear();
  },
};
