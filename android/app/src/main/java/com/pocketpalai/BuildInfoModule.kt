package com.pocketpal

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

/**
 * BuildInfo native module（开发者预览版）：常量模块，向 JS 暴露打包时间与构建类型。
 * BUILD_TIMESTAMP / USE_DEV_SUPPORT 由 build.gradle 在每次构建时注入 BuildConfig：
 * - BUILD_TIMESTAMP：区分同 versionName 下的不同迭代包（AboutScreen 展示）
 * - USE_DEV_SUPPORT：debug=true / release=false——DRC 远程调试门控（Hermes 预编译
 *   下 __DEV__ 恒 false，JS 侧无法区分构建类型，需原生信号）
 */
class BuildInfoModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BuildInfo"

  override fun getConstants(): Map<String, Any> = mapOf(
    "buildTimestamp" to BuildConfig.BUILD_TIMESTAMP,
    "isDevSupport" to BuildConfig.USE_DEV_SUPPORT,
  )
}
