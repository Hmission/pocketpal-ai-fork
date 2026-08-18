package com.pocketpal

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File

/**
 * ImageGen native module (P5.2): bridges stable-diffusion.cpp via JNI.
 * The JNI implementation lives in src/main/cpp/ImageGenJNI.cpp and is
 * linked into libappmodules.so (see jni/CMakeLists.txt).
 *
 * Engine is a singleton and mutually exclusive with the chat model:
 * loadModel() assumes the chat model has been unloaded (ImageGenStore).
 * Progress is pushed to RN via the "ImageGenProgress" device event.
 */
class ImageGenModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    reactContextRef = reactContext
  }

  override fun getName(): String = "ImageGen"

  private external fun nativeLoadModel(
    modelPath: String, clipLPath: String, clipGPath: String,
    llmPath: String, vaePath: String, backend: String,
  ): Boolean
  private external fun nativeUnloadModel(): Boolean
  private external fun nativeTxt2img(
    prompt: String, negativePrompt: String, seed: Long, steps: Int, cfg: Double,
    width: Int, height: Int, loraPath: String, loraMultiplier: Double, outPath: String,
  ): String

  @ReactMethod
  fun loadModel(modelPath: String, extras: ReadableMap?, promise: Promise) {
    try {
      // backend 透传（manifest defaults 单点决策，本层不决策）
      val ok = nativeLoadModel(
        modelPath,
        extras?.getString("clipL") ?: "",
        extras?.getString("clipG") ?: "",
        extras?.getString("llm") ?: "",
        extras?.getString("vae") ?: "",
        extras?.getString("backend") ?: "",
      )
      promise.resolve(ok)
    } catch (e: Throwable) {
      promise.reject("LOAD_FAILED", e.message)
    }
  }

  @ReactMethod
  fun unloadModel(promise: Promise) {
    try {
      promise.resolve(nativeUnloadModel())
    } catch (e: Throwable) {
      promise.reject("UNLOAD_FAILED", e.message)
    }
  }

  /** 将生成图写入系统相册（MediaStore → Pictures/AIOS），系统图库可见。 */
  @ReactMethod
  fun saveToAlbum(path: String, promise: Promise) {
    try {
      val src = File(path)
      if (!src.exists()) {
        promise.reject("NO_FILE", "source not found: $path")
        return
      }
      val resolver = reactApplicationContext.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, src.name)
        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/AIOS")
          put(MediaStore.Images.Media.IS_PENDING, 1)
        }
      }
      val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        ?: run {
          promise.reject("INSERT_FAILED", "MediaStore insert returned null")
          return
        }
      resolver.openOutputStream(uri)?.use { out -> src.inputStream().use { it.copyTo(out) } }
        ?: run {
          promise.reject("WRITE_FAILED", "cannot open output stream")
          return
        }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
      }
      promise.resolve(uri.toString())
    } catch (e: Throwable) {
      promise.reject("SAVE_FAILED", e.message)
    }
  }

  /**
   * 生成必须异步（08-14 闪崩根治）：曾同步阻塞 mqt_v_native 整个生成周期（分钟级），
   * 同线程的 getGenSnapshot 被排队堵死 → 120s 干净失败从未触发，并引发 ANR 栈转储路径
   * ART 空指针闪崩（SIGSEGV @ DumpJavaStack，设备取证实锤）。
   * 异步后 RN 模块消息队列不阻塞：快照轮询与 hang 判定真正生效。
   * 注意：ReadableMap 不可跨线程读，参数须在调用线程提前提取。
   */
  @ReactMethod
  fun txt2img(params: ReadableMap, promise: Promise) {
    val outPath = params.getString("outPath") ?: ""
    if (outPath.isEmpty()) {
      promise.reject("BAD_ARGS", "outPath required")
      return
    }
    val prompt = params.getString("prompt") ?: ""
    val negativePrompt = params.getString("negativePrompt") ?: ""
    val seed = params.getDouble("seed").toLong()
    val steps = params.getInt("steps")
    // 6.18 白图根因：cfg 键缺失时 getDouble 静默返回 0.0 → SD3.5 CFG 路径数值发散 (latent 全 NaN)。
    // hasKey 防御 + 默认 2.0（RN 桥接偶发丢键，steps 同步打印验证）。
    val cfg = if (params.hasKey("cfg")) params.getDouble("cfg") else 2.0
    android.util.Log.i("ImageGen", "txt2img params: steps=$steps cfg=$cfg width=${params.getInt("width")} height=${params.getInt("height")} cfgHasKey=${params.hasKey("cfg")}")
    val width = params.getInt("width")
    val height = params.getInt("height")
    val loraPath = params.getString("loraPath") ?: ""
    val loraMultiplier = params.getDouble("loraMultiplier")
    Thread {
      try {
        val result = nativeTxt2img(
          prompt, negativePrompt, seed, steps, cfg, width, height,
          loraPath, loraMultiplier, outPath,
        )
        if (result.startsWith("ERR_")) {
          promise.reject(result, result)
        } else {
          promise.resolve(result)
        }
      } catch (e: Throwable) {
        promise.reject("GEN_FAILED", e.message)
      }
    }.start()
  }

  /**
   * 推拉反转（weak-ref 溢出根治）：JNI 回调只写内存快照，不发 bridge 事件；
   * RN 侧以 1Hz 单通道 pull getGenSnapshot()。事件风暴从架构上消失。
   */
  @ReactMethod
  fun getGenSnapshot(promise: Promise) {
    promise.resolve(
      Arguments.createMap().apply {
        putInt("step", snapStep)
        putInt("steps", snapSteps)
        putDouble("time", snapTime.toDouble())
        putString("stage", snapStage)
        putDouble("lastEvent", snapLastEvent.toDouble())
      },
    )
  }

  /** 解码图片→按较大边压缩到 size×size→归一化 RGB[-1,1] 平坦数组（供 DreamLite 编辑 vae_encoder）。 */
  @ReactMethod
  fun decodeImageToRgb(path: String, size: Int, promise: Promise) {
    Thread {
      try {
        val src = BitmapFactory.decodeFile(path) ?: run {
          promise.reject("DECODE_FAIL", "cannot decode $path")
          return@Thread
        }
        val scaled = Bitmap.createScaledBitmap(src, size, size, true)
        val pixels = IntArray(size * size)
        scaled.getPixels(pixels, 0, size, 0, 0, size, size)
        val arr = Arguments.createArray()
        for (p in pixels) {
          arr.pushDouble(((p shr 16 and 0xFF) / 127.5) - 1.0)
          arr.pushDouble(((p shr 8 and 0xFF) / 127.5) - 1.0)
          arr.pushDouble(((p and 0xFF) / 127.5) - 1.0)
        }
        promise.resolve(arr)
      } catch (e: Throwable) {
        promise.reject("DECODE_FAIL", e.message)
      }
    }.start()
  }

  /**
   * 08-18：GPU renderer 探测（EGL pbuffer 查询 GL_RENDERER）。
   * 用于生图模型设备兼容性分级（Z-Image 仅 Adreno 800 系高端可用，740 级灰置）。
   */
  @ReactMethod
  fun getGpuRenderer(promise: Promise) {
    Thread {
      try {
        val egl = android.opengl.EGL14.eglGetDisplay(android.opengl.EGL14.EGL_DEFAULT_DISPLAY)
        val version = IntArray(2)
        android.opengl.EGL14.eglInitialize(egl, version, 0, version, 1)
        val configAttribs = intArrayOf(
          android.opengl.EGL14.EGL_RENDERABLE_TYPE, android.opengl.EGL14.EGL_OPENGL_ES2_BIT,
          android.opengl.EGL14.EGL_SURFACE_TYPE, android.opengl.EGL14.EGL_PBUFFER_BIT,
          android.opengl.EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<android.opengl.EGLConfig>(1)
        val numConfigs = IntArray(1)
        android.opengl.EGL14.eglChooseConfig(egl, configAttribs, 0, configs, 0, 1, numConfigs, 0)
        val ctxAttribs = intArrayOf(android.opengl.EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, android.opengl.EGL14.EGL_NONE)
        val ctx = android.opengl.EGL14.eglCreateContext(egl, configs[0], android.opengl.EGL14.EGL_NO_CONTEXT, ctxAttribs, 0)
        val pbufAttribs = intArrayOf(android.opengl.EGL14.EGL_WIDTH, 1, android.opengl.EGL14.EGL_HEIGHT, 1, android.opengl.EGL14.EGL_NONE)
        val surf = android.opengl.EGL14.eglCreatePbufferSurface(egl, configs[0], pbufAttribs, 0)
        android.opengl.EGL14.eglMakeCurrent(egl, surf, surf, ctx)
        val renderer = android.opengl.GLES20.glGetString(android.opengl.GLES20.GL_RENDERER) ?: ""
        android.opengl.EGL14.eglMakeCurrent(egl, android.opengl.EGL14.EGL_NO_SURFACE, android.opengl.EGL14.EGL_NO_SURFACE, android.opengl.EGL14.EGL_NO_CONTEXT)
        android.opengl.EGL14.eglDestroySurface(egl, surf)
        android.opengl.EGL14.eglDestroyContext(egl, ctx)
        android.opengl.EGL14.eglTerminate(egl)
        promise.resolve(renderer)
      } catch (e: Throwable) {
        promise.resolve("")
      }
    }.start()
  }

  companion object {
    private var reactContextRef: ReactApplicationContext? = null

    // 进度/阶段快照（JNI 后台线程写，RN 1Hz 读）
    @Volatile var snapStep = 0
    @Volatile var snapSteps = 0
    @Volatile var snapTime = 0f
    @Volatile var snapStage = ""
    @Volatile var snapLastEvent = 0L

    /** Called from JNI progress callback —— 只写快照，不发事件。 */
    @JvmStatic
    fun onProgressFromNative(step: Int, steps: Int, time: Float) {
      snapStep = step
      snapSteps = steps
      snapTime = time
      snapLastEvent = System.currentTimeMillis()
    }

    /** Called from JNI log callback —— 只写快照，不发事件。 */
    @JvmStatic
    fun onLogFromNative(level: Int, text: String) {
      snapStage = text
      snapLastEvent = System.currentTimeMillis()
    }
  }
}
