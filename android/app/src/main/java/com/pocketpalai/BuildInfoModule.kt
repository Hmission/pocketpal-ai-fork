package com.pocketpal

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

/**
 * BuildInfo native module（开发者预览版）：常量模块，向 JS 暴露打包时间。
 * BUILD_TIMESTAMP 由 build.gradle defaultConfig 在每次构建时注入 BuildConfig，
 * AboutScreen 借此区分同 versionName 下的不同迭代包。
 */
class BuildInfoModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BuildInfo"

  override fun getConstants(): Map<String, Any> = mapOf(
    "buildTimestamp" to BuildConfig.BUILD_TIMESTAMP,
  )
}
