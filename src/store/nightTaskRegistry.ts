/**
 * nightTaskRegistry — 夜间长任务模式注册表（ONDEVICE_VIDEO_GEN_ANALYSIS §7.1）
 *
 * 设计：引用计数 + 只读 getter，各 store 不反向引用 imageGenStore（零循环依赖）。
 * ModelStore/TTSStore 进后台释放前查 isBusy，busy 则跳过释放。
 *
 * 生命周期：imageGenStore 在长任务（生成/编辑/未来的视频生成）开始时 begin()，
 * 完成或失败时 end()。计数归零即释放前台服务。
 */
let count = 0;

export const nightTaskRegistry = {
  /** 长任务开始（imageGenStore 调用） */
  begin(): void {
    count++;
  },

  /** 长任务结束（imageGenStore 调用） */
  end(): void {
    count = Math.max(0, count - 1);
  },

  /** 是否有夜间任务进行中（ModelStore/TTSStore 查询） */
  get isBusy(): boolean {
    return count > 0;
  },

  /** 调试用：当前计数 */
  get count(): number {
    return count;
  },

  /** 测试专用：重置计数（生产代码不调用） */
  _reset(): void {
    count = 0;
  },
};
