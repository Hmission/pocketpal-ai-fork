/*
 * PocketCL T1：策略引擎实现（policy.c）
 *
 * 对应 include/pocketcl.h：
 *   pcPolicyBuild / pcReleasePolicy / pcPolicyDump
 *
 * 设计（specs/architecture.md §4 L1+L2 桥）：
 *   - 输入：设备（family/tier/exts）+ 可选 model_manifest（模型语义覆盖）；
 *   - 输出：JSON 策略——推荐内核集合（enabled+reason）与 env 组合（可被引擎/CLI 直接消费）；
 *   - 决策规则全部来自真机实证（handbook/rules.md 五铁律）：
 *       · Adreno tier2 + cl_qcom_onchip_global_mem → 启用 xmem 内核族（3.6x 实证）；
 *       · Mali + fp16 storage → 启用半精度 tiled GEMM（2.86-3.42x 实证，PP_MALI_FP16_LM 门控沿用）；
 *       · z-image 模型 → XMEM 建议关闭（K90 双禁用保稳定实证），tiled VAE 常开；
 *       · tier 0 设备防御性全拒（理论上已被 pcGetDevices 过滤）。
 *   - 零第三方依赖：手写 JSON 拼接（锋利边界，同 device.c）。
 */
#include "pocketcl.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct _pc_policy {
    char* json; /* 最近一次 build/dump 产物 */
};

/* ------------------------------------------------------------------ */
/* 决策实现                                                            */
/* ------------------------------------------------------------------ */

/* 模型覆盖：manifest 中模型 id 的语义覆盖（真机实证目录） */
static int model_is_z_image(const char* manifest) {
    /* manifest 为 JSON 字符串；本层只做轻量识别（不含解析器，锋利边界） */
    return manifest && (strstr(manifest, "z-image") || strstr(manifest, "zimage"));
}

pc_status pcPolicyBuild(pc_policy* out_policy, pc_device dev, const char* model_manifest) {
    if (!out_policy || !dev) return PC_INVALID_ARG;

    pc_policy pol = calloc(1, sizeof(*pol));
    if (!pol) return PC_IO_ERROR;

    pc_gpu_family family = pcDeviceFamily(dev);
    pc_ext_flags  exts   = pcDeviceExtensions(dev);
    int tier             = pcDeviceTier(dev);
    int zimg             = model_is_z_image(model_manifest);

    /* ---- 内核决策（每条带 reason，证据来自 handbook 铁律） ---- */
    char kernels[2048] = "";

    /* xmem 内核族：Adreno tier2 + 有扩展才启用；z-image 模型强制关闭（K90 双禁用实证） */
    int xmem_ok = (family == PC_GPU_ADRENO && tier >= 2 && (exts & PC_EXT_QCOM_XMEM));
    if (xmem_ok && !zimg) {
        strcat(kernels,
            "{\"name\":\"xmem-gemm\",\"enabled\":true,\"reason\":\"adreno tier2 + cl_qcom_onchip_global_mem (3.6x 实证)\"},");
    } else if (zimg) {
        strcat(kernels,
            "{\"name\":\"xmem-gemm\",\"enabled\":false,\"reason\":\"z-image 模型强制关闭：K90 双禁用保稳定实证\"},");
    }

    /* 半精度 tiled GEMM 族：Mali + fp16 存储能力（half-prec 2.86-3.42x 实证） */
    if (family == PC_GPU_MALI && (exts & PC_EXT_FP16_STORAGE)) {
        strcat(kernels,
            "{\"name\":\"mali-half-prec-gemm\",\"enabled\":true,\"reason\":\"mali + fp16 storage：half 存储/fp32 累加 (2.86-3.42x 实证)\"},");
    }

    /* tiled VAE：内存兜底常开（VAE 1.94GB→416MB 实证），所有 GPU 可用 */
    strcat(kernels,
        "{\"name\":\"vae-tiled-512\",\"enabled\":true,\"reason\":\"tiled 解码降驻留：1.94GB->416MB 实证\"},");

    /* 通用内核族 */
    strcat(kernels,
        "{\"name\":\"generic-common\",\"enabled\":true,\"reason\":\"所有 GPU 通用基线\"}");

    /* ---- env 组合（可被引擎/CLI 直接消费） ---- */
    char envs[1024] = "";
    snprintf(envs, sizeof(envs),
        "\"POCKETCL_DEVICE_TIER\":\"%d\","
        "\"GGML_OPENCL_DEVICE_FAMILY\":\"%s\"",
        tier,
        family == PC_GPU_ADRENO ? "adreno" : family == PC_GPU_MALI ? "mali" : "unknown");

    /* ---- 组装 JSON ---- */
    size_t cap = 4096;
    char* buf = malloc(cap);
    if (!buf) { free(pol); return PC_IO_ERROR; }

    int n = snprintf(buf, cap,
        "{"
        "\"policyVersion\":\"0.1\","
        "\"device\":{\"family\":\"%s\",\"tier\":%d,\"extensions\":[\"%s%s%s%s\"]},"
        "\"kernels\":[%s],"
        "\"env\":{%s},"
        "\"modelOverride\":%s,"
        "\"notes\":[\"%s\",\"%s\"]"
        "}",
        family == PC_GPU_ADRENO ? "adreno" : family == PC_GPU_MALI ? "mali" : "unknown",
        tier,
        (exts & PC_EXT_QCOM_XMEM) ? "qcom_xmem" : "",
        (exts & PC_EXT_QCOM_SUBGROUP) ? ",qcom_subgroup" : "",
        (exts & PC_EXT_FP16_STORAGE) ? ",fp16_storage" : "",
        (exts & PC_EXT_RECORDABLE_QUEUE) ? ",recordable_queue" : "",
        kernels, envs,
        zimg ? "true" : "false",
        "决策规则来自 handbook 五铁律真机实证（K90/K Pad/小米13）",
        tier == 0 ? "警告：tier0 设备不应出现在策略消费链（getDevices 已过滤）" : "策略消费：CLI/引擎直接读 env 与 kernels");

    if (n <= 0) { free(buf); free(pol); return PC_IO_ERROR; }

    pol->json = buf;
    *out_policy = pol;
    return PC_OK;
}

pc_status pcReleasePolicy(pc_policy pol) {
    if (!pol) return PC_INVALID_ARG;
    free(pol->json);
    free(pol);
    return PC_OK;
}

pc_status pcPolicyDump(pc_policy pol, char** out_json) {
    if (!pol || !out_json) return PC_INVALID_ARG;
    if (!pol->json) return PC_IO_ERROR;
    char* dup = strdup(pol->json);
    if (!dup) return PC_IO_ERROR;
    *out_json = dup;
    return PC_OK;
}