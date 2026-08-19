/**
 * 上下文预算估算（contextCompaction/budget）
 *
 * 双轨制：
 * - 轻量估算（estimateMessageTokens）：字符近似，零 IO，每轮发送前调用，
 *   与 ImageGenScreen/constants.ts 的 estimateTokens 同算法（英文 ~4 字符/token、
 *   中文 1 字符/token，BPE 近似）。
 * - 精确计数（countTokensExact）：llama.rn ctx.tokenize，压缩触发后校验释放量
 *   是否足够，避免「压缩了但预算仍超」的静默失效。
 */
import type {LlamaContext} from 'llama.rn';

/** 粗估 token 数：英文 ~4 字符/token，中文 1 字符/token（BPE 近似） */
export function estimateMessageTokens(text: string): number {
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) {
      ascii++;
    } else {
      nonAscii++;
    }
  }
  return Math.ceil(ascii / 4) + nonAscii;
}

/** 单条消息的角色/模板包装开销近似（BOS/EOS + role 标签 + 换行）。 */
const MESSAGE_OVERHEAD_TOKENS = 8;

/**
 * B19.1 生成预留（真机血证 2026-08-20）：决策触发线含本轮生成预算，
 * 保证触发压缩时上下文仍剩足够工作空间（摘要请求 + 本轮回复）。
 * 与默认 n_predict 同阶；banner 的 WARNING_THRESHOLD 不含预留（用户视角
 * 真实占用），治理动作等效提前——提醒与动作共存自洽。
 */
export const GENERATION_RESERVE = 512;

/**
 * B19.1 水位实测校准：字符估算对英文/markdown/符号系统性低估（真机实测
 * 81% banner 时压缩从未触发），而上一轮 native 实测水位
 * （tokens_evaluated + tokens_predicted，deriveSnapshotFromResult）在
 * ChatSessionStore.lastCompletionResult 现成可用。水位 = max(估算,
 * 实测基线)，估算漂移被实测基线钉底——发送前消费事后实测，双源归一。
 */
export function resolveWatermark(
  estimate: number,
  lastMeasuredUsed?: number,
): number {
  if (lastMeasuredUsed === undefined || lastMeasuredUsed <= 0) {
    return estimate;
  }
  return Math.max(estimate, lastMeasuredUsed);
}

/** 多模态图片 token 近似：llama.rn 默认 image_max_tokens 512（clamp 到 n_ctx）。 */
const IMAGE_TOKEN_APPROX = 512;

// 结构兼容的组装消息形状：llama.rn 与 utils/types 的 ChatMessage 均匹配
//（llama.rn 的 content 为 unknown，用守卫收窄）。
export interface BudgetMessage {
  content?: unknown;
}

/** 组装消息（含 system/召回）的轻量 token 估算。 */
export function estimateMessagesTokens(
  messages: readonly BudgetMessage[],
): number {
  let total = 0;
  for (const msg of messages) {
    const content = msg.content;
    if (typeof content === 'string') {
      total += estimateMessageTokens(content);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        const p = part as {
          type?: string;
          text?: string;
          image_url?: {url?: string};
        };
        if (p.type === 'text' && p.text) {
          total += estimateMessageTokens(p.text);
        } else if (p.type === 'image_url') {
          total += IMAGE_TOKEN_APPROX;
        }
      }
    }
    total += MESSAGE_OVERHEAD_TOKENS;
  }
  return total;
}

/**
 * 精确 token 计数：llama.rn tokenize（vocab_only 上下文同样可用）。
 * 返回 null 表示 tokenizer 不可用（调用方回退轻量估算）。
 */
export async function countTokensExact(
  ctx: LlamaContext | undefined,
  text: string,
): Promise<number | null> {
  if (!ctx) {
    return null;
  }
  try {
    const res = await ctx.tokenize(text);
    return Array.isArray(res?.tokens) ? res.tokens.length : null;
  } catch (e) {
    console.warn('[contextCompaction] tokenize failed:', e);
    return null;
  }
}
