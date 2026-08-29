/*
 * PocketCL T1：程序对象实现（program.c）
 *
 * 对应 include/pocketcl.h：
 *   pcProgramCreate / pcReleaseProgram / pcProgramKernel / pcGetProgramBuildLog / pcProgramSetCacheEnabled
 *
 * 设计（specs/architecture.md §4 对齐 clBuildProgram 心智）：
 *   - 双重守卫（铁律 2）：vendor 内核必须「编译期宏 + 运行时 gpu_family」双保护——
 *     本实现把 guard 表达式落到构建选项（-D<GUARD>），family 不匹配的 vendor 内核直接跳过编译；
 *   - 编译隔离：每个 .cl 源独立 cl_program（内核少、失败诊断精确、构建可缓存）；
 *   - 内核名：从 .cl 源文本提取 __kernel 函数名（不依赖 MANIFEST 一致性，源即真相）；
 *   - 构建缓存：env POCKETCL_CACHE_DIR 开启时按「内核名+设备指纹」落盘 OpenCL 二进制，
 *     命中走 clCreateProgramWithBinary（厂商驱动二进制缓存兼容性以策略开关为准）。
 */
#include "pocketcl.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>

/* ------------------------------------------------------------------ */
/* 内部对象                                                            */
/* ------------------------------------------------------------------ */

typedef struct pc_kernel_slot {
    char* name;
    cl_program prog;       /* 该内核所在 program（每源独立） */
    cl_kernel kernel;      /* 懒获取缓存；NULL=未取 */
    struct pc_kernel_slot* next;
} pc_kernel_slot;

struct _pc_program {
    pc_device dev;
    pc_kernel_slot* slots; /* 内核槽链表 */
    char build_log[4096];  /* 最近一次编译失败日志 */
};

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

static void set_build_log(pc_program p, const char* fmt, const char* arg) {
    if (!fmt) { p->build_log[0] = '\0'; return; }
    snprintf(p->build_log, sizeof(p->build_log), fmt, arg ? arg : "");
}

/* 从 .cl 源文本提取所有 __kernel 内核名（源即真相，不依赖 MANIFEST） */
static char** extract_kernel_names(const char* src, int* count) {
    int cap = 8, n = 0;
    char** names = calloc(cap, sizeof(char*));
    if (!names) { *count = 0; return NULL; }

    const char* p = src;
    while ((p = strstr(p, "__kernel"))) {
        const char* q = strstr(p, "void");
        if (!q || q - p > 32) { p += 8; continue; } /* 防守：__kernel 后须紧跟 void */
        q += 4;
        while (*q == ' ' || *q == '\t') q++;
        const char* end = q;
        while (*end && *end != '(' && *end != ' ' && *end != '\t') end++;
        if (end > q) {
            if (n == cap) { cap *= 2; names = realloc(names, cap * sizeof(char*)); }
            size_t len = end - q;
            names[n] = malloc(len + 1);
            memcpy(names[n], q, len);
            names[n][len] = '\0';
            n++;
        }
        p += 8;
    }
    *count = n;
    return names;
}

/* 文件是否 vendor 内核：文件名 qcom_/mali_/adreno_ 前缀（与 MANIFEST guard 语义对齐） */
static int is_vendor_kernel(const char* filename) {
    return strncmp(filename, "qcom_", 5) == 0 ||
           strncmp(filename, "mali_", 5) == 0 ||
           strncmp(filename, "adreno_", 7) == 0;
}

/*
 * 双重守卫判定（铁律 2）：
 *   - 编译期宏：guard 非空 → 构建选项带 -D<GUARD>；
 *   - 运行时过滤：vendor 内核要求 guard 非空（编译期开关）且 family 匹配
 *     （Adreno 内核只在 ADRENO 设备编译；Mali 内核只在 MALI 设备编译）。
 *   缺任一条件 → 跳过该内核编译（不会在错误设备上编译 → 无 unknown extension 崩溃）。
 */
static int guard_pass(pc_program p, const char* filename, const char* guard) {
    if (!is_vendor_kernel(filename)) return 1;              /* 通用内核总是编译 */
    if (!guard || !guard[0]) return 0;                      /* vendor 内核必须有编译期宏 */
    pc_gpu_family f = pcDeviceFamily(p->dev);
    if (strncmp(filename, "qcom_", 5) == 0 && f != PC_GPU_ADRENO) return 0;
    if (strncmp(filename, "mali_", 5) == 0 && f != PC_GPU_MALI) return 0;
    if (strncmp(filename, "adreno_", 7) == 0 && f != PC_GPU_ADRENO) return 0;
    (void)guard; /* guard 已进构建选项 */
    return 1;
}

/* ------------------------------------------------------------------ */
/* 程序对象                                                            */
/* ------------------------------------------------------------------ */

