/**
 * Memory display types
 *
 * Note: The actual memory fit calculation logic is in useMemoryCheck.ts
 * (getMemoryFitDetails function) to avoid circular dependencies.
 */

/**
 * 内存契合态。
 *
 * `unknown` 不是一个「不够用的档位」，而是「没查成」：估算抛错时**不得**写
 * `fits`（那会把未验证说成已验证，fail-open 诱导用户加载致 OOM），也**不得**
 * 反向冒充 `tight`/`wont_fit`（那会无端拦住本来跑得动的模型）。UI 读到此值时
 * 应展示「未确认」类提示，而不是任何方向的结论。
 */
export type MemoryFitStatus = 'fits' | 'tight' | 'wont_fit' | 'unknown';
