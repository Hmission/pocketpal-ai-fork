package com.pocketpal

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

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

  private external fun nativeLoadModel(modelPath: String): Boolean
  private external fun nativeUnloadModel(): Boolean
  private external fun nativeTxt2img(
    prompt: String, negativePrompt: String, seed: Long, steps: Int, cfg: Double,
    width: Int, height: Int, outPath: String,
  ): String

  @ReactMethod
  fun loadModel(modelPath: String, promise: Promise) {
    try {
      val ok = nativeLoadModel(modelPath)
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
    fun onProgressFromNative(step: Int, steps: Int) {
      val ctx = reactContextRef ?: return
      val args = Arguments.createMap().apply {
        putInt("step", step)
        putInt("steps", steps)
      }
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("ImageGenProgress", args)
    }
  }
}
