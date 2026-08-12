/**
 * chatImageTask — 聊天内联生图任务 runner（豆包式闭环的核心执行器）
 *
 * 单一入口 runInlineImageTask(prompt)：
 *   1. 引擎未加载 → 从 manifest 选第一个可用模型 → 解析伴侣文件 → 加载
 *   2. 出图（进度由 imageGenStore → engineStatus 驱动 ActiveTaskBanner）
 *   3. 返回 {uri, error}，由 ChatScreen 决定插入图片消息或错误消息
 *
 * 锋利原则：不跳转页面、不静默失败；加载/出图全程在聊天窗口可见。
 */
import {imageGenStore} from '../store/imageGenStore';
import {
  listAvailableModels,
  resolveCompanions,
  ImageGenManifest,
} from '../utils/imageGenManifest';
import {AIOS_MODELS_DIR} from '../utils/paths';
import {promptWriter} from './promptWriter';

export interface InlineImageResult {
  uri: string | null;
  error: string | null;
  /** 出图使用的 manifest（供上层展示模型名） */
  manifest: ImageGenManifest | null;
}

export async function runInlineImageTask(
  prompt: string,
): Promise<InlineImageResult> {
  // 0. 提示词增强：管家模型就绪时，把中文描述扩写成英文 SD 提示词（提质）。
  //    失败/未就绪不阻断出图，回退原始 prompt。
  let sdPrompt = prompt;
  try {
    if (promptWriter.isLoaded) {
      const enhanced = await promptWriter.writePrompt(prompt);
      if (enhanced) {
        sdPrompt = enhanced;
      }
    }
  } catch {
    // 增强失败静默回退
  }

  // 1. 确保引擎加载
  if (!imageGenStore.modelLoaded) {
    const available = await listAvailableModels(AIOS_MODELS_DIR);
    if (available.length === 0) {
      return {
        uri: null,
        error: '未找到可用的生图模型，请前往生图页下载',
        manifest: null,
      };
    }
    const {manifest, mainPath} = available[0];
    const {extras, missing} = await resolveCompanions(
      manifest,
      AIOS_MODELS_DIR,
    );
    if (missing.length > 0) {
      return {
        uri: null,
        error: `模型缺少文件：${missing.join(', ')}`,
        manifest,
      };
    }
    const ok = await imageGenStore.loadModel(mainPath, extras);
    if (!ok) {
      return {
        uri: null,
        error: imageGenStore.error ?? '生图引擎加载失败',
        manifest,
      };
    }
    return generateWith(sdPrompt, manifest);
  }

  // 已加载：用已加载模型直接出图（默认参数兜底）
  return generateWith(sdPrompt, null);
}

async function generateWith(
  prompt: string,
  manifest: ImageGenManifest | null,
): Promise<InlineImageResult> {
  const d = manifest?.defaults;
  const uri = await imageGenStore.generate(prompt, {
    steps: d?.steps,
    cfg: d?.cfg,
    width: d?.size,
    height: d?.size,
  });
  if (!uri) {
    return {
      uri: null,
      error: imageGenStore.error ?? '出图失败',
      manifest,
    };
  }
  return {uri, error: null, manifest};
}
