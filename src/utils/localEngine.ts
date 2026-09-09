/**
 * localEngine — 「本轮这段 completion 由哪个本地引擎跑」的唯一裁决点（§公理 6）
 *
 * 立项理由（2026-09-09 全量复查）：同一条表达式
 * `modelStore.engine ?? (promptWriter.isLoaded ? promptWriter : null)` 在本仓被抄了
 * 4 遍（记忆提取 / 记忆治理 / 上下文摘要 / 绘本），albumBook 作者自己的注释就写着
 * 「与记忆提取同款回退模式」。四处还各自在一个完整 params 字面量上盖 `as any` 来压平
 * 管家引擎的收窄签名——同一个决策有四个可分别漂移的副本，且四个都无编译期保护。
 *
 * 收成两个具名函数而不是一个带开关的函数，是因为这里真实存在**两类语义**（强行合一
 * 会把另一种偷偷改掉）：
 *
 * ① 后台自动任务（每轮对话后提取记忆、摘要压缩、定期治理）：**只用已在内存里的引擎**。
 *    管家没加载就返回 null 让调用方显式短路——拉起一个 ~0.7GB 的模型是占用内存的主权
 *    动作，不该由一个 fire-and-forget 的后台小任务代劳。
 * ② 用户显式发起的任务（点「生成本周绘本」）：允许回退到管家，未加载时由其自身的
 *    ensureLoaded 懒拉一次——用户已经在等这个结果，拉起是响应他的指令。
 */
import {promptWriter} from '../services/promptWriter';
import {modelStore} from '../store';
import type {CompletionEngine} from './completionTypes';

/**
 * ① 后台自动任务：当前对话大模型优先（它已在内存，复用它不必拉起第二个模型）；
 * 管家直答模式落常驻管家；两者都不在 → null（调用方必须显式处理，不静默拉模型）。
 */
export function resolveLoadedLocalEngine(): CompletionEngine | null {
  if (modelStore.engine) {
    return modelStore.engine;
  }
  return promptWriter.isLoaded ? promptWriter : null;
}

/**
 * ② 用户显式任务：当前对话大模型优先，否则管家（promptWriter.completion 内部会
 * 自行 ensureLoaded，所以这里返回的是「可用的引擎」而不是「已加载的引擎」）。
 * 返回值可能仍跑不动（模型文件缺失等），那由 completion 的空产出/抛错显式暴露。
 */
export function resolveLocalEngineForUserTask(): CompletionEngine {
  return modelStore.engine ?? promptWriter;
}
