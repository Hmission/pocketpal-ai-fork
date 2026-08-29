/*
 * PocketCL T1：设备层实现（device.c）
 *
 * 对应 include/pocketcl.h：
 *   pcGetDevices / pcReleaseDevices / pcDeviceCard / pcFree
 *   pcDeviceFamily / pcDeviceExtensions / pcDeviceTier / pcGetErrorString
 *
 * 设计（specs/architecture.md §4）：
 *   - 对齐 clGetDeviceIDs 心智：枚举 → 家族判定 → 白名单分级 → 决策消费；
 *   - 分级三档：0=拒绝（740 级驱动挂起区）/ 1=通用 / 2=high-gpu（对齐 requiresHighGpu 语义）；
 *   - 扩展协商：CL_DEVICE_EXTENSIONS 解析 cl_qcom_* 位掩码；
 *   - 设备卡 JSON：运行时探测值 + 三态诚实分级输出（对齐 devices/schema.json）；
 *   - 零第三方依赖：手写 JSON 拼接（锋利边界：不引 json 库）。
 *
 * TODO(真机链路)：
 *   - Android getprop 指纹（product/model/serial/soc）注入 verified 段——真机验证窗口接入；
 *   - tier 判定表后续从 devices/*.json 策略驱动（当前为编译期内置表 + env 覆盖）。
 */
#include "pocketcl.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ------------------------------------------------------------------ */
/* 内部对象                                                            */
/* ------------------------------------------------------------------ */

struct _pc_device {
    cl_device_id cl_dev;
    pc_gpu_family family;
    int tier;              /* 0=拒绝 / 1=通用 / 2=high-gpu */
    pc_ext_flags exts;
    char name[256];
    char vendor[128];
};

/* ------------------------------------------------------------------ */
/* 错误串                                                              */
/* ------------------------------------------------------------------ */

const char* pcGetErrorString(pc_status err) {
    switch (err) {
        case PC_OK:                  return "PC_OK";
        case PC_DEVICE_NOT_FOUND:    return "no usable OpenCL device (none or whitelist-rejected)";
        case PC_UNSUPPORTED_GPU:     return "GPU family known but tier policy rejects it";
        case PC_INVALID_ARG:         return "invalid argument";
        case PC_COMPILE_FAIL:        return "kernel compilation failed (see program build log)";
        case PC_PROFILE_UNAVAILABLE: return "profiling unavailable (driver lacks support); degrade to no-profiler path";
        case PC_IO_ERROR:            return "I/O error (device card / kernel dir)";
        default:                     return "unknown pc_status";
    }
}

void pcFree(void* ptr) { free(ptr); }

/* ------------------------------------------------------------------ */
/* 家族判定与分级                                                      */
/* ------------------------------------------------------------------ */

static pc_gpu_family detect_family(const char* vendor, const char* name) {
    /* vendor 串: "Qualcomm" -> Adreno; "ARM" -> Mali; 名称兜底 */
    if (strstr(vendor, "Qualcomm") || strstr(name, "Adreno")) return PC_GPU_ADRENO;
    if (strstr(vendor, "ARM") || strstr(name, "Mali"))       return PC_GPU_MALI;
    return PC_GPU_UNKNOWN;
}

/*
 * 分级判定（v0.1 内置表，后续由 devices/*.json 策略驱动）：
 *   - Adreno 84x/90x 系列                    -> 2 (high-gpu)
 *   - 其余 Adreno / Mali 全系                 -> 1 (通用)
 *   - 740 级已知驱动采样挂起区（Adreno 7xx 低端/8s 系）-> 0 拒绝（真机实证：采样 hang 无解）
 *   - env POCKETCL_DEVICE_TIER 可覆盖（调试/试验）
 */
