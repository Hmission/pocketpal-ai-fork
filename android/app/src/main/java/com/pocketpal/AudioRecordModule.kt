package com.pocketpal

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread

/**
 * AudioRecordModule — 本地录音（B33：工坊录音转写 / 聊天页本地 ASR 共用输入源）。
 *
 * AudioRecord 直采 PCM16 16kHz mono（sherpa-onnx 标准输入）→ 手写 WAV 头落盘
 * cacheDir/audio_record/（MediaRecorder 不支持 wav 容器，故走 PCM 直写）。
 * RECORD_AUDIO 权限 manifest 已声明，JS 侧 PermissionAndroid 先行申请。
 *
 * v2.4（PHONE_SPEC §14.2）：读块循环内顺带算 **RMS 能量**并以 `AudioLevel` 事件
 * 回传 JS（≥50ms 节流）——供通话页真实振幅波形与 VAD 观测 spike 使用。
 * 事件范式沿用本仓 DownloadModule（getJSModule(RCTDeviceEventEmitter).emit），
 * 不引第三方。**能量计算不得阻塞写盘线程**：单次 O(n) 扫自 buffer，无额外 IO。
 */
class AudioRecordModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule() {

  companion object {
    /** JS 侧订阅的事件名（与 src/services/phoneCall/audioLevel.ts 同步） */
    const val EVENT_AUDIO_LEVEL = "AudioLevel"
    /** 事件节流间隔：20Hz 足够驱动波形，且不溢事件队列 */
    private const val LEVEL_INTERVAL_MS = 50L
  }

  private var audioRecord: AudioRecord? = null
  private var recorderThread: Thread? = null
  private var outputPath: String? = null
  @Volatile
  private var recording = false

  override fun getName(): String = "AudioRecord"

  @ReactMethod
  fun startRecording(promise: Promise) {
    if (recording) {
      promise.resolve(outputPath)
      return
    }
    val sampleRate = 16000
    val minBuf = AudioRecord.getMinBufferSize(
        sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (minBuf <= 0) {
      promise.reject("AUDIO_RECORD_INIT_FAIL", "getMinBufferSize 失败")
      return
    }
    val rec = try {
      AudioRecord(
          MediaRecorder.AudioSource.MIC,
          sampleRate,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT,
          minBuf * 2)
    } catch (e: Exception) {
      promise.reject("AUDIO_RECORD_INIT_FAIL", e.message ?: "AudioRecord 初始化失败")
      return
    }
    if (rec.state != AudioRecord.STATE_INITIALIZED) {
      rec.release()
      promise.reject("AUDIO_RECORD_INIT_FAIL", "AudioRecord 未就绪（录音权限被拒？）")
      return
    }
    val dir = File(reactContext.cacheDir, "audio_record")
    if (!dir.exists()) {
      dir.mkdirs()
    }
    val outFile = File(dir, "record_${System.currentTimeMillis()}.wav")
    val fos = try {
      FileOutputStream(outFile)
    } catch (e: Exception) {
      rec.release()
      promise.reject("AUDIO_RECORD_IO_FAIL", e.message ?: "无法创建输出文件")
      return
    }
    // 预留 44 字节 WAV 头，停录时回填
    fos.write(ByteArray(44))
    recording = true
    audioRecord = rec
    outputPath = outFile.absolutePath
    rec.startRecording()
    val buffer = ShortArray(minBuf / 2)
    var lastLevelAt = 0L
    recorderThread = thread {
      while (recording) {
        val n = rec.read(buffer, 0, buffer.size)
        if (n > 0) {
          try {
            val bytes = ByteBuffer.allocate(n * 2).order(ByteOrder.LITTLE_ENDIAN)
            for (i in 0 until n) {
              bytes.putShort(buffer[i])
            }
            fos.write(bytes.array())
          } catch (e: Exception) {
            break
          }
          // 真实振幅回传（v2.4）：RMS 归一化 0..1，50ms 节流
          val now = System.currentTimeMillis()
          if (now - lastLevelAt >= LEVEL_INTERVAL_MS) {
            lastLevelAt = now
            var sumSq = 0.0
            for (i in 0 until n) {
              val v = buffer[i].toDouble() / 32768.0
              sumSq += v * v
            }
            val rms = Math.sqrt(sumSq / n)
            try {
              val params = Arguments.createMap()
              params.putDouble("level", rms)
              params.putDouble("ts", now.toDouble())
              reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_AUDIO_LEVEL, params)
            } catch (_: Exception) {
              // 事件发送失败不影响录音主链（JS 侧退化为静态柱，不造假波形）
            }
          }
        }
      }
      try {
        fos.flush()
        fos.close()
      } catch (_: Exception) {
      }
      // 回填 WAV 头（失败则保留占位头，文件仍可被解码器按数据块读取）
      try {
        val dataSize = outFile.length() - 44
        val raf = RandomAccessFile(outFile, "rw")
        raf.seek(0)
        raf.write("RIFF".toByteArray())
        raf.write(intLe((36 + dataSize).toInt()))
        raf.write("WAVE".toByteArray())
        raf.write("fmt ".toByteArray())
        raf.write(intLe(16))
        raf.write(shortLe(1)) // PCM
        raf.write(shortLe(1)) // mono
        raf.write(intLe(16000))
        raf.write(intLe(32000)) // byte rate
        raf.write(shortLe(2)) // block align
        raf.write(shortLe(16)) // bits per sample
        raf.write("data".toByteArray())
        raf.write(intLe(dataSize.toInt()))
        raf.close()
      } catch (_: Exception) {
      }
    }
    promise.resolve(outFile.absolutePath)
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    if (!recording) {
      promise.resolve(outputPath)
      return
    }
    recording = false
    val rec = audioRecord
    try {
      rec?.stop()
    } catch (_: Exception) {
    }
    try {
      rec?.release()
    } catch (_: Exception) {
    }
    try {
      recorderThread?.join(1500)
    } catch (_: Exception) {
    }
    audioRecord = null
    promise.resolve(outputPath)
  }

  @ReactMethod
  fun isRecording(promise: Promise) {
    promise.resolve(recording)
  }

  private fun intLe(v: Int): ByteArray = byteArrayOf(
      (v and 0xFF).toByte(),
      ((v shr 8) and 0xFF).toByte(),
      ((v shr 16) and 0xFF).toByte(),
      ((v shr 24) and 0xFF).toByte())

  private fun shortLe(v: Int): ByteArray = byteArrayOf(
      (v and 0xFF).toByte(),
      ((v shr 8) and 0xFF).toByte())
}
