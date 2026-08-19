/**
 * 会话内摘要压缩编排（contextCompaction/index）
 *
 * 非破坏性（OpenCode 式）：被压消息原文保留、标记 compacted，prompt 组装时
 * 由 useChatSession 过滤并注入摘要。单锚点模型：同一会话至多一条消息持有
 * metadata.compaction（承载最新摘要），其余被压消息仅标记 compacted。
 *
 * 流程：选最旧未压缩区间（保护最近消息）→ 生成/增量摘要 → 返回结果
 * （标记与 UI 由调用方落盘）。摘要另落当日日志（appendConversation），
 * 供 searchMemory 跨会话召回。
 */
import {appendConversation} from '../aiosMemory/conversationLog';
import {estimateMessageTokens} from './budget';
import {
  summarizeConversation,
  tokenBudgetToMaxChars,
} from './summarizer';
import {chatSessionStore} from '../../store';
import {emit} from '../../debug/eventStream';
import type {CompletionEngine} from '../../utils/completionTypes';
import type {MessageType} from '../../utils/types';

/** 摘要请求自身开销近似：SUMMARY_SYSTEM + 模板包装 + n_predict(220)。 */
const SUMMARY_REQUEST_OVERHEAD_TOKENS = 400;

export interface CompressionResult {
  /** 被压缩的消息条数 */
  compactedCount: number;
  /** 生成/更新的摘要文本 */
  summary: string;
  /** 被压消息 id 列表（含新锚点，调用方据此标记） */
  compactedMessageIds: string[];
  /** 新锚点消息 id（挂 metadata.compaction） */
  anchorMessageId: string;
}

export interface CompressSessionInput {
  /** 当前会话消息（原文，未组装） */
  messages: MessageType.Any[];
  /** 摘要引擎（缺省自动选择：当前模型 → 管家） */
  engine?: CompletionEngine;
  /** 单次最多压缩消息条数（无预算缺口时生效，默认 20 ≈ 10 轮） */
  maxMessages?: number;
  /** 保护最近消息条数（默认 4 ≈ 2 轮） */
  minKeepMessages?: number;
  /** 目标释放 token（预算缺口）；缺失则压满 maxMessages */
  targetReleaseTokens?: number;
  /**
   * B19.1 生效 n_ctx：摘要输入按「n_ctx − 请求自身开销」预算裁剪，
   * 保证摘要请求必然放得下（llama.rn ctx_shift 默认 false，prompt
   * ≥ n_ctx 直接硬错）。缺省回退固定 6000 字符。
   */
  nCtx?: number;
}

/** 消息 → 日志侧文本（大王:/女妖: 格式，与 conversationLog 同构）。 */
function messageToDialogueText(m: MessageType.Any): string | null {
  if (m.type === 'text') {
    const text = m.text?.trim();
    return text ? text : null;
  }
  if (m.type === 'assistant_turn') {
    const parts = (m.steps ?? [])
      .map(s => s.content?.trim())
      .filter((c): c is string => !!c);
    const text = parts.join('\n').trim();
    return text ? text : null;
  }
  return null;
}

/** 消息归属：大王 / 女妖（按 author id 判定，未知按消息类型回退）。 */
function speakerOf(m: MessageType.Any): '大王' | '女妖' {
  if (m.author?.id === 'y9d7f8pgn') {
    return '大王';
  }
  if (m.author?.id === 'h3o3lc5xj') {
    return '女妖';
  }
  return m.type === 'assistant_turn' ? '女妖' : '大王';
}

/**
 * 执行一次会话内压缩。无可压缩区间/摘要失败返回 null——
 * 调用方走既有 banner 链路（增窗/新会话），不新增兜底。
 */
