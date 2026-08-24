package com.pocketpal

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * VideoTaskServiceModule — RN 桥接（夜间长任务前台服务控制）
 *
 * JS 侧调用：
 *   NativeModules.VideoTaskService.start()  → 启动前台服务 + WakeLock
 *   NativeModules.VideoTaskService.stop()   → 停止
 *   NativeModules.VideoTaskService.isRunning() → 查询状态
 *
 * 设计：与 AsrModule 同模式（ReactContextBaseJavaModule，免 codegen）。
 */
class VideoTaskServiceModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "VideoTaskService"

  @ReactMethod
  fun start(promise: Promise) {
    try {
      val intent = Intent(reactApplicationContext, VideoTaskService::class.java)
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        reactApplicationContext.startForegroundService(intent)
      } else {
        reactApplicationContext.startService(intent)
      }
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("VIDEO_TASK_START_FAILED", e.message ?: "前台服务启动失败")
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      val intent = Intent(reactApplicationContext, VideoTaskService::class.java)
      reactApplicationContext.stopService(intent)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("VIDEO_TASK_STOP_FAILED", e.message ?: "前台服务停止失败")
    }
  }

  /** 查询前台服务是否运行中（调试用；JS 侧以 nightTaskRegistry.isBusy 为准） */
  @ReactMethod
  fun isRunning(promise: Promise) {
    promise.resolve(VideoTaskService.isRunning)
  }

  /**
   * 是否已忽略电池优化（ONDEVICE_VIDEO §7.1 策略 3）。
   * JS 侧夜间任务启动前查询，未豁免则发起 requestBatteryOptOut 引导。
   */
  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    promise.resolve(isIgnoringOptimizations())
  }

  /**
   * 发起系统「忽略电池优化」弹窗引导（REQUEST_IGNORE_BATTERY_OPTIMIZATIONS）。
   * 隐式 Intent 由系统接管，用户决定授予/拒绝；本方法不等待结果（fire-and-forget），
   * 拒绝不阻断生图主链路（前台服务 + WakeLock 仍生效）。
   */
  @ReactMethod
  fun requestBatteryOptOut(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        // Android 6 以下无电池优化门控，视为已豁免
        promise.resolve(true)
        return
      }
      val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${reactApplicationContext.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Throwable) {
      // 系统弹窗不可用（极少见 ROM）：显式 reject，JS 侧静默降级不阻断主链路
      promise.reject("BATTERY_OPT_OUT_FAILED", e.message ?: "电池优化引导不可用")
    }
  }

  private fun isIgnoringOptimizations(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true
    }
    val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)
  }
}
