import {safeTimeout} from '../../utils/safeInterval';
import {appendConversation} from './conversationLog';
import {extractAndSaveMemories} from './index';

/**
 * 回合结束 → 记忆收尾的唯一入口（§Wave C+ / CORE-14）。
 *
 * 为什么要单独一个模块，而不是让两个调用点各写一份：
 * 1. **同一语义只留一条路**（公理 6）。旧写法在 `useChatSession` 与 `useChatScheduler`
 *    里各写一遍 `void extractAndSaveMemories(u, a); void appendConversation(u, a);`
 *    加同一份字面量延时，两条路可以静默错峰；
 * 2. **延时不得跨可 mock 边界**。本仓测试对 `services/aiosMemory`（barrel）与
 *    `conversationLog` 都用**整体替换式** `jest.mock(factory)`——工厂里没列出的导出会
 *    变成 `undefined`。所以常量一旦放那边、生产代码又去 import 它，测试里 `ms` 就成了
 *    `undefined`（`setTimeout` 视作 0ms），1.2s 语义静默消失而测试照样绿——正是铁律①
 *    「mock 从未生效 / 两边拿到不同模块」的第三种形态。放本模块内做私有常量，
 *    结构上不可能被这样削掉。
 *
 * 异常收口全部交给 `safeTimeout`（律 2）：本模块内**不得**再出现 `void X()` 或行级 try。
 */

/** 延后到本地推理让出设备再收尾；0 会让抽取与推理抢同一块 GPU，故必须 >0。 */
const POST_TURN_MEMORY_DELAY_MS = 1200;

export interface MemoryPostTurnHooks {
  /**
   * 落盘前对助手文本做一次修正（聊天路径的 P4 自检）。不传则按原文落盘——
   * 管家路径没有 selfCheck 语义，强塞会让两条路径共享一个它们并不都有的前提。
   */
  correct?: (assistantText: string) => Promise<string>;
  /**
   * 与记忆任务**并行**启动的收尾（聊天路径传 compactAndFlush / 今日小结）。
   * 并行而非排队是刻意保持原语义：对话日志落盘与压缩本来就同时跑，改成串行等于
   * 在本轮收口里顺手改时序，那是另一件事。
   */
  parallel?: () => unknown[];
}

/**
 * 安排本轮的记忆收尾。返回 `safeTimeout` 的 cancel 句柄（调用方可以不管，
 * 句柄登记在原语里，会话/测试收尾走 `cancelPendingSafeTimeouts`）。
 *
 * @param origin 哪条路径排的班（`chat` / `butler`）——只用于定时器名，使失败日志
 *   能指出来源；不参与任何逻辑分支（加了分支就又是两条路）。
 */
export function scheduleMemoryPostTurn(
  userText: string,
  assistantText: string,
  origin: 'chat' | 'butler',
  hooks?: MemoryPostTurnHooks,
): () => void {
  return safeTimeout(
    `aios_memory_post_turn_${origin}`,
    () => {
      const corrected = hooks?.correct
        ? hooks.correct(assistantText)
        : Promise.resolve(assistantText);
      const tails = hooks?.parallel ? hooks.parallel() : [];
      // 返回 promise 交给 safeTimeout：任何一条失败都会抵达原语的单点上报，
      // 而不是像旧写法那样以 floating rejection 的形式逃逸。
      return Promise.all([
        corrected.then(text =>
          Promise.all([
            extractAndSaveMemories(userText, text),
            appendConversation(userText, text),
          ]),
        ),
        ...tails,
      ]);
    },
    POST_TURN_MEMORY_DELAY_MS,
  );
}
