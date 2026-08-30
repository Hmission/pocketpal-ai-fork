package com.pocketpal

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKittenModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsSupertonicModelConfig
import android.media.MediaPlayer
import java.util.concurrent.Executors

/**
 * AudioTts native module (AUDIO_UI_SPEC §4.1): bridges sherpa-onnx v1.13.6
 * (jniLibs, 与 AudioAsr 同构) via kotlin-api Tts.kt — OfflineTts 合成 wav 文件。
 *
 * 生成引擎支持范围（模型格式兼容性 2026-08-22 实勘）：
 *  - kokoro：model_fp32.onnx + voices/{id}.bin + tokenizer.json + en-us.bin（sherpa-onnx 原生支持）✓
 *  - supertonic：duration_predictor/text_encoder/vector_estimator/vocoder + unicode_indexer.json
 *    + voices/{id}.json（sherpa-onnx 原生支持）✓
 *  - kitten：fork 内置 NPZ 音色（KITTEN_BUILTIN_VOICES），与 sherpa-onnx 的 voices bin 格式
 *    不兼容 → 不列入生成引擎（播放仍可用）。
 *
 * 单例合成器：按 (engine|voice|modelDir) 键缓存，模型变化才重建；单线程 executor，
 * JS/UI 线程永不阻塞。模型文件与播放引擎共用（TTSStore 下载，只读加载）。
 */
class TtsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AudioTts"

  private val executor = Executors.newSingleThreadExecutor()
  private var tts: OfflineTts? = null
  private var loadedKey = ""
  private val player = MediaPlayer()

  /** sherpa-jni so 是否可加载（TTS 原生就绪门） */
  @ReactMethod
  fun isReady(promise: Promise) {
    try {
      System.loadLibrary("sherpa-onnx-jni")
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("TTS_NOT_READY", "sherpa-onnx jni 不可用: ${e.message}")
    }
  }

  /**
   * 合成文本为 wav 文件（非流式整段合成）。
   *
   * @param engine   kokoro | supertonic
   * @param text     待合成文本
   * @param voiceId  音色 id（kokoro: voices/{id}.bin；supertonic: voices/{id}.bin）
   * @param speed    语速 0.5–2.0（默认 1.0）
   * @param numSteps Supertonic 推理步数（1|2|3|5|10|20，kokoro 忽略）
   * @param modelDir 模型目录（AIOS/…/tts/{engine}/）
   * @param outPath  输出 wav 绝对路径
   * @param lang     kokoro espeak 语言（B38c：en-us/en-gb/cmn，由 JS 按音色映射；其他引擎传空串忽略）
   */
  @ReactMethod
  fun synthesizeToFile(
    engine: String,
    text: String,
    voiceId: String,
    speed: Double,
    numSteps: Int,
    modelDir: String,
    outPath: String,
    lang: String,
    promise: Promise,
  ) {
    executor.execute {
      try {
        val t = getOrCreate(engine, voiceId, modelDir, lang)
        val audio = t.generate(text, 0, speed.toFloat())
        val ok = audio.save(outPath)
        if (ok) {
          promise.resolve(outPath)
        } else {
          promise.reject("SAVE_FAILED", "合成音频写入失败: $outPath")
        }
      } catch (e: Throwable) {
        promise.reject("TTS_FAILED", "合成失败($engine/$voiceId): ${e.message}")
      }
    }
  }

  private fun getOrCreate(
    engine: String,
    voiceId: String,
    modelDir: String,
    lang: String,
  ): OfflineTts {
    val key = "$engine|$voiceId|$modelDir|$lang"
    if (tts != null && loadedKey == key) {
      return tts!!
    }
    tts?.free()
    val config = when (engine) {
      "kokoro" -> kokoroConfig(modelDir, voiceId, lang)
      "supertonic" -> supertonicConfig(modelDir, voiceId)
      "kitten" -> kittenConfig(modelDir)
      else -> throw IllegalArgumentException("不支持的生成引擎: $engine")
    }
    val t = OfflineTts(config = config)
    tts = t
    loadedKey = key
    return t
  }

  private fun kokoroConfig(
    modelDir: String,
    voiceId: String,
    lang: String,
  ): OfflineTtsConfig {
    // B34：sherpa kokoro 的 data_dir 必须指向 espeak-ng-data（Validate 找 phontab）；
    // lexicon 置空——en-us.bin 是 JS phonemizer 的二进制 dict，非 sherpa 文本词典格式。
    // B36：tokens 必须指向 sherpa 文本格式 tokens.txt（tokenizer.json 是 HF 格式，sherpa 不认）
    // B38a：model 必须指向 model_fp32_sherpa.onnx——08-23 实勘 model_fp32.onnx 缺 sherpa
    //   metadata（model_type/sample_rate 等），sherpa kokoro Init 报 "sample_rate does not exist"
    //   后 native crash 整进程消亡（无 Java 栈、恢复后显示「生成中断」，小米13/K90 双机血证）；
    //   model_fp32_sherpa.onnx 为补 metadata 版（.tmp/tts_diag/kokoro_fix.py 生成，真机合成已验证）。
    // B38c：lang 由 JS 按音色映射（zh→cmn / en→en-us / en-GB→en-gb）——语音 bin 风格与音素语言一致。
    val model = OfflineTtsKokoroModelConfig(
      model = "$modelDir/model_fp32_sherpa.onnx",
      voices = "$modelDir/voices/$voiceId.bin",
      tokens = "$modelDir/tokens.txt",
      dataDir = "$modelDir/espeak-ng-data",
      lang = lang,
    )
    return OfflineTtsConfig(
      model = OfflineTtsModelConfig(
        kokoro = model,
        numThreads = 4,
        debug = false,
        provider = "cpu",
      ),
    )
  }

  private fun kittenConfig(modelDir: String): OfflineTtsConfig {
    // B34：Kitten（57MB 轻量）——HyperOS 配额内唯一可跑的 TTS 引擎（kokoro/supertonic 加载峰值被杀）
    // tokens.txt 取自 sherpa 官方 kitten-nano-en-v0_1 包（Validate 必填 --kitten-tokens）
    // B36：kitten_sherpa.onnx 为 sherpa 官方 kitten-nano-en-v0_1 模型（palshub 0.8 模型输出纯噪声，
    // 已用 onnxruntime 直推验证；官方模型另存新名，避免破坏 fork 播放链路使用的 kitten.onnx）
    val model = OfflineTtsKittenModelConfig(
      model = "$modelDir/kitten_sherpa.onnx",
      // B34：voices.bin（8192B = 8×256×fp32）取自 sherpa 官方 kitten 包——sherpa 认 bin 不认 manifest
      voices = "$modelDir/voices.bin",
      tokens = "$modelDir/tokens.txt",
      // B34：sherpa kitten 的 data_dir 同样必须指向 espeak-ng-data（Validate 找 phontab）
      dataDir = "$modelDir/espeak-ng-data",
    )
    return OfflineTtsConfig(
      model = OfflineTtsModelConfig(
        kitten = model,
        numThreads = 4,
        debug = false,
        provider = "cpu",
      ),
    )
  }

  private fun supertonicConfig(modelDir: String, voiceId: String): OfflineTtsConfig {
    val model = OfflineTtsSupertonicModelConfig(
      durationPredictor = "$modelDir/duration_predictor.onnx",
      textEncoder = "$modelDir/text_encoder.onnx",
      vectorEstimator = "$modelDir/vector_estimator.onnx",
      vocoder = "$modelDir/vocoder.onnx",
      // B34：tts.json（模型描述）为 sherpa Validate 必填（缺它报 "exactly one tts model"）
      ttsJson = "$modelDir/tts.json",
      // B36：sherpa 1.13.x 要求 unicode_indexer 为 int32 二进制 .bin（HF 原始 JSON 不认，
      // 已由下载链路转换落盘）；voice style 同理由 JSON 转二进制 .bin
      unicodeIndexer = "$modelDir/unicode_indexer.bin",
      voiceStyle = "$modelDir/$voiceId.bin",
    )
    return OfflineTtsConfig(
      model = OfflineTtsModelConfig(
        supertonic = model,
        numThreads = 4,
        debug = false,
        provider = "cpu",
      ),
    )
  }

  /** 播放合成产物 wav（MediaPlayer；prepare 完成即 resolve 时长 ms——B38 播放器预览窗口异步播放，
   *  不再阻塞等播完；暂停/续播/跳播/位置轮询由下述方法控制） */
  @ReactMethod
  fun playFile(path: String, promise: Promise) {
    executor.execute {
      try {
        val f = java.io.File(path)
        if (!f.exists()) {
          promise.reject("NO_FILE", "音频文件不存在: $path")
          return@execute
        }
        player.reset()
        player.setDataSource(path)
        player.prepare()
        val durationMs = player.duration.toLong()
        player.start()
        promise.resolve(durationMs.toDouble())
      } catch (e: Throwable) {
        promise.reject("PLAY_FAILED", "播放失败: ${e.message}")
      }
    }
  }

  /** 播放位置/总时长/播放态（B38：JS 500ms 轮询驱动时间轴） */
  @ReactMethod
  fun getPlayPosition(promise: Promise) {
    executor.execute {
      try {
        val map = Arguments.createMap()
        map.putDouble("position", player.currentPosition.toDouble())
        map.putDouble("duration", player.duration.toDouble())
        map.putBoolean("isPlaying", player.isPlaying)
        promise.resolve(map)
      } catch (e: Throwable) {
        promise.reject("POS_FAILED", "读取播放位置失败: ${e.message}")
      }
    }
  }

  /** 跳播（ms；MediaPlayer 天然支持 wav seek，幂等） */
  @ReactMethod
  fun seekPlayFile(ms: Double, promise: Promise) {
    executor.execute {
      try {
        player.seekTo(ms.toInt())
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.resolve(true)
      }
    }
  }

  /** 暂停（幂等） */
  @ReactMethod
  fun pausePlayFile(promise: Promise) {
    executor.execute {
      try {
        if (player.isPlaying) {
          player.pause()
        }
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.resolve(true)
      }
    }
  }

  /** 续播（幂等） */
  @ReactMethod
  fun resumePlayFile(promise: Promise) {
    executor.execute {
      try {
        if (!player.isPlaying) {
          player.start()
        }
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.resolve(true)
      }
    }
  }

  /** 停止产物播放（幂等，未在播放时也安全） */
  @ReactMethod
  fun stopPlay(promise: Promise) {
    executor.execute {
      try {
        if (player.isPlaying) {
          player.stop()
        }
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.resolve(true) // 停止失败不阻断（幂等）
      }
    }
  }
}
