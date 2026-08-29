/*
 * PocketCL Mali 半精度模式样板（half-prec template）
 *
 * 对应 handbook 铁律 3：半精度只碰存储，累加恒 fp32。
 * 适用场景：Mali（Midgard/Bifrost/Valhall/5th Gen）OpenCL tiled GEMM 提速。
 * 实测增益：mul_mm_q4_k/q5_k_f32_l4_lm 变体 512² 2.86×、512×768 3.42×（nan=0 画质无损）。
 *
 * 这是模式展示（片段），不是可编译完整内核；接入时按目标引擎的
 * 数据结构（block_q4_k 等）与 kernel 汇编方式改写。
 */

/* 常量定义示例（接入方提供） */
#define K_TILE 64  /* K 方向 tile 大小 */
#define VEC_HALF  8 /* half 向量宽度（Mali 建议 8） */

/* half4 向量化：Mali 编译器对标量 half 生成病态代码，向量化即解（铁律 3 实操） */
typedef half  half_vec __attribute__((ext_vector_type(VEC_HALF)));

__kernel void mali_half_prec_tiled_example(
    __global const half  *A,      /* 权重 A（half 存储，本地缓冲用半精度）      */
    __global const float *B,      /* 激活 B（按引擎实际类型调整，可为 half）    */
    __global float       *C,      /* 输出恒 fp32（下游不需要 half 输出）        */
    const int M, const int N, const int K)
{
    /* ① half local 缓冲：把 A 的 tile 以 half 向量加载进 local（带宽减半） */
    __local half_vec A_tile[??][K_TILE / VEC_HALF];

    /* ... tile 加载与 barrier 省略（模式示意）... */

    /* ② 累加器恒 fp32 —— 铁律 3 的核心：乘法可以用 half，累加必须 fp32 */
    float acc = 0.0f;              /* 单个 fp32 累加器，禁止 half acc */

    /* 或向量化 fp32 累加器（推荐）： */
    /* float4 acc4 = (float4)(0.0f, 0.0f, 0.0f, 0.0f); */

    for (int kk = 0; kk < K_TILE; kk += VEC_HALF) {
        /* ③ half 乘法（精度够用），立即升 fp32 累加 */
        half_vec av = A_tile[/*row*/][kk / VEC_HALF];
        #pragma unroll
        for (int i = 0; i < VEC_HALF; i++) {
            acc += (float)av[i] * B[/*col*/ * K + /*base*/ + kk + i];
        }
    }

    C[/*out*/] = acc; /* fp32 输出 */
}

/*
 * 应用检查清单（接入 mul_mm_q4_k_f32_l4_lm 等内核时对照）：
 * [ ] 权重反量化后以 half 存 local（半精度红利在 local 带宽，不在 global）
 * [ ] 乘法保留 half 或 half*float，累加恒 float
 * [ ] 向量宽度与 Mali 建议一致（标量 half 会触发病态代码生成）
 * [ ] 门控：PP_MALI_FP16_LM 一类编译期 env 开关，Adreno 不受影响（各走各的）
 * [ ] fp32 累加铁律回归：nan=0 + 值域校验（±5 内）再做性能宣称
 * [ ] 全 fp16 累积方案直接否决（6.18 NaN 事故）
 *
 * 已知边界：
 * - 半精度红利只在 tiled GEMM（画幅越大 GEMM 占比越高）；flat GEMV 无收益，别白改；
 * - Mali 驱动对 half 的支持程度按设备 whitelist 分级（PocketCL devices/*.json）；
 * - 值域 > ±65504 的中间量（如 Z-Image cross-attn ±1e4 上限附近）需按模型单独评估，
 *   不能无脑全局半精度（K90 上 Z-Image 用双禁用保稳定即为此类）。
 */