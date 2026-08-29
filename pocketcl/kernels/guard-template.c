/*
 * PocketCL 双重守卫样板（guard template）
 *
 * 规则：任何 vendor-specific 扩展内核（cl_qcom_* 等）必须双保护：
 *   ① 编译期宏——是否构建进二进制（构建系统决定）；
 *   ② 运行时 gpu_family 过滤——是否把该内核编译进 OpenCL context。
 * 编译期宏 ≠ 运行时能力：只靠 #ifdef，Mali 设备也会尝试编译 qcom 内核，
 * 驱动直接报错/崩溃（实测：cl_qcom_subgroup_uniform_load / qcom_get_physical_sub_group_id）。
 *
 * 这是模式样板，不是某个引擎的完整实现；接入时按目标引擎的组织方式改写。
 */

typedef enum gpu_family {
    GPU_FAMILY_UNKNOWN = 0,
    GPU_FAMILY_ADRENO,
    GPU_FAMILY_MALI,
    GPU_FAMILY_OTHER,
} gpu_family;

/* 在引擎初始化时经 clGetDeviceInfo(CL_DEVICE_NAME) / 厂商串判定一次，
 * 不要每次编译内核都重复判定。判定函数由接入方实现。 */
gpu_family backend_gpu_family(void);

/* 是否编译 vendor-specific 内核：编译期宏 + 运行时家族双条件
 * （GGML 系引擎可用 GGML_OPENCL_USE_ADRENO_KERNELS 一类编译期开关配合运行时过滤） */
static int should_compile_vendor_kernels(void) {
#if defined(ENABLE_VENDOR_KERNELS) /* ① 编译期宏：构建开关 */
    return backend_gpu_family() == GPU_FAMILY_ADRENO; /* ② 运行时过滤 */
#else
    (void)0;
    return 0;
#endif
}

/* 使用样例：任何 qcom 内核加载块都必须走这个守卫 */
int load_kernels(void) {
    if (should_compile_vendor_kernels()) {
        /* 仅 Adreno 到达这里；Mali 跳过编译走通用 fp32 路径 */
        /* clBuildProgram(qcom_kernels...); */
    }
    /* 通用内核无条件编译，作为跨厂商保底路径 */
    return 0;
}

/*
 * 配套纪律：
 * - 白名单决定「设备是否被接受」，编译过滤决定「哪些内核被编译」，两层各管各的；
 * - 新增 vendor 内核必须自带守卫，代码 review 时把这条当硬检查项；
 * - 添加非目标 GPU 的实测回归（如 Mali 上跑一遍编译加载路径）再声称完成。
 */