/**
 * 会话摘要生成（contextCompaction/summarizer）
 *
 * 复用 extractAndSaveMemories 的引擎模式：优先当前对话模型（压缩发生在
 * 发送前，引擎必然空闲），回退管家。独立摘要 prompt，不走回复对话。
 * 结构维度对齐行业实践（Claude auto-compact）：当前目标/关键决策/偏好与
 * 待办/情绪，≤400 字，低温低随机性。
 *
 * B19.1 摘要工作集预算化（真机血证 2026-08-20）：摘要输入不再按固定
 * 6000 字符裁剪——按字符不按 token，英文/markdown/符号内容 tokenize 后
 * 可超 n_ctx，摘要请求自身溢出（llama.rn ctx_shift 默认 false，prompt
 * ≥ n_ctx 直接硬错）。maxInputChars 由调用方按「n_ctx − 水位 − 生成预留」
 * 预算折算传入，保证请求必然放得下——容量约束前置，不靠运行时报错回退。
 */
import {modelStore} from '../../store';
import {promptWriter} from '../promptWriter';
import type {CompletionEngine} from '../../utils/completionTypes';

const SUMMARY_SYSTEM =
  '你是会话摘要助手。下面是一段早期对话（大王与女妖）。' +
  '生成简洁的结构化摘要，只保留：当前目标、关键决策、大王提到的偏好与待办、情绪变化。' +
  '不要复述原话、不要输出思考过程、不要发明不存在的信息。' +
  '用 markdown 列表，不超过 400 字，只输出摘要内容。';

/** 保守折算：最坏 1 字符 = 1 token（中文全命中；英文实际 ~4:1）。 */
export const CHARS_PER_TOKEN_CONSERVATIVE = 1;

/** token 预算 → 字符裁剪上限（1:1 保守折算，宁少勿溢）。 */
export function tokenBudgetToMaxChars(tokenBudget: number): number {
  return Math.max(0, Math.floor(tokenBudget * CHARS_PER_TOKEN_CONSERVATIVE));
}

export interface SummarizeInput {
  /** 待压缩的对话文本（大王: …\n女妖: … 格式，由编排层拼接） */
  dialogueText: string;
  /** 已有摘要（增量压缩时传入，与新增对话一并概括） */
  priorSummary?: string;
  /** 摘要输入字符预算（B19.1：调用方按上下文余量折算；缺省回退 6000） */
  maxInputChars?: number;
}

/**
 * 生成结构化摘要。引擎不可用/摘要过短（<8 字）返回 null——
 * 调用方走既有 banner 链路，不新增兜底。
 *
 * 防抢引擎检查仅限自动选引擎路径：显式传入 engine = 调用方已裁决引擎
 * 可用（B19.1 真机血证：pre-send 自动压缩发生在 handleSendPress 流程内，
 * 该流程已置 inferencing=true，若一刀切检查会把调度链路自己的摘要请求
 * 拦死；手动 CTA 不传 engine，仍受检查保护）。
 */
export async function summarizeConversation(
  input: SummarizeInput,
  engine?: CompletionEngine,
): Promise<string | null> {
  if (!engine && modelStore.inferencing) {
    return null;
  }
  const resolved =
    engine ?? modelStore.engine ?? (promptWriter.isLoaded ? promptWriter : null);
  if (!resolved) {
    return null;
  }
  const maxChars = input.maxInputChars ?? 6000;
  const userContent = input.priorSummary
    ? `【已有摘要】\n${input.priorSummary}\n\n【新增对话】\n${input.dialogueText}`
    : input.dialogueText;
  try {
    let out = '';
    await resolved.completion(
      {
        messages: [
          {role: 'system', content: SUMMARY_SYSTEM},
          {role: 'user', content: userContent.slice(0, maxChars)},
        ],
        n_predict: 220,
        temperature: 0.3,
        enable_thinking: false,
      } as any,
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          out += piece;
        }
      },
    );
    const summary = out.trim();
    return summary.length >= 8 ? summary.slice(0, 800) : null;
  } catch (e) {
    console.warn('[contextCompaction] summarize failed:', e);
    return null;
  }
}