static int detect_tier(pc_gpu_family family, const char* name) {
    const char* override = getenv("POCKETCL_DEVICE_TIER");
    if (override && override[0]) return atoi(override);

    switch (family) {
        case PC_GPU_ADRENO:
            if (strstr(name, "840") || strstr(name, "850") || strstr(name, "9")) return 2;
            if (strstr(name, "740")) return 0; /* 采样 hang 实证区 */
            return 1;
        case PC_GPU_MALI:
            return 1; /* 白名单准入后（half-prec 2.86x 实证）通用档 */
        default:
            return 1;
    }
}

static pc_ext_flags detect_exts(const char* exts) {
    pc_ext_flags f = PC_EXT_NONE;
    if (!exts) return f;
    if (strstr(exts, "cl_qcom_onchip_global_mem"))              f |= PC_EXT_QCOM_XMEM;
    if (strstr(exts, "cl_qcom_subgroup"))                       f |= PC_EXT_QCOM_SUBGROUP;
    if (strstr(exts, "cl_arm_fp16") || strstr(exts, "cl_khr_fp16") ||
        strstr(exts, "cl_qcom_fp16"))                           f |= PC_EXT_FP16_STORAGE;
    if (strstr(exts, "cl_qcom_recordable_queues"))              f |= PC_EXT_RECORDABLE_QUEUE;
    return f;
}

/* ------------------------------------------------------------------ */
/* 设备枚举（对齐 clGetDeviceIDs 心智）                                 */
/* ------------------------------------------------------------------ */

pc_status pcGetDevices(pc_device** out_devices, int* out_count) {
    if (!out_devices || !out_count) return PC_INVALID_ARG;

    cl_uint n_platforms = 0;
    if (clGetPlatformIDs(0, NULL, &n_platforms) != CL_SUCCESS || n_platforms == 0)
        return PC_DEVICE_NOT_FOUND;

    cl_platform_id* platforms = calloc(n_platforms, sizeof(cl_platform_id));
    if (!platforms) return PC_IO_ERROR;
    clGetPlatformIDs(n_platforms, platforms, NULL);

    pc_device* list = NULL;
    int count = 0;

    for (cl_uint p = 0; p < n_platforms; p++) {
        cl_uint n = 0;
        if (clGetDeviceIDs(platforms[p], CL_DEVICE_TYPE_GPU, 0, NULL, &n) != CL_SUCCESS || n == 0)
            continue; /* 无 GPU 的平台跳过（PocketCL 只关心 GPU compute） */

        cl_device_id* ids = calloc(n, sizeof(cl_device_id));
        clGetDeviceIDs(platforms[p], CL_DEVICE_TYPE_GPU, n, ids, NULL);

        for (cl_uint i = 0; i < n; i++) {
            pc_device dev = calloc(1, sizeof(*dev));
            if (!dev) { free(ids); continue; }
            dev->cl_dev = ids[i];

            /* 名称/厂商/扩展串（失败时置空，判定走兜底） */
            size_t sz = 0;
            if (clGetDeviceInfo(ids[i], CL_DEVICE_NAME, sizeof(dev->name) - 1, dev->name, NULL) != CL_SUCCESS)
                dev->name[0] = '\0';
            clGetDeviceInfo(ids[i], CL_DEVICE_VENDOR, sizeof(dev->vendor) - 1, dev->vendor, NULL);
            clGetDeviceInfo(ids[i], CL_DEVICE_EXTENSIONS, 0, NULL, &sz);
            char* ext_buf = (sz > 0) ? malloc(sz) : NULL;
            if (ext_buf) clGetDeviceInfo(ids[i], CL_DEVICE_EXTENSIONS, sz, ext_buf, NULL);

            dev->family = detect_family(dev->vendor, dev->name);
            dev->exts   = detect_exts(ext_buf ? ext_buf : "");
            dev->tier   = detect_tier(dev->family, dev->name);
            free(ext_buf);

            /* 白名单语义：tier 0 拒绝（不入列表）——但保留计数语义由调用方决定 */
            if (dev->tier == 0) { free(dev); continue; }

            list = realloc(list, (count + 1) * sizeof(pc_device));
            list[count++] = dev;
        }
        free(ids);
    }
    free(platforms);

    if (count == 0) return PC_DEVICE_NOT_FOUND;

    *out_devices = list;
    *out_count = count;
    return PC_OK;
}

