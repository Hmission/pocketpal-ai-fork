/**
 * asrEngine — 本地语音转文字引擎（音频工坊 P2，AUDIO_UI_SPEC §3）
 *
 * 架构：接口层 + 模型下载管理 + native 引擎（sherpa-onnx v1.13.6）。
 *  - 模型：SenseVoice int8（229MB，中英日韩粤+标点），落盘 AIOS/audio/
 *  - native：sherpa-onnx 官方 android 包本地集成（jniLibs .so + kotlin-api）
 *    → AsrModule（与 ImageGenModule 同构）；RN wrapper 官方 registry 实勘
 *    不可用（镜像源私有包），2026-08-21 实锤弃用改官方包直集。
 *
 * 锋利原则：模型缺失/引擎未就绪/非 wav 输入 → 显式报错（调用方任务化收口），
 * 无兜底降级。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {NativeModules} from 'react-native';
import {AIOS_MODELS_DIR} from '../utils/paths';

/** SenseVoice 模型包目录（sherpa-onnx 模型包结构） */
export const SENSEVOICE_DIR = `${AIOS_MODELS_DIR}/audio/sense-voice-zh-en-ja-ko-yue`;

/**
 * SenseVoice int8 模型文件（作者 csukuangfj 官方仓库，2026-08-21 实校准：
 * k2-fsa/sherpa-onnx-models 仓库仅 ascend-npu 专用包，无 CPU 散包；
 * 正确仓库 csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17
 * 含 model.int8.onnx + tokens.txt，无 config.yaml）。
 */
export const SENSEVOICE_FILES = ['model.int8.onnx', 'tokens.txt'] as const;

// 国内镜像（hf-mirror.com，2026-08-21 实测直连可达；HF 官方域名被墙）
const MODEL_BASE_URL =
  'https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main';

const AudioAsr = NativeModules.AudioAsr;

/** 引擎就绪态（懒探测：so 可加载 + NativeModule 存在） */
let nativeReady: boolean | null = null;

/** 探测原生 ASR 引擎就绪（首次调用缓存；失败显式抛错） */
export async function isAsrNativeReady(): Promise<boolean> {
  if (nativeReady !== null) {
    return nativeReady;
  }
  if (!AudioAsr) {
    nativeReady = false;
    return false;
  }
  try {
    nativeReady = (await AudioAsr.isReady()) === true;
  } catch (e) {
    console.warn('[asrEngine] native ready check failed:', e);
    nativeReady = false;
  }
  return nativeReady;
}

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
 * content:// uri → 本地文件路径（DocumentPicker 返回 content uri，
 * 原生引擎只收文件路径；拷贝到应用缓存目录后返回绝对路径）。
 * file:// 与绝对路径直接透传。
 */
export async function resolveAudioPath(uri: string): Promise<string> {
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  if (uri.startsWith('content://')) {
    // 先 decode 再取 basename：content uri 路径片段里斜杠被编码，
    // decode 后会出现 '/'（如 primary:Download/test.wav），直接做文件名会
    // 生成非法目标路径（ENOENT）——2026-08-21 真机实证
    const raw = (uri.split('/').pop() ?? 'input.wav').split('?')[0] ?? '';
    const fileName = decodeURIComponent(raw).split('/').pop() ?? 'input.wav';
    const safeName = fileName.replace(/[/\\:]/g, '_');
    const dest = `${RNFS.CachesDirectoryPath}/asr_${Date.now()}_${safeName}`;
    const ok = await AudioAsr.copyContentUri(uri, dest);
    if (ok !== true) {
      throw new Error('拷贝音频失败（content uri 不可读）');
    }
    return dest;
  }
  return uri; // 已是绝对路径
}

/**
 * 转写音频文件 → 文本（wav 16kHz 16-bit PCM）。
 * 原生引擎未就绪/模型缺失/非 wav → 显式抛错（不静默降级）。
 */
export async function transcribeFile(
  audioPath: string,
  onStage?: (stage: string) => void,
): Promise<string> {
  if (!(await isAsrNativeReady())) {
    throw new Error('语音引擎未就绪（ASR 原生接入见 AUDIO_UI_SPEC §3.1）');
  }
  if (!(await isSenseVoiceInstalled())) {
    throw new Error('语音模型未下载（SenseVoice，见 MODEL_MATRIX §2.2 A1）');
  }
  onStage?.('转写中…');
  const text = await AudioAsr.transcribe(audioPath, SENSEVOICE_DIR);
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('转写无输出');
  }
  return text.trim();
}
