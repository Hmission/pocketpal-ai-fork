package com.pocketpal

/**
 * ScreenReaderStore — 读屏树静态桥（SCREENWATCH_SPEC v1）。
 *
 * AccessibilityService 实例由系统管理（Module 拿不到实例引用），
 * 用伴生单例中转：Service 写最新精简树，Module 读。纯内存、不落盘。
 */
object ScreenReaderStore {
  @Volatile
  private var latestTree: String = "（读屏服务已连接，等待屏幕内容…）"

  fun update(tree: String) {
    if (tree.isNotBlank()) {
      latestTree = tree
    }
  }

  fun currentTree(): String = latestTree
}