pc_status pcReleaseDevices(pc_device* devices, int count) {
    if (!devices || count < 0) return PC_INVALID_ARG;
    for (int i = 0; i < count; i++) {
        if (devices[i]) { clReleaseDevice(devices[i]->cl_dev); free(devices[i]); }
    }
    free(devices);
    return PC_OK;
}

pc_gpu_family pcDeviceFamily(pc_device dev) { return dev ? dev->family : PC_GPU_UNKNOWN; }
pc_ext_flags  pcDeviceExtensions(pc_device dev) { return dev ? dev->exts : PC_EXT_NONE; }
int pcDeviceTier(pc_device dev) { return dev ? dev->tier : 0; }

/* ------------------------------------------------------------------ */
/* 设备卡 JSON 导出（运行时探测 + 三态诚实）                            */
/* ------------------------------------------------------------------ */

/*
 * 输出结构（对齐 devices/schema.json）：
 * {
 *   "gpuFamily": "adreno|mali|unknown",
 *   "gpuModel": "...",
 *   "tier": 0|1|2,
 *   "extensions": ["qcom_xmem", ...],
 *   "verified": [{"key":"openclDeviceName","value":"...","source":"runtime probe"}, ...],
 *   "pending": [{"key":"getpropFingerprint","note":"Android getprop 指纹待真机注入"}]
 * }
 */
pc_status pcDeviceCard(pc_device dev, char** out_json) {
    if (!dev || !out_json) return PC_INVALID_ARG;

    const char* family_str = dev->family == PC_GPU_ADRENO ? "adreno"
                            : dev->family == PC_GPU_MALI   ? "mali"
                                                            : "unknown";

    char exts_buf[256] = "";
    if (dev->exts & PC_EXT_QCOM_XMEM)       strcat(exts_buf, "\"qcom_xmem\",");
    if (dev->exts & PC_EXT_QCOM_SUBGROUP)   strcat(exts_buf, "\"qcom_subgroup\",");
    if (dev->exts & PC_EXT_FP16_STORAGE)    strcat(exts_buf, "\"fp16_storage\",");
    if (dev->exts & PC_EXT_RECORDABLE_QUEUE) strcat(exts_buf, "\"recordable_queue\",");
    size_t elen = strlen(exts_buf);
    if (elen > 0) exts_buf[elen - 1] = '\0'; /* 去尾逗号 */

    /* 手写 JSON（零依赖）：长度先粗估再拼接，值域全走可控输入 */
    char* buf = malloc(1024 + strlen(dev->name) + strlen(dev->vendor));
    if (!buf) return PC_IO_ERROR;
    int n = snprintf(buf, 1024,
        "{"
        "\"gpuFamily\":\"%s\","
        "\"gpuModel\":\"%s\","
        "\"gpuVendor\":\"%s\","
        "\"tier\":%d,"
        "\"extensions\":[%s],"
        "\"verified\":["
          "{\"key\":\"openclDeviceName\",\"value\":\"%s\",\"source\":\"runtime probe\"},"
          "{\"key\":\"openclVendor\",\"value\":\"%s\",\"source\":\"runtime probe\"}"
        "],"
        "\"pending\":["
          "{\"key\":\"getpropFingerprint\",\"note\":\"Android getprop 指纹（product/model/serial/soc）待真机窗口注入\"}"
        "]"
        "}",
        family_str, dev->name, dev->vendor, dev->tier,
        exts_buf[0] ? exts_buf : "",
        dev->name, dev->vendor);
    if (n <= 0) { free(buf); return PC_IO_ERROR; }

    *out_json = buf;
    return PC_OK;
}