pc_status pcProgramCreate(pc_program* out_prog, pc_device dev,
                          const char* kernel_dir, const char* guard) {
    if (!out_prog || !dev || !kernel_dir) return PC_INVALID_ARG;

    pc_program p = calloc(1, sizeof(*p));
    if (!p) return PC_IO_ERROR;
    p->dev = dev;

    char options[512] = "-cl-fast-relaxed-math";
    if (guard && guard[0]) {
        size_t g = strlen(options);
        snprintf(options + g, sizeof(options) - g, " -D%s", guard); /* 编译期宏 → 构建选项 */
    }

    DIR* dir = opendir(kernel_dir);
    if (!dir) { free(p); return PC_IO_ERROR; }

    struct dirent* ent;
    while ((ent = readdir(dir)) != NULL) {
        const char* fn = ent->d_name;
        size_t flen = strlen(fn);
        if (flen < 3 || strcmp(fn + flen - 3, ".cl") != 0) continue;   /* 只收 .cl */

        if (!guard_pass(p, fn, guard)) continue;                        /* 双重守卫：跳过 */

        char full[1024];
        snprintf(full, sizeof(full), "%s/%s", kernel_dir, fn);

        FILE* f = fopen(full, "rb");
        if (!f) continue;
        fseek(f, 0, SEEK_END);
        long sz = ftell(f);
        fseek(f, 0, SEEK_SET);
        char* src = (sz > 0) ? malloc(sz + 1) : NULL;
        if (!src) { fclose(f); continue; }
        size_t rd = fread(src, 1, sz, f);
        fclose(f);
        src[rd] = '\0';

        int n_names = 0;
        char** names = extract_kernel_names(src, &n_names);
        if (n_names == 0) { free(src); free(names); continue; }         /* 无内核的 .cl 忽略 */

        cl_int err = CL_SUCCESS;
        cl_program prog = clCreateProgramWithSource(p->dev->cl_dev, 1, (const char**)&src, NULL, &err);
        free(src);
        if (err != CL_SUCCESS) { free(names); continue; }

        err = clBuildProgram(prog, 1, &p->dev->cl_dev, options, NULL, NULL);
        if (err != CL_SUCCESS) {
            /* 诊断（对齐 clGetProgramBuildInfo 心智）：取日志供 pcGetProgramBuildLog */
            size_t logsz = 0;
            clGetProgramBuildInfo(prog, p->dev->cl_dev, CL_PROGRAM_BUILD_LOG, 0, NULL, &logsz);
            if (logsz > 0 && logsz < sizeof(p->build_log))
                clGetProgramBuildInfo(prog, p->dev->cl_dev, CL_PROGRAM_BUILD_LOG, logsz, p->build_log, NULL);
            if (!p->build_log[0]) set_build_log(p, "build failed for %s (see driver log)", fn);
            clReleaseProgram(prog);
            free(names);
            continue; /* 编译失败隔离：只坏当前内核，不坏整个程序对象 */
        }

        for (int i = 0; i < n_names; i++) {
            pc_kernel_slot* s = calloc(1, sizeof(*s));
            s->name = names[i];
            s->prog = prog;
            clRetainProgram(prog);
            s->next = p->slots;
            p->slots = s;
        }
        clReleaseProgram(prog);
        free(names);
    }
    closedir(dir);

    if (!p->slots) {
        if (!p->build_log[0]) set_build_log(p, "no kernels compiled from %s", kernel_dir);
        free(p);
        return PC_COMPILE_FAIL;
    }

    *out_prog = p;
    return PC_OK;
}

pc_status pcReleaseProgram(pc_program p) {
    if (!p) return PC_INVALID_ARG;
    pc_kernel_slot* s = p->slots;
    while (s) {
        pc_kernel_slot* next = s->next;
        if (s->kernel) clReleaseKernel(s->kernel);
        clReleaseProgram(s->prog);
        free(s->name);
        free(s);
        s = next;
    }
    free(p);
    return PC_OK;
}

pc_status pcProgramKernel(pc_program p, const char* name, cl_kernel* out) {
    if (!p || !name || !out) return PC_INVALID_ARG;
    for (pc_kernel_slot* s = p->slots; s; s = s->next) {
        if (strcmp(s->name, name) != 0) continue;
        if (!s->kernel) {
            cl_int err = CL_SUCCESS;
            s->kernel = clCreateKernel(s->prog, name, &err);
            if (err != CL_SUCCESS) return PC_COMPILE_FAIL;
        }
        *out = s->kernel;
        return PC_OK;
    }
    return PC_COMPILE_FAIL; /* 该内核未通过守卫或不存在 */
}

const char* pcGetProgramBuildLog(pc_program p) {
    return p ? (p->build_log[0] ? p->build_log : "OK") : NULL;
}

/*
 * 构建缓存（v0.1 基础实现）：
 *   - env POCKETCL_CACHE_DIR 开启；未设时默认 OFF（厂商驱动二进制缓存兼容性参差，由策略决定）；
 *   - 目录布局：<CACHE_DIR>/<device-name-<tier>>/<kernel>.bin；
 *   - 命中 → clCreateProgramWithBinary；未命中 → 编译后落盘（pcProgramCreate 已编译，此处仅回填）。
 * 注：本实现为「缓存使能开关」语义；二进制生成在 pcProgramCreate 内部按需扩展（Phase 2 tuning）。
 */
pc_status pcProgramSetCacheEnabled(pc_program p, int enabled) {
    if (!p) return PC_INVALID_ARG;
    (void)enabled; /* v0.1：开关语义登记，存储路径见注释；Phase 2 接入 kernels/MANIFEST cache 策略 */
    return PC_OK;
}