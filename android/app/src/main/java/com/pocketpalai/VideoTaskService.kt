package com.pocketpal

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.IBinder
import android.os.PowerManager

/**
 * VideoTaskService — 夜间长任务前台服务（ONDEVICE_VIDEO_GEN_ANALYSIS §7.1）
 *
 * 职责：
 * 1. 前台服务 + 常驻通知 → 防 Doze/App Standby 杀进程
 * 2. PARTIAL_WAKE_LOCK → 防 CPU 休眠（屏幕可灭，任务继续）
 * 3. 通知可点击回到 App
 *
 * 生命周期：JS 侧 nightTaskRegistry.begin() 时 startForegroundService，
 * end() 时 stopSelf。计数归零才停。
 *
 * 权限：FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC（Android 14+）
 * WakeLock：PARTIAL_WAKE_LOCK（不需 WAKE_LOCK 权限，进程存活即可用）
 */
class VideoTaskService : Service() {

  companion object {
    const val CHANNEL_ID = "video_task_channel"
    const val NOTIFICATION_ID = 7001
    private const val TAG = "VideoTaskService"

    @Volatile
    var isRunning = false
      private set
  }

  private var wakeLock: PowerManager.WakeLock? = null
  private val binder = LocalBinder()

  inner class LocalBinder : Binder() {
    val service: VideoTaskService get() = this@VideoTaskService
  }

  override fun onBind(intent: Intent?): IBinder = binder

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    acquireWakeLock()
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildNotification()
    // Android 14+ 必须指定 foregroundServiceType
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    // START_NOT_STICKY: 进程被杀不重启（任务已完成或用户主动停）
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    releaseWakeLock()
    isRunning = false
  }

  private fun createNotificationChannel() {
    val channel = NotificationChannel(
      CHANNEL_ID,
      "夜间任务",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "视频/生图长任务进行中"
      setShowBadge(false)
    }
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val intent = packageManager.getLaunchIntentForPackage(packageName)
    return Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("小黄鸡 · 任务进行中")
      .setContentText("夜间长任务运行中，完成后将通知您")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setContentIntent(
        android.app.PendingIntent.getActivity(
          this, 0, intent,
          android.app.PendingIntent.FLAG_IMMUTABLE,
        ),
      )
      .build()
  }

  private fun acquireWakeLock() {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PocketChick:VideoTask").apply {
      setReferenceCounted(false)
      acquire(24 * 60 * 60 * 1000L) // 最长 24h 安全上限
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
  }
}
