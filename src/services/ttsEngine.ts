/**
 * ttsEngine — 本地文本转音频文件引擎（创作工坊 P2.5，AUDIO_UI_SPEC §4.1）
 *
 * 架构：与 asrEngine 同构（接口层 + native 引擎 sherpa-onnx v1.13.6）。
 *  - 模型：复用 TTSStore 既有三引擎（Kokoro FP32 / Supertonic），模型文件
 *    在 RNFS.DocumentDirectoryPath/tts/{engine}/（播放共用，只读加载）
 *  - native：AudioTts 原生模块（TtsModule，kotlin-api Tts.kt OfflineTts）
 *    → synthesizeToFile 合成 wav → 产物落盘 AIOS/audio/output/（共享存储）
 *  - 引擎范围：kokoro / supertonic（kitten 为 fork 内置 NPZ 音色，与
 *    sherpa-onnx voices bin 格式不兼容，不列入生成引擎）
 *
 * 锋利原则：模型缺失/引擎未就绪 → 显式报错（调用方任务化收口），无兜底降级。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {NativeModules, Platform} from 'react-native';
import {AIOS_ROOT} from '../utils/paths';

const AudioTts = NativeModules.AudioTts;

/** 生成引擎标识（B34：kitten 加入生成链路——HyperOS 配额内唯一可跑的轻量引擎） */
export type TtsGenEngineId = 'kokoro' | 'supertonic' | 'kitten';

/** 生成引擎 → 模型目录（App 文档目录，与 TTSStore 引擎路径一致） */
export const TTS_MODEL_DIRS: Record<TtsGenEngineId, string> = {
  kokoro: `${RNFS.DocumentDirectoryPath}/tts/kokoro`,
  supertonic: `${RNFS.DocumentDirectoryPath}/tts/supertonic`,
  kitten: `${RNFS.DocumentDirectoryPath}/tts/kitten`,
};

/** 合成产物目录（AIOS 共享存储，用户可见可管理） */
export const TTS_OUTPUT_DIR = `${AIOS_ROOT}/audio/output`;

/** 引擎就绪态（懒探测：so 可加载 + NativeModule 存在） */
let nativeReady: boolean | null = null;

/** 探测原生 TTS 引擎就绪（首次调用缓存） */
export async function isTtsNativeReady(): Promise<boolean> {
  if (nativeReady !== null) {
    return nativeReady;
  }
  if (!AudioTts) {
    nativeReady = false;
    return false;
  }
  try {
    nativeReady = (await AudioTts.isReady()) === true;
  } catch (e) {
    console.warn('[ttsEngine] native ready check failed:', e);
    nativeReady = false;
  }
  return nativeReady;
}

