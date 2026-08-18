package com.pocketpal

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * ScreenReaderService — 只读读屏（SCREENWATCH_SPEC v1，P11）。
 *
 * 仅做「围观」：抓取当前窗口 a11y 精简树（文本+类名），零写路径——
 * 不 dispatchGesture、不 performAction、不截屏、不存盘。
 * 精简规则：深度优先收集 text 非空节点，上限 60 节点 / 2000 字符，包名置顶。
 */
class ScreenReaderService : AccessibilityService() {

  /** 最近一次精简树快照（readScreen 现场重抓前先返回缓存保证有内容） */
  @Volatile
  private var cachedTree: String = ""

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    event ?: return
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
      event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
    ) {
      val root = rootInActiveWindow ?: return
      val tree = buildTree(root, getPackageNameLabel(event.packageName?.toString()))
      cachedTree = tree
      ScreenReaderStore.update(tree)
    }
  }

  override fun onInterrupt() {
    // 只读服务无需恢复动作
  }

  private fun getPackageNameLabel(pkg: String?): String = pkg ?: "unknown"

  /** 现场重抓当前窗口精简树（保证新鲜）；失败回退缓存 */
  fun readScreenNow(): String {
    val root = rootInActiveWindow
    return if (root != null) {
      buildTree(root, root.packageName?.toString() ?: "")
    } else {
      cachedTree
    }
  }

  private fun buildTree(root: AccessibilityNodeInfo, pkg: String): String {
    val lines = mutableListOf<String>()
    lines.add("[window] $pkg")
    var count = 0
    var chars = 0

    fun walk(node: AccessibilityNodeInfo) {
      if (count >= MAX_NODES || chars >= MAX_CHARS) {
        return
      }
      val text = node.text?.toString()?.trim()
      if (!text.isNullOrEmpty() && text.length <= 80) {
        val cls = node.className?.toString()?.substringAfterLast('.') ?: "node"
        val line = "[$cls] $text"
        if (chars + line.length <= MAX_CHARS) {
          lines.add(line)
          chars += line.length
        }
        count++
      }
      for (i in 0 until node.childCount) {
        val child = node.getChild(i) ?: continue
        walk(child)
      }
    }
    walk(root)
    if (lines.size <= 1) {
      lines.add("（当前屏幕没有可读文本——可能是纯图形界面）")
    }
    return lines.joinToString("\n")
  }

  companion object {
    private const val MAX_NODES = 60
    private const val MAX_CHARS = 2000
  }
}