export async function compressSession(
  input: CompressSessionInput,
): Promise<CompressionResult | null> {
  const {
    messages,
    engine,
    maxMessages = 20,
    minKeepMessages = 4,
    targetReleaseTokens,
  } = input;

  if (messages.length <= minKeepMessages) {
    return null;
  }

  // 单锚点：已有锚点则从锚点起重压（增量）；否则从最旧起。
  const anchorIdx = messages.findIndex(m => !!m.metadata?.compaction);
  const startIdx = anchorIdx >= 0 ? anchorIdx : 0;
  const endExclusive = messages.length - minKeepMessages;
  if (endExclusive <= startIdx) {
    return null;
  }

  // 预算缺口驱动条数：从最旧累积估算 token，达到目标即停（至少 1 条）。
  // B19.1：target 驱动时条数上限放宽到全部可压区间——maxMessages 仅在
  // 无预算缺口（手动全量压缩）时生效；缺口达不成时宁多压不静默欠释放。
  const cap =
    targetReleaseTokens !== undefined
      ? endExclusive - startIdx
      : maxMessages;
  let count = 0;
  let accumulated = 0;
  for (let i = startIdx; i < endExclusive; i++) {
    const text = messageToDialogueText(messages[i]);
    accumulated += text ? estimateMessageTokens(text) : 0;
    count++;
    if (targetReleaseTokens !== undefined && accumulated >= targetReleaseTokens) {
      break;
    }
    if (count >= cap) {
      break;
    }
  }

  // B19.1 释放量校验（budget.ts 设计承诺补齐）：保护区外全部压完仍不达
  // 预算缺口 → 压缩无法达成目标（剩余消息自身超预算，如保护区巨型消息），
  // 诚实返回 null 走失败链路，避免「压缩了但预算仍超」的静默失效。
  if (
    targetReleaseTokens !== undefined &&
    accumulated < targetReleaseTokens &&
    startIdx + count >= endExclusive
  ) {
    emit('chat', 'chat.compact_stage', {
      stage: 'release-check-failed',
      accumulated,
      targetReleaseTokens,
    });
    return null;
  }

  const slice = messages.slice(startIdx, startIdx + count);
  if (slice.length === 0) {
    return null;
  }

  // 拼对话文本（大王:/女妖: 前缀）。
  const dialogueLines: string[] = [];
  for (const m of slice) {
    const text = messageToDialogueText(m);
    if (!text) {
      continue;
    }
    dialogueLines.push(`${speakerOf(m)}: ${text}`);
  }
  if (dialogueLines.length === 0) {
    return null;
  }

  const priorSummary =
    anchorIdx >= 0
      ? (messages[anchorIdx].metadata?.compaction as
          | {summary?: string}
          | undefined)?.summary
      : undefined;

  // B19.1 摘要工作集预算化：输入按「n_ctx − 请求自身开销」折算裁剪，
  // 保证摘要请求必然放得下；缺省回退固定 6000 字符。
  const maxInputChars = input.nCtx
    ? Math.min(6000, tokenBudgetToMaxChars(input.nCtx - SUMMARY_REQUEST_OVERHEAD_TOKENS))
    : 6000;

  emit('chat', 'chat.compact_stage', {
    stage: 'summary-start',
    sliceCount: slice.length,
    accumulated,
    targetReleaseTokens: targetReleaseTokens ?? null,
    maxInputChars,
  });
  const summary = await summarizeConversation(
    {
      dialogueText: dialogueLines.join('\n'),
      priorSummary,
      maxInputChars,
    },
    engine,
  );
  if (!summary) {
    emit('chat', 'chat.compact_stage', {stage: 'summary-failed'});
    return null;
  }
  emit('chat', 'chat.compact_stage', {
    stage: 'summary-ok',
    summaryLen: summary.length,
  });

  // 摘要落当日日志，供 searchMemory 跨会话召回（失败不影响会话内结果）。
  try {
    await appendConversation('【上下文压缩】早期对话摘要', summary);
  } catch {
    // 日志失败不阻断压缩
  }

  return {
    compactedCount: slice.length,
    summary,
    compactedMessageIds: slice.map(m => m.id),
    anchorMessageId: slice[0].id,
  };
}

/**
 * 压缩 + 落盘一站式（单事实源）：useChatSession 发送前自动路径与 ChatView
 * banner 手动 CTA 共用。压缩成功后：被压消息标记 compacted（锚点挂摘要）、
 * lastCompaction 写入 store（UI 提示条消费）。失败返回 null 走既有链路。
 */
export async function compactSessionAndMark(
  sessionId: string,
  messages: MessageType.Any[],
  options?: {
    targetReleaseTokens?: number;
    engine?: CompletionEngine;
    /** B19.1 生效 n_ctx：透传 compressSession 做摘要预算裁剪 */
    nCtx?: number;
  },
): Promise<CompressionResult | null> {
  const result = await compressSession({
    messages,
    targetReleaseTokens: options?.targetReleaseTokens,
    engine: options?.engine,
    nCtx: options?.nCtx,
  });
  if (!result) {
    return null;
  }
  for (const id of result.compactedMessageIds) {
    await chatSessionStore.updateMessage(id, sessionId, {
      metadata: {compacted: true},
    });
  }
  await chatSessionStore.updateMessage(result.anchorMessageId, sessionId, {
    metadata: {
      compaction: {
        summary: result.summary,
        messageIds: result.compactedMessageIds,
        count: result.compactedCount,
        ts: Date.now(),
      },
    },
  });
  chatSessionStore.lastCompaction = {
    count: result.compactedCount,
    summary: result.summary,
    ts: Date.now(),
    sessionId,
  };
  return result;
}