/** 生成核心文件是否齐备（与 TTSStore downloadState==='ready' 语义对齐） */
export async function isTtsGenInstalled(
  engine: TtsGenEngineId,
): Promise<boolean> {
  try {
    const dir = TTS_MODEL_DIRS[engine];
    const core =
      engine === 'kokoro'
        ? // B36：sherpa 生成链路用 tokens.txt（tokenizer.json 保留给 fork 播放链路）
          // B38a：生成链模型必须是 model_fp32_sherpa.onnx（补 sherpa metadata 版）——
          // model_fp32.onnx 缺 metadata 会 native crash（TtsModule kokoroConfig 同改）
          ['model_fp32_sherpa.onnx', 'tokens.txt']
        : engine === 'supertonic'
          ? [
              'duration_predictor.onnx',
              'text_encoder.onnx',
              'vector_estimator.onnx',
              'vocoder.onnx',
              // B36：sherpa 要求 int32 二进制 .bin（json 保留给 fork 播放链路）
              'unicode_indexer.bin',
            ]
          : // B34：kitten 分支（此前落到 supertonic 检查恒 false → 「模型未安装完整」）
            // B36：kitten_sherpa.onnx 为 sherpa 官方模型（palshub 0.8 输出纯噪声，弃用）
            ['kitten_sherpa.onnx', 'tokens.txt'];
    if (!(await RNFS.exists(dir))) {
      return false;
    }
    for (const f of core) {
      if (!(await RNFS.exists(`${dir}/${f}`))) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export interface TtsSynthOptions {
  /** 语速 0.5–2.0（默认 1.0） */
  speed?: number;
  /** Supertonic 推理步数（1|2|3|5|10|20，kokoro 忽略） */
  numSteps?: number;
  /** 阶段进度回调（加载模型 → 合成中 → 完成） */
  onStage?: (stage: string) => void;
}

/**
 * 非拉丁字符集（B38b）：kokoro/kitten 当前仅挂英文音色（voices.ts v1b 范围，
 * 中文 z_ 音色未接入），中文/日文/韩文/全角等文本会被 en-us 音素器按英文规则
 * 朗读（用户可闻的「英文读中文」）。锋利原则：显式失败不产出听不懂的产物——
 * 检测到非拉丁文本直接报错，提示语言边界；supertonic 为 31 语言多语言模型不拦截。
 */
const NON_LATIN_RE =
  /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef\u0400-\u04ff\u0600-\u06ff]/;

/**
 * 合成文本为 wav 文件（整段非流式）。
 *
 * @returns 产物绝对路径（AIOS/audio/output/tts_{ts}.wav）
 */
export async function synthesizeToFile(
  engine: TtsGenEngineId,
  text: string,
  voiceId: string,
  opts: TtsSynthOptions = {},
): Promise<string> {
  if (!(await isTtsNativeReady())) {
    throw new Error('TTS 原生引擎不可用');
  }
  if (!(await isTtsGenInstalled(engine))) {
    throw new Error(`${engine} 模型未安装完整`);
  }
  // B38b：kokoro/kitten 英文音色集——非拉丁文本显式拒绝，避免产出英文音素读中文
  if ((engine === 'kokoro' || engine === 'kitten') && NON_LATIN_RE.test(text)) {
    throw new Error(`${engine} 引擎当前仅支持英文文本（中文等音色接入规划中）`);
  }
  if (Platform.OS !== 'android') {
    throw new Error('生成音频文件仅支持 Android');
  }
  opts.onStage?.('加载语音模型…');
  if (!(await RNFS.exists(TTS_OUTPUT_DIR))) {
    await RNFS.mkdir(TTS_OUTPUT_DIR);
  }
  const outPath = `${TTS_OUTPUT_DIR}/tts_${Date.now()}.wav`;
  opts.onStage?.('合成中…');
  await AudioTts.synthesizeToFile(
    engine,
    text,
    voiceId,
    opts.speed ?? 1.0,
    opts.numSteps ?? 5,
    TTS_MODEL_DIRS[engine],
    outPath,
  );
  return outPath;
}

/**
 * 播放合成产物 wav（MediaPlayer；prepare 完成即 resolve 总时长 ms——
 * B38 播放器预览窗口：异步播放不阻塞，暂停/续播/跳播/位置轮询用下述接口）。
 *
 * @param path 产物绝对路径（AIOS/audio/output/…）
 * @returns 总时长 ms
 */
export async function playTtsFile(path: string): Promise<number> {
  if (!AudioTts) {
    throw new Error('TTS 原生引擎不可用');
  }
  return (await AudioTts.playFile(path)) as number;
}

/** 播放位置/总时长/播放态（B38：JS 500ms 轮询驱动时间轴） */
export interface TtsPlayState {
  position: number;
  duration: number;
  isPlaying: boolean;
}

export async function getPlayPosition(): Promise<TtsPlayState> {
  if (!AudioTts) {
    return {position: 0, duration: 0, isPlaying: false};
  }
  return (await AudioTts.getPlayPosition()) as TtsPlayState;
}

/** 跳播（ms，幂等） */
export async function seekPlayFile(ms: number): Promise<void> {
  if (!AudioTts) {
    return;
  }
  await AudioTts.seekPlayFile(ms);
}

/** 暂停（幂等） */
export async function pausePlayFile(): Promise<void> {
  if (!AudioTts) {
    return;
  }
  await AudioTts.pausePlayFile();
}

/** 续播（幂等） */
export async function resumePlayFile(): Promise<void> {
  if (!AudioTts) {
    return;
  }
  await AudioTts.resumePlayFile();
}

/** 停止产物播放（幂等） */
export async function stopTtsPlay(): Promise<void> {
  if (!AudioTts) {
    return;
  }
  try {
    await AudioTts.stopPlay();
  } catch {
    // 幂等：停止失败不抛
  }
}
