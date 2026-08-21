/**
 * asrEngine — 本地语音转文字引擎（音频工坊 P2，AUDIO_UI_SPEC §3）
 *
 * 架构：接口层 + 模型下载管理 + native 引擎可插拔接入点。
 *  - 模型：SenseVoice int8（229MB，中英日韩粤+标点），落盘 AIOS/audio/
 *  - native：sherpa-onnx RN wrapper 官方 registry 不可用（镜像源私有包，
 *    2026-08-21 实勘），原生接入登记 P2 第二阶段（自写 NativeModule 与
 *    ImageGenModule 同构）；接口就位前显式失败「语音引擎未就绪」，不静默。
 *
 * 锋利原则：模型缺失/引擎未就绪 → 显式报错（调用方任务化收口），无兜底降级。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_MODELS_DIR} from '../utils/paths';

/** SenseVoice 模型包目录（sherpa-onnx 模型包结构） */
export const SENSEVOICE_DIR = `${AIOS_MODELS_DIR}/audio/sense-voice-zh-en-ja-ko-yue`;

/**
 * SenseVoice int8 模型文件（HF k2-fsa/sherpa-onnx-models 镜像）。
 * 下载 URL 为 P2 第二阶段真机校准点（包结构/文件名以 sherpa-onnx 官方模型包为准）。
 */
export const SENSEVOICE_FILES = [
  'model.int8.onnx',
  'tokens.txt',
  'config.yaml',
] as const;

const MODEL_BASE_URL =
  'https://huggingface.co/k2-fsa/sherpa-onnx-models/resolve/main/asr/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17';

/** 引擎就绪态（native 接入前恒 false；接入点见 AUDIO_UI_SPEC §3.1） */
let nativeReady = false;

/** 模型文件是否齐备（目录存在 + 核心文件在） */
export async function isSenseVoiceInstalled(): Promise<boolean> {
  try {
    const ok = await RNFS.exists(SENSEVOICE_DIR);
    if (!ok) {
      return false;
    }
    for (const f of SENSEVOICE_FILES) {
      if (!(await RNFS.exists(`${SENSEVOICE_DIR}/${f}`))) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** 下载 SenseVoice 模型包（App 内下载，与 TTSStore 下载状态机同构简化版） */
export async function downloadSenseVoice(
  onProgress?: (pct: number) => void,
): Promise<void> {
  await RNFS.mkdir(SENSEVOICE_DIR);
  const total = SENSEVOICE_FILES.length;
  let done = 0;
  for (const f of SENSEVOICE_FILES) {
    await RNFS.downloadFile({
      fromUrl: `${MODEL_BASE_URL}/${f}`,
      toFile: `${SENSEVOICE_DIR}/${f}`,
      progress: res => {
        if (res.bytesWritten > 0 && res.contentLength > 0) {
          onProgress?.(
            Math.round(
              ((done + res.bytesWritten / res.contentLength) / total) * 100,
            ),
          );
        }
      },
    }).promise;
    done += 1;
    onProgress?.(Math.round((done / total) * 100));
  }
}

/**
 * 转写音频文件 → 文本。
 * native 引擎就绪前显式失败（不静默降级）；引擎接入后此函数为唯一调用点。
 */
export async function transcribeFile(
  audioPath: string,
  onStage?: (stage: string) => void,
): Promise<string> {
  if (!nativeReady) {
    throw new Error('语音引擎未就绪（ASR 原生接入见 AUDIO_UI_SPEC §3.1）');
  }
  if (!(await isSenseVoiceInstalled())) {
    throw new Error('语音模型未下载（SenseVoice，见 MODEL_MATRIX §2.2 A1）');
  }
  // P2 第二阶段：native 转写调用点（sherpa-onnx NativeModule 自写接入，
  // 与 ImageGenModule 同构；接入前此分支不可达——nativeReady 恒 false）
  onStage?.('转写中…');
  void audioPath;
  throw new Error('语音引擎未就绪（ASR 原生接入见 AUDIO_UI_SPEC §3.1）');
}
