package com.pocketpal

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineSenseVoiceModelConfig
import com.k2fsa.sherpa.onnx.WaveReader
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

/**
 * AudioAsr native module (P2 第二阶段, AUDIO_UI_SPEC §3.1):
 * bridges sherpa-onnx v1.13.6 (jniLibs) via kotlin-api — SenseVoice offline ASR.
 *
 * Singleton recognizer: loaded on first transcribe, reused across calls
 * (rebuilt only when model files change). Transcription runs on a single
 * background executor so the JS/UI thread is never blocked.
 * Input contract: wav 16kHz 16-bit PCM mono (WaveReader). Non-wav files are
 * rejected explicitly — no silent fallback (锋利哲学).
 */
class AsrModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AudioAsr"

  private val executor = Executors.newSingleThreadExecutor()
  private var recognizer: OfflineRecognizer? = null
  private var loadedModel = ""
  private var loadedTokens = ""

  /** sherpa-jni so 是否可加载（ASR 原生就绪门）；加载失败显式报错 */
  @ReactMethod
  fun isReady(promise: Promise) {
    try {
      System.loadLibrary("sherpa-onnx-jni")
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("ASR_NOT_READY", "sherpa-onnx jni 不可用: ${e.message}")
    }
  }

  /**
   * 转写 wav 音频 → 文本。
   * 模型路径 = AIOS/audio/sense-voice-zh-en-ja-ko-yue/（JS 侧 asrEngine 落盘后传入）。
   */
  @ReactMethod
  fun transcribe(audioPath: String, modelDir: String, promise: Promise) {
    executor.execute {
      try {
        val wav = File(audioPath)
        if (!wav.exists()) {
          promise.reject("NO_FILE", "音频文件不存在: $audioPath")
          return@execute
        }
        if (!audioPath.lowercase().endsWith(".wav")) {
          promise.reject(
            "UNSUPPORTED_FORMAT",
            "请选择 wav 音频（16kHz，当前: ${audioPath.substringAfterLast('.')}）",
          )
          return@execute
        }

        // 单例：模型文件变化才重建（重复转写复用，不重复加载）
        val rec = getOrCreateRecognizer(modelDir)
        val wave = WaveReader.readWave(audioPath)
        val stream = rec.createStream()
        try {
          stream.acceptWaveform(wave.samples, wave.sampleRate)
          rec.decode(stream)
          val text = rec.getResult(stream).text
          if (text.isBlank()) {
            promise.reject("EMPTY_RESULT", "转写无输出（音频可能无人声或过短）")
          } else {
            promise.resolve(text)
          }
        } finally {
          stream.release()
        }
      } catch (e: Throwable) {
        promise.reject("TRANSCRIBE_FAILED", e.message ?: "转写失败")
      }
    }
  }

  /**
   * content:// uri → 本地文件（DocumentPicker 返回 content uri，
   * sherpa 引擎只收文件路径；拷贝到 destPath 后返回）。
   */
  @ReactMethod
  fun copyContentUri(uri: String, destPath: String, promise: Promise) {
    executor.execute {
      try {
        val resolver = reactApplicationContext.contentResolver
        val input = resolver.openInputStream(Uri.parse(uri))
          ?: throw IllegalStateException("无法打开内容: $uri")
        input.use { ins ->
          FileOutputStream(destPath).use { out -> ins.copyTo(out) }
        }
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject("COPY_FAILED", "拷贝音频失败: ${e.message}")
      }
    }
  }

  private fun getOrCreateRecognizer(modelDir: String): OfflineRecognizer {
    val modelPath = "$modelDir/model.int8.onnx"
    val tokensPath = "$modelDir/tokens.txt"
    val modelFile = File(modelPath)
    val tokensFile = File(tokensPath)
    if (!modelFile.exists() || !tokensFile.exists()) {
      throw IllegalStateException(
        "语音模型未下载完整（SenseVoice: ${modelFile.name}/${tokensFile.name}）",
      )
    }
    val current = recognizer
    if (current != null && loadedModel == modelPath && loadedTokens == tokensPath) {
      return current
    }
    current?.release()

    // SenseVoice 官方配置：非流式、自动语种、greedy_search
    val config = OfflineRecognizerConfig(
      featConfig = FeatureConfig(sampleRate = 16000, featureDim = 80),
      modelConfig = OfflineModelConfig(
        senseVoice = OfflineSenseVoiceModelConfig(
          model = modelPath,
          language = "",
        ),
        modelType = "sense_voice",
        tokens = tokensPath,
        numThreads = 4,
        provider = "cpu",
        debug = false,
      ),
      decodingMethod = "greedy_search",
    )
    val rec = OfflineRecognizer(null, config)
    recognizer = rec
    loadedModel = modelPath
    loadedTokens = tokensPath
    return rec
  }
}
