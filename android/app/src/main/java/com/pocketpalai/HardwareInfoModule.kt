package com.pocketpal

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.pocketpal.specs.NativeHardwareInfoSpec
import android.os.Build
import android.os.Debug
import java.io.File
import java.util.regex.Pattern
import android.opengl.GLES20
import javax.microedition.khronos.egl.EGL10
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.egl.EGLContext
import javax.microedition.khronos.egl.EGLDisplay
import android.app.ActivityManager
import android.content.Context
import android.os.Process
import org.json.JSONArray
import org.json.JSONObject

@ReactModule(name = NativeHardwareInfoSpec.NAME)
class HardwareInfoModule(reactContext: ReactApplicationContext) :
    NativeHardwareInfoSpec(reactContext) {

  // The JNI implementation lives in jni/src/hardware_info.cpp; our
  // CMakeLists.txt links it into libappmodules.so, which SoLoader has
  // already mapped by the time this is called. No System.loadLibrary
  // needed.
  private external fun nativePurgeAll(): Boolean

  override fun getName(): String = NativeHardwareInfoSpec.NAME

  override fun getChipset(promise: Promise) {
    try {
      // Prefer SOC_MODEL (Android S+) for more specific chipset info
      val chipset = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Build.SOC_MODEL.takeUnless { it.isNullOrEmpty() }
          ?: Build.HARDWARE.takeUnless { it.isNullOrEmpty() }
          ?: Build.BOARD
      } else {
        Build.HARDWARE.takeUnless { it.isNullOrEmpty() } ?: Build.BOARD
      }
      promise.resolve(chipset)
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  override fun getGPUInfo(promise: Promise) {
    try {
      val gpuInfo = Arguments.createMap()

      // Get GPU renderer info
      var renderer = ""
      var vendor = ""
      var version = ""

      try {
        val egl = EGLContext.getEGL() as EGL10
        val display = egl.eglGetDisplay(EGL10.EGL_DEFAULT_DISPLAY)

        if (display != EGL10.EGL_NO_DISPLAY) {
          val version_array = IntArray(2)
          egl.eglInitialize(display, version_array)

          val configsCount = IntArray(1)
          val configs = arrayOfNulls<EGLConfig>(1)
          val configSpec = intArrayOf(
            EGL10.EGL_RENDERABLE_TYPE, 4,
            EGL10.EGL_NONE
          )

          egl.eglChooseConfig(display, configSpec, configs, 1, configsCount)

          if (configsCount[0] > 0) {
            val context = egl.eglCreateContext(
              display,
              configs[0],
              EGL10.EGL_NO_CONTEXT,
              intArrayOf(0x3098, 2, EGL10.EGL_NONE)
            )

            if (context != null && context != EGL10.EGL_NO_CONTEXT) {
              val surfaceAttribs = intArrayOf(
                EGL10.EGL_WIDTH, 1,
                EGL10.EGL_HEIGHT, 1,
                EGL10.EGL_NONE
              )
              val surface = egl.eglCreatePbufferSurface(display, configs[0], surfaceAttribs)

              if (surface != null && surface != EGL10.EGL_NO_SURFACE) {
                egl.eglMakeCurrent(display, surface, surface, context)

                renderer = GLES20.glGetString(GLES20.GL_RENDERER) ?: ""
                vendor = GLES20.glGetString(GLES20.GL_VENDOR) ?: ""
                version = GLES20.glGetString(GLES20.GL_VERSION) ?: ""

                egl.eglMakeCurrent(display, EGL10.EGL_NO_SURFACE, EGL10.EGL_NO_SURFACE, EGL10.EGL_NO_CONTEXT)
                egl.eglDestroySurface(display, surface)
              }
              egl.eglDestroyContext(display, context)
            }
          }
          egl.eglTerminate(display)
        }
      } catch (e: Exception) {
        // Fallback: GPU info not available
      }

      gpuInfo.putString("renderer", renderer)
      gpuInfo.putString("vendor", vendor)
      gpuInfo.putString("version", version)

      // Detect GPU type based on renderer string
      val rendererLower = renderer.lowercase()
      val hasAdreno = Pattern.compile("(adreno|qcom|qualcomm)").matcher(rendererLower).find()
      val hasMali = Pattern.compile("mali").matcher(rendererLower).find()
      val hasPowerVR = Pattern.compile("powervr").matcher(rendererLower).find()

      gpuInfo.putBoolean("hasAdreno", hasAdreno)
      gpuInfo.putBoolean("hasMali", hasMali)
      gpuInfo.putBoolean("hasPowerVR", hasPowerVR)

      // Note: OpenCL support requires Adreno GPU AND both i8mm and dotprod CPU features
      // This is a requirement from llama.rn builds
      // The actual check is done in JavaScript by combining GPU info with CPU info
      gpuInfo.putBoolean("supportsOpenCL", hasAdreno) // Partial check - CPU features checked separately

      // Determine GPU type string
      val gpuType = when {
        hasAdreno -> "Adreno (Qualcomm)"
        hasMali -> "Mali (ARM)"
        hasPowerVR -> "PowerVR (Imagination)"
        renderer.isNotEmpty() -> renderer
        else -> "Unknown"
      }
      gpuInfo.putString("gpuType", gpuType)

      promise.resolve(gpuInfo)
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  override fun getCPUInfo(promise: Promise) {
    try {
      val cpuInfo = Arguments.createMap()
      cpuInfo.putInt("cores", Runtime.getRuntime().availableProcessors())

      val processors = Arguments.createArray()
      val features = mutableSetOf<String>()
      val cpuInfoFile = File("/proc/cpuinfo")

      if (cpuInfoFile.exists()) {
        val cpuInfoLines = cpuInfoFile.readLines()
        var currentProcessor = Arguments.createMap()
        var hasData = false

        for (line in cpuInfoLines) {
          if (line.isEmpty() && hasData) {
            processors.pushMap(currentProcessor)
            currentProcessor = Arguments.createMap()
            hasData = false
            continue
          }

          val parts = line.split(":")
          if (parts.size >= 2) {
            val key = parts[0].trim()
            val value = parts[1].trim()
            when (key) {
              "processor", "model name", "cpu MHz", "vendor_id" -> {
                currentProcessor.putString(key, value)
                hasData = true
              }
              "flags", "Features" -> {  // "flags" for x86, "Features" for ARM
                features.addAll(value.split(" ").filter { it.isNotEmpty() })
              }
            }
          }
        }

        if (hasData) {
          processors.pushMap(currentProcessor)
        }

        cpuInfo.putArray("processors", processors)

        // Convert features set to array
        val featuresArray = Arguments.createArray()
        features.forEach { featuresArray.pushString(it) }
        cpuInfo.putArray("features", featuresArray)

        // ML-related CPU features detection
        cpuInfo.putBoolean("hasFp16", features.any { it in setOf("fphp", "fp16") })
        cpuInfo.putBoolean("hasDotProd", features.any { it in setOf("dotprod", "asimddp") })
        cpuInfo.putBoolean("hasSve", features.any { it == "sve" })
        cpuInfo.putBoolean("hasI8mm", features.any { it == "i8mm" })
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        cpuInfo.putString("socModel", Build.SOC_MODEL)
      }

      // HARDWARE is a distinct classifier signal from SOC_MODEL; do not
      // coalesce them (getChipset hides one behind the other).
      Build.HARDWARE.takeUnless { it.isNullOrEmpty() }?.let {
        cpuInfo.putString("hardware", it)
      }

      readMaxCpuFreqMhz()?.let { cpuInfo.putInt("maxFreqMhz", it) }

      promise.resolve(cpuInfo)
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  override fun getAvailableMemory(promise: Promise) {
    try {
      val activityManager = reactApplicationContext
        .getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memInfo = ActivityManager.MemoryInfo()
      activityManager.getMemoryInfo(memInfo)

      // availMem is already in bytes
      promise.resolve(memInfo.availMem.toDouble())
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  // Best-effort: a failing JNI/symbol-resolution path still resolves
  // with purged=false rather than rejecting, so callers don't have to
  // handle platform-availability cases themselves.
  override fun purgeNativeAllocator(promise: Promise) {
    try {
      val rssBefore = readVmRssKb()
      val purged = try {
        nativePurgeAll()
      } catch (_: Throwable) {
        // UnsatisfiedLinkError on a build where libappmodules lacks
        // the symbol; report purged=false and let the caller continue.
        false
      }
      val rssAfter = readVmRssKb()
      promise.resolve(Arguments.createMap().apply {
        putBoolean("purged", purged)
        // RN bridge has no long; doubles round-trip cleanly to JS number.
        putDouble("rss_kb_before", rssBefore.toDouble())
        putDouble("rss_kb_after", rssAfter.toDouble())
      })
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  // Big-core max frequency in MHz, read across all cores' cpufreq nodes.
  // Some cores can be offline (missing cpufreq node) without being the last
  // core, so we scan a bounded range and skip gaps rather than stop on the
  // first absent node. Returns null when no core exposes a readable value.
  private fun readMaxCpuFreqMhz(): Int? {
    return try {
      var maxKhz = 0L
      val coreCount = Runtime.getRuntime().availableProcessors().coerceIn(1, 16)
      for (core in 0 until coreCount) {
        val node = File("/sys/devices/system/cpu/cpu$core/cpufreq/cpuinfo_max_freq")
        if (!node.exists()) {
          continue
        }
        node.readText().trim().toLongOrNull()?.let {
          if (it > maxKhz) {
            maxKhz = it
          }
        }
      }
      if (maxKhz > 0L) (maxKhz / 1000).toInt() else null
    } catch (e: Throwable) {
      null
    }
  }

  private fun readVmRssKb(): Long {
    return try {
      File("/proc/self/status").bufferedReader().useLines { lines ->
        for (line in lines) {
          if (line.startsWith("VmRSS:")) {
            // Format: "VmRSS:  <whitespace>  12345 kB"
            return line.substringAfter("VmRSS:").trim().substringBefore(" ").toLong()
          }
        }
        0L
      }
    } catch (e: Throwable) {
      0L
    }
  }

  // ── ADR-0008 跑分面板：1Hz 性能快照（PSS/CPU/温度）──
  // PSS 与 HyperOS 看护硬杀同口径（pss threshold:6291456kb 实测）——
  // 跑分看到的就是系统判死刑的线。
  // PERF_BENCHMARK_DESIGN P1（2026-08-23）：扩 6 指标——CPU/GPU 频率、
  // GPU 负载、温度分区（cpu/gpu）、功耗（power_supply）。全部 sysfs 探测 +
  // 路径缓存 + N/A(-1) 降级，不抛错不阻塞主链路。
  private var lastCpuNs = 0L
  private var lastWallMs = 0L

  // GPU sysfs 路径探测缓存（首次快照探测一次，之后复用；null/空 = 不可用）
  private var gpuBusyPath: String? = null
  /** GPU 频率候选路径（有序多源：kgsl gpuclk → kgsl devfreq → /sys/class/devfreq 兜底），
   *  单源返回 0/不可读时自动轮换下一候选（骁龙 8 Gen 2+ 实测 gpuclk 受限/恒 0，K90 复现） */
  private val gpuFreqCandidates = mutableListOf<String>()
  private var gpuPathProbed = false

  // GPU 采样防抖保持（B40）：kgsl gpubusy 在 GPU 电源域切换瞬间会偶发读取失败/返回 0，
  // 若直接降为 -1 会让跑分面板/折线图闪 "--"（大王实测发现）。对策：最近 GPU_HOLD_MS
  // 内有过有效值则保持返回该值（传感器防抖，非造假）；从未读到过才诚实 -1。
  private val GPU_HOLD_MS = 3000L
  private var lastGpuLoadPct = -1.0
  private var lastGpuLoadAtMs = 0L
  private var lastGpuFreqMhz = -1.0
  private var lastGpuFreqAtMs = 0L

  /** 探测 GPU 负载/频率 sysfs 节点：Adreno kgsl 优先，devfreq 全目录兜底（Mali/MTK）
   *  修正 2026-08-29：①kgsl 探测后不再提前 return，频率路径挂多源候选（gpuclk 受限
   *  → cur_freq → /sys/class/devfreq 兜底）；②devfreq 节点名放宽含 kgsl/mali（MTK
   *  Mali 节点如 13000000.mali 不含 "gpu"，旧匹配漏探致 K Pad 平板 GPU 读不到） */
  private fun probeGpuPaths() {
    if (gpuPathProbed) return
    gpuPathProbed = true
    // 1. Adreno（Qualcomm kgsl）：gpubusy = "busy total" 两列；gpuclk 单位 Hz
    val kgsl = File("/sys/class/kgsl/kgsl-3d0")
    if (kgsl.isDirectory) {
      val busy = File(kgsl, "gpubusy")
      if (busy.exists()) {
        gpuBusyPath = busy.absolutePath
      }
      // 频率候选有序追加：gpuclk 命中但读数 0/受限时会自动轮换（见 readGpuFreqMhzRaw）
      File(kgsl, "gpuclk").takeIf { it.exists() }?.let { gpuFreqCandidates += it.absolutePath }
      File(kgsl, "devfreq/cur_freq").takeIf { it.exists() }?.let { gpuFreqCandidates += it.absolutePath }
    }
    // 2. devfreq 全目录兜底：Adreno 新内核节点挂 /sys/class/devfreq/*qcom,kgsl-3d0*，
    //    Mali/MTK 节点名如 13000000.mali（不含 "gpu"，旧匹配漏探）；load/utilisation 纯百分比
    val devfreq = File("/sys/class/devfreq")
    val gpuNode = try {
      devfreq.listFiles()?.firstOrNull {
        it.name.contains("gpu", ignoreCase = true) ||
          it.name.contains("kgsl", ignoreCase = true) ||
          it.name.contains("mali", ignoreCase = true)
      }
    } catch (_: Throwable) {
      null
    }
    if (gpuNode != null) {
      if (gpuBusyPath == null) {
        // 仅接受纯数字百分比格式（"@ busy" 周期格式无法归一，诚实降级 N/A）
        val load = listOf("load", "utilisation", "gpu_load")
          .map { File(gpuNode, it) }
          .firstOrNull { it.exists() }
        if (load != null) {
          val raw = try { load.readText().trim() } catch (_: Throwable) { "" }
          val v = raw.toLongOrNull()
          if (v != null && v in 0..100) {
            gpuBusyPath = load.absolutePath
          }
        }
      }
      File(gpuNode, "cur_freq").takeIf { it.exists() }?.let { gpuFreqCandidates += it.absolutePath }
    }
    println("[HardwareInfo] gpu paths: busy=$gpuBusyPath freq=$gpuFreqCandidates")
  }

  /** GPU 负载%（Adreno gpubusy 两列比值 / devfreq 纯百分比）；-1 = N/A，带防抖保持 */
  private fun readGpuLoadPct(): Double {
    val now = System.currentTimeMillis()
    val raw = readGpuLoadPctRaw()
    if (raw >= 0.0) {
      lastGpuLoadPct = raw
      lastGpuLoadAtMs = now
      return raw
    }
    // 瞬时读取失败：保持最近 GPU_HOLD_MS 内的有效值（防抖，非造假）
    if (lastGpuLoadPct >= 0.0 && now - lastGpuLoadAtMs <= GPU_HOLD_MS) {
      return lastGpuLoadPct
    }
    return -1.0
  }

  /** GPU 负载% 原始读数；-1 = 本次读取失败/不可用 */
  private fun readGpuLoadPctRaw(): Double {
    probeGpuPaths()
    val path = gpuBusyPath ?: return -1.0
    return try {
      val raw = File(path).readText().trim()
      val parts = raw.split(Regex("\\s+"))
      when {
        // Adreno gpubusy："busy total" → 比值
        parts.size >= 2 -> {
          val busy = parts[0].toLongOrNull() ?: return -1.0
          val total = parts[1].toLongOrNull() ?: return -1.0
          if (total > 0L) (busy.toDouble() / total.toDouble() * 100.0).coerceIn(0.0, 100.0) else -1.0
        }
        // devfreq 纯百分比
        parts.size == 1 -> {
          val v = parts[0].toDoubleOrNull() ?: return -1.0
          if (v in 0.0..100.0) v else -1.0
        }
        else -> -1.0
      }
    } catch (_: Throwable) {
      -1.0
    }
  }

  /** GPU 频率 MHz（kgsl gpuclk / devfreq cur_freq，单位 Hz）；-1 = N/A，带防抖保持 */
  private fun readGpuFreqMhz(): Double {
    val now = System.currentTimeMillis()
    val raw = readGpuFreqMhzRaw()
    if (raw >= 0.0) {
      lastGpuFreqMhz = raw
      lastGpuFreqAtMs = now
      return raw
    }
    if (lastGpuFreqMhz >= 0.0 && now - lastGpuFreqAtMs <= GPU_HOLD_MS) {
      return lastGpuFreqMhz
    }
    return -1.0
  }

  /** GPU 频率 MHz 原始读数；-1 = 本次读取失败/不可用。多源候选轮换：
   *  单源读数 0（骁龙 gpuclk 受限恒 0）或抛错 → 自动尝试下一候选，全败才 -1 */
  private fun readGpuFreqMhzRaw(): Double {
    probeGpuPaths()
    if (gpuFreqCandidates.isEmpty()) return -1.0
    for (path in gpuFreqCandidates) {
      try {
        val hz = File(path).readText().trim().toLongOrNull() ?: continue
        if (hz > 0L) return hz / 1_000_000.0
      } catch (_: Throwable) {
        // 该源不可读（SELinux 拦截等），尝试下一候选
      }
    }
    return -1.0
  }

  /** 大核当前频率 MHz（scaling_cur_freq 取最大，代表当前性能档）；-1 = N/A */
  private fun readCurCpuFreqMhz(): Double {
    return try {
      var maxKhz = 0L
      val coreCount = Runtime.getRuntime().availableProcessors().coerceIn(1, 16)
      for (core in 0 until coreCount) {
        val node = File("/sys/devices/system/cpu/cpu$core/cpufreq/scaling_cur_freq")
        if (!node.exists()) continue
        node.readText().trim().toLongOrNull()?.let { if (it > maxKhz) maxKhz = it }
      }
      if (maxKhz > 0L) maxKhz / 1000.0 else -1.0
    } catch (_: Throwable) {
      -1.0
    }
  }

  /** 按类型关键字读 thermal_zone 分区温度（type 含 keyword 的最大有效值）；-1 = N/A */
  private fun readThermalTempByTypeC(keyword: String): Double {
    return try {
      val zones = File("/sys/class/thermal")
        .listFiles { f -> f.name.startsWith("thermal_zone") }
        ?: return -1.0
      var max = -1.0
      for (zone in zones) {
        val typeNode = File(zone, "type")
        val tempNode = File(zone, "temp")
        if (!typeNode.exists() || !tempNode.exists()) continue
        val type = try { typeNode.readText().trim().lowercase() } catch (_: Throwable) { continue }
        if (!type.contains(keyword)) continue
        val raw = tempNode.readText().trim().toDoubleOrNull() ?: continue
        val celsius = raw / 1000.0
        if (celsius > 0.0 && celsius <= 150.0 && celsius > max) {
          max = celsius
        }
      }
      max
    } catch (_: Throwable) {
      -1.0
    }
  }

  /** 功耗 mW 多源探测（修正 2026-08-29：K90/HyperOS 实测 battery/current_now 常为 0
   *  或受限 → 恒 -1）。候选链：current_now→current_avg（同 voltage_now）→ 其它
   *  power_supply 节点（main/bms/fg_*）→ power_now 直读（mW）。任一源有效即返回，
   *  全败 -1 N/A（诚实降级，不编造）；读数异常（>60W 或 ≤0）视为无效 */
  private fun readPowerMw(): Double {
    val battery = File("/sys/class/power_supply/battery")
    val others = try {
      File("/sys/class/power_supply").listFiles()
        ?.filter {
          it.name != "battery" &&
            (it.name.contains("main", ignoreCase = true) ||
              it.name.contains("bms", ignoreCase = true) ||
              it.name.contains("fg", ignoreCase = true))
        }
        ?.toList() ?: emptyList()
    } catch (_: Throwable) {
      emptyList()
    }
    // 电流×电压候选（有序：本机 battery 优先，其它节点兜底）
    val pairs = mutableListOf<Pair<File, File>>()
    for (dir in listOf(battery) + others) {
      val volt = File(dir, "voltage_now")
      if (!volt.exists()) continue
      File(dir, "current_now").takeIf { it.exists() }?.let { pairs += it to volt }
      File(dir, "current_avg").takeIf { it.exists() }?.let { pairs += it to volt }
    }
    for ((cur, volt) in pairs) {
      try {
        val curUa = cur.readText().trim().toDoubleOrNull() ?: continue
        val voltUv = volt.readText().trim().toDoubleOrNull() ?: continue
        val mw = kotlin.math.abs(curUa) * kotlin.math.abs(voltUv) / 1_000_000_000.0
        if (mw > 0.0 && mw <= 60_000.0) return mw
      } catch (_: Throwable) {
        // 该源不可读，尝试下一候选
      }
    }
    // power_now 直读（mW）兜底
    for (dir in listOf(battery) + others) {
      try {
        val pn = File(dir, "power_now").readText().trim().toDoubleOrNull() ?: continue
        if (pn > 0.0 && pn <= 60_000.0) return pn
      } catch (_: Throwable) {
        // 跳过
      }
    }
    return -1.0
  }

  override fun getPerfSnapshot(promise: Promise) {
    try {
      val snapshot = Arguments.createMap()

      // PSS：优先 totalPss（与看护口径一致）；低版本回退 Debug.getPss()
      val pssKb = try {
        val m = Debug.MemoryInfo()
        Debug.getMemoryInfo(m)
        m.totalPss.toLong()
      } catch (_: Throwable) {
        Debug.getPss().toLong()
      }
      snapshot.putDouble("pssKb", pssKb.toDouble())
      snapshot.putDouble("rssKb", readVmRssKb().toDouble())

      // CPU：本进程 CPU 时间差分 / 墙钟（单核百分比，多核可超 100）
      val nowNs = Process.getElapsedCpuTime()
      val nowMs = System.currentTimeMillis()
      val cpuPct = if (lastCpuNs > 0L && nowMs > lastWallMs) {
        val wallDelta = (nowMs - lastWallMs) * 1_000_000L
        if (wallDelta > 0L) {
          (nowNs - lastCpuNs).toDouble() / wallDelta.toDouble() * 100.0
        } else 0.0
      } else 0.0
      lastCpuNs = nowNs
      lastWallMs = nowMs
      snapshot.putDouble("cpuPct", cpuPct)

      // 温度：thermal_zone 最大有效值（毫摄氏度 → ℃）；-1 = N/A
      snapshot.putDouble("tempC", readMaxThermalTempC())
      // P1 扩展指标（sysfs 探测 + N/A(-1) 降级，详见 PERF_BENCHMARK_DESIGN §3.2）
      snapshot.putDouble("cpuFreqMhz", readCurCpuFreqMhz())
      snapshot.putDouble("gpuLoadPct", readGpuLoadPct())
      snapshot.putDouble("gpuFreqMhz", readGpuFreqMhz())
      snapshot.putDouble("tempCpuC", readThermalTempByTypeC("cpu"))
      snapshot.putDouble("tempGpuC", readThermalTempByTypeC("gpu"))
      snapshot.putDouble("powerMw", readPowerMw())

      promise.resolve(snapshot)
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  private fun readMaxThermalTempC(): Double {
    return try {
      val zones = File("/sys/class/thermal")
        .listFiles { f -> f.name.startsWith("thermal_zone") }
        ?: return -1.0
      var max = -1.0
      for (zone in zones) {
        val node = File(zone, "temp")
        if (!node.exists()) continue
        val raw = node.readText().trim().toDoubleOrNull() ?: continue
        val celsius = raw / 1000.0
        // 过滤无效读数（0 与 >150℃ 视为不可信）
        if (celsius > 0.0 && celsius <= 150.0 && celsius > max) {
          max = celsius
        }
      }
      max
    } catch (e: Throwable) {
      -1.0
    }
  }

  override fun writeMemorySnapshot(label: String, promise: Promise) {
    try {
      // Collect memory metrics
      val pssKb = Debug.getPss()
      val nativeHeap = Debug.getNativeHeapAllocatedSize()
      val activityManager = reactApplicationContext
          .getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memInfo = ActivityManager.MemoryInfo()
      activityManager.getMemoryInfo(memInfo)

      val snapshot = JSONObject().apply {
        put("label", label)
        put("timestamp", java.time.Instant.now().toString())
        put("native", JSONObject().apply {
          put("pss_total", pssKb * 1024.0)
          put("native_heap_allocated", nativeHeap.toDouble())
          put("available_memory", memInfo.availMem.toDouble())
        })
      }

      // Write to external files dir so adb pull works without root on real devices
      val dir = reactApplicationContext.getExternalFilesDir(null) ?: reactApplicationContext.filesDir
      val file = File(dir, "memory-snapshots.json")
      val snapshots = if (file.exists()) {
        JSONArray(file.readText())
      } else {
        JSONArray()
      }
      snapshots.put(snapshot)
      file.writeText(snapshots.toString(2))

      promise.resolve(Arguments.createMap().apply {
        putString("label", label)
        putString("status", "written")
      })
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }
}

