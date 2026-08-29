/*
 * PocketCL T1：探针实现（profiler.c）——CLPROF 聚合器
 *
 * 对应 include/pocketcl.h：
 *   pcProfilerCreate / pcProfilerRecordKernel / pcProfilerDumpTopN / pcReleaseProfiler
 *
 * 设计（specs/architecture.md §4 对齐铁律 1）：
 *   - 先 profiling 再优化：算子级时耗榜单是每一步优化的入口（71.1% tiled GEMM 热点实证）；
 *   - 队列必须 CL_QUEUE_PROFILING_ENABLE 打开，否则 PC_PROFILE_UNAVAILABLE 降级（不报错）；
 *   - 事件无法反查内核名 → RecordKernel 显式登记 name→event 映射（v0.1 草案演进）；
 *   - 聚合语义：CL_COMPLETE 回调里 clGetEventProfilingInfo 取 START/END，
 *     按内核名累加总时耗/次数，DumpTopN 输出榜单 JSON（手写拼接，零依赖）。
 *
 * 线程模型（v0.1）：回调写内部桶，DumpTopN 前调用方应确保队列已 finish
 * （clFinish）——单线程消费场景下无锁即可；多线程接入需加 mutex（Phase 2）。
 */
#include "pocketcl.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ------------------------------------------------------------------ */
/* 内部对象                                                            */
/* ------------------------------------------------------------------ */

typedef struct pc_kernel_bucket {
    char* name;
    size_t calls;
    unsigned long long total_ns;  /* 已聚合总时耗 */
    unsigned long long max_ns;
    struct pc_kernel_bucket* next;
} pc_kernel_bucket;

struct _pc_profiler {
    cl_device_id cl_dev;
    pc_kernel_bucket* buckets;    /* 按名聚合桶 */
    int dropped;                  /* 失败/跳过登记计数（可诊断） */
};

/* ------------------------------------------------------------------ */
/* 回调与登记                                                          */
/* ------------------------------------------------------------------ */

static void pc_profiler_complete(cl_event ev, cl_int status, pc_profiler prof); /* 前置声明 */

static void CL_CALLBACK profiler_complete_cb(cl_event ev, cl_int status, void* user) {
    pc_profiler_complete(ev, status, (pc_profiler)user);
}

/* —— v0.1 实现选型：pending 表 ——
 * clSetEventCallback 的回调没有 user_data 之外的上下文通道；为拿到内核名，
 * 登记时把 name 记入 pending 表（event 号为键），回调完成时查表取桶累加。
 * 表容量固定（PENDING_CAP），超出丢弃并计数（dropped），永不阻塞调用方。 */

#define PENDING_CAP 512
typedef struct pc_pending_entry {
    cl_event ev;
    pc_kernel_bucket* bucket;
    int free_slot;
} pc_pending_entry;

static pc_pending_entry g_pending[PENDING_CAP];
static int g_pending_head = 0; /* 循环位图，简易分配：登记取首个 free */

static pc_kernel_bucket* find_or_add_bucket(pc_profiler prof, const char* name) {
    for (pc_kernel_bucket* b = prof->buckets; b; b = b->next)
        if (strcmp(b->name, name) == 0) return b;

    pc_kernel_bucket* b = calloc(1, sizeof(*b));
    if (!b) return NULL;
    b->name = strdup(name);
    b->next = prof->buckets;
    prof->buckets = b;
    return b;
}

