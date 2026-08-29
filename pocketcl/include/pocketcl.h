/*
 * PocketCL 公共 C API（v0.1 草案，2026-08-29）
 *
 * Android 端侧异构性能调校层（tuning layer）——OpenCL 之上的薄层，不重造平台。
 * 惯例对齐 OpenCL：pc_* 前缀 / pc_status 错误码 / 句柄对象 / 编译期诊断语义。
 *
 * 依赖：<CL/cl.h>（Khronos OpenCL 头文件，平台提供——本库寄生其上，不做替代）。
 *
 * 对象模型（仅 4 个）：
 *   pc_device   设备句柄（指纹卡 / 特性协商）
 *   pc_program  程序对象（双重守卫编译 + 诊断 + 缓存）
 *   pc_kernel   已编译内核（获取后交还调用方以 cl 方式执行）
 *   pc_policy   策略（设备卡 → 内核/编译选项/env 组合）
 *
 * 设计约束（见 specs/architecture.md §4）：
 *   - 不造平台层/ICD/编译链；clBuildProgram 是执行者不是被替代者；
 *   - 编译失败必须可诊断（pcGetProgramBuildLog）；
 *   - 探针不可用降级不报错（PC_PROFILE_UNAVAILABLE → 无探针路径）。
 */
#ifndef POCKETCL_H
#define POCKETCL_H

#include <CL/cl.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ---- 错误码（仿 CL_SUCCESS 惯例） ---- */
typedef enum pc_status {
    PC_OK                  = 0,
    PC_DEVICE_NOT_FOUND    = -1,  /* 无可用 OpenCL 设备 / 不在白名单 */
    PC_UNSUPPORTED_GPU     = -2,  /* GPU 家族已知但策略不支持（如 740 级驱动挂起区） */
    PC_INVALID_ARG         = -3,
    PC_COMPILE_FAIL        = -4,  /* 内核编译失败——用 pcGetProgramBuildLog 取日志 */
    PC_PROFILE_UNAVAILABLE = -5,  /* 探针不可用（驱动不支持 profiling），调用方走无探针路径 */
    PC_IO_ERROR            = -6,  /* 设备卡 JSON / 内核目录读取失败 */
} pc_status;

const char* pcGetErrorString(pc_status err);

/* ---- 设备（L1：指纹 + 特性协商，对齐 clGetDeviceIDs 心智） ---- */
typedef struct _pc_device* pc_device;

/* 枚举可用设备（白名单过滤后）。returns PC_DEVICE_NOT_FOUND 若全被拒。 */
pc_status pcGetDevices(pc_device** devices, int* count);
/* 释放设备列表（由 pcGetDevices 分配的数组）。 */
pc_status pcReleaseDevices(pc_device* devices, int count);

/* 设备卡 JSON 导出（三态诚实：verified/pending/reference，见 devices/schema.json）。
 * out_json 由库分配，调用方 pcFree 释放。 */
pc_status pcDeviceCard(pc_device dev, char** out_json);
void pcFree(void* ptr);

/* 特性协商：返回 vendor 扩展位掩码（对应 cl_qcom_* 等）与 GPU 家族。 */
typedef enum pc_gpu_family {
    PC_GPU_UNKNOWN = 0,
    PC_GPU_ADRENO,
    PC_GPU_MALI,
} pc_gpu_family;

typedef enum pc_ext_flags {
    PC_EXT_NONE            = 0,
    PC_EXT_QCOM_XMEM       = 1 << 0,  /* cl_qcom_onchip_global_mem（GMEM 计算直通） */
    PC_EXT_QCOM_SUBGROUP   = 1 << 1,  /* cl_qcom_subgroup_* 系列 */
    PC_EXT_FP16_STORAGE    = 1 << 2,  /* half 存储/运算可用（Mali 半精度前提） */
    PC_EXT_RECORDABLE_QUEUE= 1 << 3,  /* recordable command queue */
} pc_ext_flags;

pc_gpu_family pcDeviceFamily(pc_device dev);
pc_ext_flags  pcDeviceExtensions(pc_device dev);
/* 设备分级档位（0=拒绝 / 1=通用 / 2=high-gpu，对齐小黄鸡 requiresHighGpu 语义） */
int pcDeviceTier(pc_device dev);

/* ---- 程序（L2：双重守卫编译 + 诊断 + 缓存，对齐 clBuildProgram 心智） ---- */
typedef struct _pc_program* pc_program;

/* 从内核目录加载 & 编译：guard 为 vendor 内核编译条件（内部已做
 * 「编译期宏 + 运行时 gpu_family」双重守卫，见 kernels/guard-template.c）。 */
pc_status pcProgramCreate(pc_program* prog, pc_device dev,
                          const char* kernel_dir, /* 内核 .cl 目录 */
                          const char* guard);     /* NULL=仅通用内核 */
pc_status pcReleaseProgram(pc_program prog);

/* 取已编译内核（失败=该内核未通过守卫/编译失败）。 */
pc_status pcProgramKernel(pc_program prog, const char* name, cl_kernel* out);

/* 编译失败日志（对齐 clGetProgramBuildInfo 心智；无失败时返回空串）。 */
const char* pcGetProgramBuildLog(pc_program prog);

