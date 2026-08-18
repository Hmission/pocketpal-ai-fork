package com.pocketpal

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * ScreenReaderModule — 只读读屏 RN 桥（SCREENWATCH_SPEC v1，P11）。
 *
 * JS 侧消费：isServiceEnabled / readScreen / openAccessibilitySettings。
 * 未启用服务时 readScreen reject SCREEN_READER_DISABLED（显式引导，不静默）。
 */
class ScreenReaderModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ScreenReader"

  /** 无障碍服务是否已启用（查 Settings.Secure 已启用服务列表） */
  @ReactMethod
  fun isServiceEnabled(promise: Promise) {
    try {
      val enabled = Settings.Secure.getString(
        reactApplicationContext.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: ""
      val cn = ComponentName(
        reactApplicationContext,
        ScreenReaderService::class.java,
      )
      promise.resolve(enabled.split(':').any { it.equals(cn.flattenToString(), ignoreCase = true) })
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /** 读取当前屏幕 a11y 精简树（现场重抓） */
  @ReactMethod
  fun readScreen(promise: Promise) {
    try {
      val enabled = Settings.Secure.getString(
        reactApplicationContext.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: ""
      val cn = ComponentName(
        reactApplicationContext,
        ScreenReaderService::class.java,
      )
      if (!enabled.split(':').any { it.equals(cn.flattenToString(), ignoreCase = true) }) {
        promise.reject("SCREEN_READER_DISABLED", "读屏服务未开启，请到系统无障碍设置中打开")
        return
      }
      val tree = ScreenReaderStore.currentTree()
      promise.resolve(tree)
    } catch (e: Exception) {
      promise.reject("SCREEN_READER_ERROR", e.message ?: "读屏失败")
    }
  }

  /** 跳转系统无障碍设置页（用户手动开启服务，App 不代授） */
  @ReactMethod
  fun openAccessibilitySettings() {
    try {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    } catch (e: Exception) {
      // 跳转失败不阻断（用户可手动进设置）
    }
  }
}
