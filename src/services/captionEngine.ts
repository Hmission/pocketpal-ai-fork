/**
 * captionEngine — 图像反推提示词引擎（创作工坊 P1）
 *
 * 链路（单通道，与聊天/生图互斥由 engineMutex 保证）：
 *   engineMutex.acquire('chat') → 自动释放 prompter/image 槽
 *   → modelStore.selectModel(反推 VLM)（initContext 自动配对 mmproj → initMultimodal）
 *   → startImageCompletion({image_paths, prompt})（llama.rn 视觉通道）
 *   → 收集输出 → manualReleaseContext 释放（懒恢复：下次管家/聊天任务自行重载）
 *
 * 模型裁定（2026-08-21 大王确认）：Qwen3.5-4B + mmproj-BF16（MODEL_MATRIX #3/#4，
 * 社区 2026 验证的 ComfyUI 反推标准组合）；单次 >3 分钟时评估降 2B。
 * 指令模板：禁思考模式、纯净输出（Qwen3.5-Caption-WebUI 同款语义）。
 */
import {modelStore} from '../store';
import {engineMutex} from '../store/engineMutex';
import {Model, ModelOrigin, ModelType} from '../utils/types';
import {isPrompterModelName} from './promptWriter';

/** 反推 VLM 文件名指纹（MODEL_MATRIX §1.2） */
const CAPTION_MODEL_RE = /qwen3\.5[-_ ]?4b/i;

/**
 * 反推指令（2026-08-21 K90 真机质量观察后优化）：
 * 原长指令抽象措辞（"Output only the prompt itself..."）致 4B 复述指令本身
 * （输出 "The user wants a detailed English prompt..."）。改为 one-shot 示例
 * + 简洁负面清单——小模型遵循短指令 + 可见输出形状最佳。
 */
export const CAPTION_INSTRUCTION =
  'Describe this image in English for image generation. Example: "a red apple on a wooden table, soft window light, photorealistic". Keep the description concise, within 200 tokens. Output only the description of this image, start directly:';

/** 反推结果 token 上限（2026-08-27 大王裁定：反推提示词须≤生图 prompt 上限 200 token） */
export const CAPTION_MAX_TOKENS = 200;

/** BPE 近似估算（与 ImageGenScreen/constants.estimateTokens 同算法：英文~4字符/token，中文 1字符/token） */
const approxTokens = (t: string): number => {
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of t) {
    if (ch.charCodeAt(0) < 128) {
      ascii++;
    } else {
      nonAscii++;
    }
  }
  return Math.ceil(ascii / 4) + nonAscii;
};

/** 截断到 max token 内（按字符比例截，不超生图 prompt 上限） */
const truncateToTokens = (t: string, max: number): string => {
  if (approxTokens(t) <= max) {
    return t;
  }
  const ratio = max / approxTokens(t);
  return t.slice(0, Math.floor(t.length * ratio)).trimEnd();
};

/** 阶段回调（进度卡阶段文本：加载视觉模型 → 编码图片 → 生成描述） */
export type CaptionStage = 'find' | 'load' | 'encode' | 'generate' | 'done';

export interface CaptionResult {
  text: string | null;
  error: string | null;
}

/** 反推 VLM 候选（本地已下载模型，排除管家/投影/远程） */
export function findCaptionModel(): Model | null {
  return (
    modelStore.models.find(m => {
      if (
        m.origin === ModelOrigin.REMOTE ||
        m.modelType === ModelType.PROJECTION ||
        !m.isDownloaded
      ) {
        return false;
      }
      const name = m.filename || m.name || '';
      return CAPTION_MODEL_RE.test(name) && !isPrompterModelName(name);
    }) ?? null
  );
}

/** 目标模型是否已是当前激活模型（避免重复加载） */
export function isCaptionModelActive(): boolean {
  const active = modelStore.activeModel;
  if (!active) {
    return false;
  }
  const name = active.filename || active.name || '';
  return CAPTION_MODEL_RE.test(name) && !isPrompterModelName(name);
}

/**
 * 执行一次反推：图片路径 → 反推提示词。
 * 失败显式抛错（调用方任务化收口），不静默降级。
 */
export async function runCaption(
  imagePath: string,
  onStage?: (stage: CaptionStage) => void,
): Promise<CaptionResult> {
  // 0. chat 槽互斥：自动释放 prompter/image（懒恢复由后续任务触发）
  await engineMutex.acquire('chat');
  try {
    // 1. 模型就绪
    onStage?.('find');
    if (!isCaptionModelActive()) {
      const model = findCaptionModel();
      if (!model) {
        throw new Error(
          '反推视觉模型未安装（Qwen3.5-4B + mmproj，见 MODEL_MATRIX §1.2）',
        );
      }
      onStage?.('load');
      await modelStore.selectModel(model);
    }
    if (!modelStore.isMultimodalActive) {
      throw new Error('视觉通道未激活（mmproj 配对失败），请检查模型文件');
    }

    // 2. 视觉编码 + 生成（startImageCompletion 内部处理 image_url 转换）
    onStage?.('encode');
    let text = '';
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('反推超时（5 分钟），请重试')),
        5 * 60 * 1000,
      );
      modelStore
        .startImageCompletion({
          prompt: CAPTION_INSTRUCTION,
          image_paths: [imagePath],
          onToken: (token: string) => {
            onStage?.('generate');
            text += token;
          },
          onComplete: (full: string) => {
            clearTimeout(timer);
            if (full) {
              text = full;
            }
            resolve();
          },
          onError: (e: Error) => {
            clearTimeout(timer);
            reject(e);
          },
        })
        .catch(e => {
          clearTimeout(timer);
          reject(e);
        });
    });

    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('反推无输出，请重试');
    }
    onStage?.('done');
    // 2026-08-27 大王裁定：反推结果作为生图提示词须≤200 token——
    // VLM 指令已要求简洁，此处截断兑底保证不超生图 prompt 上限
    return {text: truncateToTokens(trimmed, CAPTION_MAX_TOKENS), error: null};
  } catch (e) {
    return {text: null, error: (e as Error)?.message ?? '反推失败'};
  } finally {
    // 3. 释放 chat 槽（懒恢复：下一条管家/聊天任务自行重载；显式失败不静默）
    try {
      await modelStore.manualReleaseContext();
    } catch (e) {
      console.warn('[captionEngine] release context failed:', e);
    }
    engineMutex.release();
  }
}
