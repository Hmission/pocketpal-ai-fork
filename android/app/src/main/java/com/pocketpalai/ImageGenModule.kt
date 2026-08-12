package com.pocketpal

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
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
    llmPath: String, vaePath: String,
  ): Boolean
  private external fun nativeUnloadModel(): Boolean
  private external fun nativeTxt2img(
    prompt: String, negativePrompt: String, seed: Long, steps: Int, cfg: Double,
    width: Int, height: Int, outPath: String,
  ): String

  @ReactMethod
  fun loadModel(modelPath: String, extras: ReadableMap?, promise: Promise) {
    try {
      val ok = nativeLoadModel(
        modelPath,
        extras?.getString("clipL") ?: "",
        extras?.getString("clipG") ?: "",
        extras?.getString("llm") ?: "",
        extras?.getString("vae") ?: "",
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

  @ReactMethod
  fun txt2img(params: ReadableMap, promise: Promise) {
    try {
      val outPath = params.getString("outPath") ?: ""
      if (outPath.isEmpty()) {
        promise.reject("BAD_ARGS", "outPath required")
        return
      }
      val result = nativeTxt2img(
        params.getString("prompt") ?: "",
        params.getString("negativePrompt") ?: "",
        params.getDouble("seed").toLong(),
        params.getInt("steps"),
        params.getDouble("cfg"),
        params.getInt("width"),
        params.getInt("height"),
        outPath,
      )
      if (result.startsWith("ERR_")) {
        promise.reject(result, result)
      } else {
        promise.resolve(result)
      }
    } catch (e: Throwable) {
      promise.reject("GEN_FAILED", e.message)
    }
  }

  companion object {
    private var reactContextRef: ReactApplicationContext? = null

    /** Called from JNI progress callback (sd_set_progress_callback). */
    @JvmStatic
    fun onProgressFromNative(step: Int, steps: Int, time: Float) {
      val ctx = reactContextRef ?: return
      val args = Arguments.createMap().apply {
        putInt("step", step)
        putInt("steps", steps)
        putDouble("time", time.toDouble())
      }
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("ImageGenProgress", args)
    }

    /** Called from JNI log callback (sd_set_log_callback)，阶段日志透传。 */
    @JvmStatic
    fun onLogFromNative(level: Int, text: String) {
      val ctx = reactContextRef ?: return
      val args = Arguments.createMap().apply {
        putInt("level", level)
        putString("text", text)
      }
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("ImageGenLog", args)
    }
  }
}
