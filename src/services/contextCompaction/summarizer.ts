/**
 * 会话摘要生成（contextCompaction/summarizer）
 *
 * 复用 extractAndSaveMemories 的引擎模式：优先当前对话模型（压缩发生在
 * 发送前，引擎必然空闲），回退管家。独立摘要 prompt，不走回复对话。
 * 结构维度对齐行业实践（Claude auto-compact）：当前目标/关键决策/偏好与
 * 待办/情绪，≤400 字，低温低随机性。
 */
import {modelStore} from '../../store';
import {promptWriter} from '../promptWriter';
import type {CompletionEngine} from '../../utils/completionTypes';

const SUMMARY_SYSTEM =
  '你是会话摘要助手。下面是一段早期对话（大王与女妖）。' +
  '生成简洁的结构化摘要，只保留：当前目标、关键决策、大王提到的偏好与待办、情绪变化。' +
  '不要复述原话、不要输出思考过程、不要发明不存在的信息。' +
  '用 markdown 列表，不超过 400 字，只输出摘要内容。';

export interface SummarizeInput {
  /** 待压缩的对话文本（大王: …\n女妖: … 格式，由编排层拼接） */
  dialogueText: string;
  /** 已有摘要（增量压缩时传入，与新增对话一并概括） */
  priorSummary?: string;
}

/**
 * 生成结构化摘要。引擎不可用/推理中/摘要过短（<8 字）返回 null——
 * 调用方走既有 banner 链路，不新增兜底。
 */
export async function summarizeConversation(
  input: SummarizeInput,
  engine?: CompletionEngine,
): Promise<string | null> {
  if (modelStore.inferencing) {
    return null;
  }
  const resolved =
    engine ??
    modelStore.engine ??
    (promptWriter.isLoaded ? promptWriter : null);
  if (!resolved) {
    return null;
  }
  const userContent = input.priorSummary
    ? `【已有摘要】\n${input.priorSummary}\n\n【新增对话】\n${input.dialogueText}`
    : input.dialogueText;
  try {
    let out = '';
    await resolved.completion(
      {
        messages: [
          {role: 'system', content: SUMMARY_SYSTEM},
          {role: 'user', content: userContent.slice(0, 6000)},
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