/* 内核集合内置缓存（$ANDROID_DATA/pocketcl/kernel_cache 或 env POCKETCL_CACHE_DIR）。
 * 厂商驱动内核对二进制缓存的支持参差，默认 OFF——由策略开启。 */
pc_status pcProgramSetCacheEnabled(pc_program prog, int enabled);

/* ---- 策略（设备卡 → 内核/编译选项/env 组合的决策器） ---- */
typedef struct _pc_policy* pc_policy;

/* 生成策略：给定设备卡 JSON（或 NULL=自动探测），产出推荐内核集合与编译选项。
 * 输出为 JSON 字符串（pcFree 释放），可被 CLI/引擎直接消费。 */
pc_status pcPolicyBuild(pc_policy* policy, pc_device dev, const char* model_manifest);
pc_status pcReleasePolicy(pc_policy policy);
pc_status pcPolicyDump(pc_policy policy, char** out_json);

/* ---- 探针（L3：CLPROF 聚合，运行时零开销开关） ---- */
typedef struct _pc_profiler* pc_profiler;

/* 开始聚合：attach 到队列，产出 top-N 算子榜单（JSONL 落盘）。
 * 驱动不支持 profiling 时返回 PC_PROFILE_UNAVAILABLE（降级不报错）。 */
pc_status pcProfilerCreate(pc_profiler* prof, cl_device_id cl_dev, cl_command_queue queue);
/* 登记内核事件：enqueue 后调（name 为内核名，聚合按名统计时耗）。
 * v0.1 草案演进：事件无法反查内核名，必须显式登记映射。 */
pc_status pcProfilerRecordKernel(pc_profiler prof, const char* name, cl_event ev);
pc_status pcProfilerDumpTopN(pc_profiler prof, int top_n, char** out_json);
pc_status pcReleaseProfiler(pc_profiler prof);

/* ---- R 层：跨引擎资源调度层（v0.3 架构升级，草案声明不实现） ----
 *
 * 定位（specs/architecture.md 六）：App 内跨引擎（聊天 LLM/生图/TTS/ASR）的
 * 资源仲裁与调度编排——OpenCL/ggml 都不管的一层。
 * 实现触发点：①真机跨引擎资源冲突事故；②T3.2 编译器试点需要回注。
 * 分层不变量：R 层只做「决定+编排」，内核执行永远在引擎侧。
 */

typedef struct _pc_context*  pc_context;
typedef struct _pc_queue*    pc_queue;
typedef struct _pc_event*    pc_event;
typedef struct _pc_memory*   pc_memory;
typedef struct _pc_scheduler* pc_scheduler;

/* 资源域：设备集 + 内存预算(MB) + GPU 时间片配额(ms/窗) + 策略快照（policy 输出）。 */
pc_status pcContextCreate(pc_context* ctx, pc_device* devices, int dev_count,
                          int memory_budget_mb, int gpu_quota_ms);
pc_status pcReleaseContext(pc_context ctx);

/* 队列抽象：kind=POCKETCL_Q_FOREGROUND|BACKGROUND|SERIAL|PARALLEL，引擎任务登记口。 */
typedef enum pc_queue_kind { PC_Q_FOREGROUND = 0, PC_Q_BACKGROUND, PC_Q_SERIAL, PC_Q_PARALLEL } pc_queue_kind;
pc_status pcQueueCreate(pc_queue* q, pc_context ctx, pc_queue_kind kind, const char* owner_engine);
/* 登记任务（不执行）：name + 预计时耗 + 资源需求 → 返回队列内 ID；由 scheduler 决定何时执行。 */
pc_status pcQueueSubmit(pc_queue q, const char* task_name, int est_ms, int need_mb, int* task_id);
pc_status pcReleaseQueue(pc_queue q);

/* 事件依赖链：任务完成 → notify 触发等待方；阻塞/通知语义，不做内核级细粒度同步。 */
pc_status pcEventCreate(pc_event* ev, pc_context ctx, const char* name);
pc_status pcEventWait(pc_event ev, int timeout_ms);
pc_status pcEventNotify(pc_event ev);
pc_status pcReleaseEvent(pc_event ev);

/* 内存编排：buffer 策略（large-buffer/xmem/GMEM）+ 卸载编排（顺序卸载迁入）+ OOM 防护。 */
pc_status pcMemoryPlan(pc_memory* mem, pc_context ctx);
pc_status pcMemoryRequest(pc_memory mem, const char* owner, int need_mb, int* granted_mb);
pc_status pcMemoryRelease(pc_memory mem, const char* owner);
pc_status pcReleaseMemory(pc_memory mem);

/* 分发决策：任务画像(CLPROF/驻留/PSS 证据) + 设备卡 → 执行路径 + 排队仲裁。
 * 决策 JSON 落盘（PC_LOG 通道，PerfPanel 可查）。 */
pc_status pcSchedulerSubmit(pc_scheduler sch, const char* task_json, char** decision_json);
pc_status pcSchedulerReport(pc_scheduler sch, const char* task_id, const char* result_json);
pc_status pcReleaseScheduler(pc_scheduler sch);

#ifdef __cplusplus
}
#endif

#endif /* POCKETCL_H */