static void pc_profiler_complete(cl_event ev, cl_int status, pc_profiler prof) {
    if (status != CL_COMPLETE) return;
    (void)prof; /* v0.1 单实例：pending 表为静态；多实例时移入 prof（Phase 2） */

    cl_ulong start = 0, end = 0;
    if (clGetEventProfilingInfo(ev, CL_PROFILING_COMMAND_START, sizeof(start), &start, NULL) != CL_SUCCESS ||
        clGetEventProfilingInfo(ev, CL_PROFILING_COMMAND_END, sizeof(end), &end, NULL) != CL_SUCCESS)
        return;
    unsigned long long cost = (unsigned long long)(end - start);

    for (int i = 0; i < PENDING_CAP; i++) {
        pc_pending_entry* e = &g_pending[i];
        if (e->free_slot) continue;
        if (e->ev == ev) {
            e->free_slot = 1;
            if (e->bucket) {
                e->bucket->calls++;
                e->bucket->total_ns += cost;
                if (cost > e->bucket->max_ns) e->bucket->max_ns = cost;
            }
            return;
        }
    }
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

pc_status pcProfilerCreate(pc_profiler* out_prof, cl_device_id cl_dev, cl_command_queue queue) {
    if (!out_prof || !cl_dev || !queue) return PC_INVALID_ARG;

    /* 队列必须开启 profiling（铁律 1 前置）；否则降级不报错 */
    cl_command_queue_properties props = 0;
    if (clGetCommandQueueInfo(queue, CL_QUEUE_PROPERTIES, sizeof(props), &props, NULL) != CL_SUCCESS)
        return PC_PROFILE_UNAVAILABLE;
    if (!(props & CL_QUEUE_PROFILING_ENABLE)) return PC_PROFILE_UNAVAILABLE;

    pc_profiler prof = calloc(1, sizeof(*prof));
    if (!prof) return PC_IO_ERROR;
    prof->cl_dev = cl_dev;

    for (int i = 0; i < PENDING_CAP; i++) { g_pending[i].free_slot = 1; g_pending[i].ev = NULL; }

    *out_prof = prof;
    return PC_OK;
}

pc_status pcProfilerRecordKernel(pc_profiler prof, const char* name, cl_event ev) {
    if (!prof || !name || !ev) return PC_INVALID_ARG;

    pc_kernel_bucket* b = find_or_add_bucket(prof, name);
    if (!b) { prof->dropped++; return PC_IO_ERROR; }

    int slot = -1;
    for (int i = 0; i < PENDING_CAP; i++) {
        if (g_pending[i].free_slot) { slot = i; break; }
    }
    if (slot < 0) { prof->dropped++; return PC_IO_ERROR; } /* 表满丢弃（不阻塞调用方） */

    g_pending[slot].ev = ev;
    g_pending[slot].bucket = b;
    g_pending[slot].free_slot = 0;

    cl_int err = clSetEventCallback(ev, CL_COMPLETE, profiler_complete_cb, prof);
    if (err != CL_SUCCESS) { g_pending[slot].free_slot = 1; prof->dropped++; return PC_PROFILE_UNAVAILABLE; }
    return PC_OK;
}

/*
 * 榜单输出（对齐铁律 1：先出算子榜单再动手）：
 * {
 *   "top": 5,
 *   "totalKernels": 12,
 *   "dropped": 0,
 *   "entries": [
 *     {"name":"mul_mm_q4_k_f32_l4_lm","calls":42,"totalMs":123.4,"maxMs":8.2,"pctOfTotal":61.2}, ...
 *   ]
 * }
 */
pc_status pcProfilerDumpTopN(pc_profiler prof, int top_n, char** out_json) {
    if (!prof || !out_json || top_n <= 0) return PC_INVALID_ARG;

    /* 收集 → 简单选择排序取 top-N（桶少，O(n*top) 足够，锋利不引库） */
    int total_buckets = 0;
    unsigned long long total_ns_all = 0;
    for (pc_kernel_bucket* b = prof->buckets; b; b = b->next) {
        total_buckets++;
        total_ns_all += b->total_ns;
    }

    int n_out = total_buckets < top_n ? total_buckets : top_n;
    pc_kernel_bucket** sorted = calloc(n_out ? n_out : 1, sizeof(pc_kernel_bucket*));
    if (!sorted) return PC_IO_ERROR;

    /* 重复选择最大（简单选择排序） */
    pc_kernel_bucket* remainder = prof->buckets;
    for (int i = 0; i < n_out; i++) {
        pc_kernel_bucket* best = NULL, **prev_link = NULL;
        pc_kernel_bucket** link = &remainder;
        while (*link) {
            if (!best || (*link)->total_ns > best->total_ns) { best = *link; prev_link = link; }
            link = &(*link)->next;
        }
        if (!best) break;
        sorted[i] = best;
        *prev_link = best->next; /* 摘出 */
    }

    size_t cap = 2048 + n_out * 256;
    char* buf = malloc(cap);
    if (!buf) { free(sorted); return PC_IO_ERROR; }

    size_t off = 0;
    off += (size_t)snprintf(buf + off, cap - off,
        "{\"top\":%d,\"totalKernels\":%d,\"dropped\":%d,\"entries\":[",
        n_out, total_buckets, prof->dropped);

    for (int i = 0; i < n_out && off < cap - 256; i++) {
        pc_kernel_bucket* b = sorted[i];
        double pct = total_ns_all ? (double)b->total_ns * 100.0 / (double)total_ns_all : 0.0;
        off += (size_t)snprintf(buf + off, cap - off,
            "%s{\"name\":\"%s\",\"calls\":%zu,\"totalMs\":%.1f,\"maxMs\":%.1f,\"pctOfTotal\":%.1f}",
            i ? "," : "", b->name, b->calls,
            (double)b->total_ns / 1e6, (double)b->max_ns / 1e6, pct);
    }
    snprintf(buf + off, cap - off, "]}");

    free(sorted);
    *out_json = buf;
    return PC_OK;
}

pc_status pcReleaseProfiler(pc_profiler prof) {
    if (!prof) return PC_INVALID_ARG;
    pc_kernel_bucket* b = prof->buckets;
    while (b) {
        pc_kernel_bucket* next = b->next;
        free(b->name);
        free(b);
        b = next;
    }
    free(prof);
    return PC_OK;
}