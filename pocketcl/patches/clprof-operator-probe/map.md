# CLPROF 算子级探针 — 改动地图（clprof-operator-probe）

> 载体：`android/app/src/main/cpp/stable-diffusion.cpp/ggml/src/ggml-opencl.cpp`
> 整理：2026-08-29（行号以当日工作副本为准，rebase 后按 hunk 标志对位——禁止直接按行号迁移）
> 对应：handbook 铁律 1（先 profiling 再优化），Probe CLI 消费端：`pocketcl/cli/probe-topn.js`

## 设计意图

算子级耗时探针：编译期常驻（无损行为），运行期 `GGML_OPENCL_PROFILING` env 门控开启
（`CL_QUEUE_PROFILING_ENABLE`），任务结束打印 top-N 榜单到 logcat，PC 端聚合分析。

## Hunk 1：include（40-41 行）

```cpp
#include <tuple>      // 8-25 探针：[CLPROF] 聚合排序
#include <algorithm>  // 8-25 探针：std::sort
```

- 意图：榜单聚合（(ms, calls, name) 元组 + sort）。
- 回归要点：纯头文件增加，零行为影响。

## Hunk 2：事件取时（721-730 行）

```cpp
info.evt, CL_PROFILING_COMMAND_QUEUED, sizeof(cl_ulong), &cmd_queued, NULL));
CL_CHECK(clGetEventProfilingInfo(
info.evt, CL_PROFILING_COMMAND_SUBMIT, sizeof(cl_ulong), &cmd_submit, NULL));
CL_CHECK(clGetEventProfilingInfo(
info.evt, CL_PROFILING_COMMAND_START, sizeof(cl_ulong), &cmd_start, NULL));
CL_CHECK(clGetEventProfilingInfo(
info.evt, CL_PROFILING_COMMAND_END, sizeof(cl_ulong), &cmd_end, NULL));
CL_CHECK(clGetEventProfilingInfo(
info.evt, CL_PROFILING_COMMAND_COMPLETE, sizeof(cl_ulong), &cmd_complete, NULL));
```

- 意图：五段全取（排队/提交/开始/结束/完成），榜单用 START→END 收敛算子真实耗时。
- 回归要点：仅在 profiling 队列下有效；解析失败 CL_CHECK 已有统一路径。

## Hunk 3：榜单输出（782-789 行）

```cpp
GGML_LOG_INFO("[CLPROF] === kernel time top %zu (total %.1f ms, %zu calls) ===\n",
                      sorted.size(), total_ms, profiling_results.size());
size_t shown = 0;
...
GGML_LOG_INFO("[CLPROF] %8.2f ms (%5.1f%%) x%-6zu %s\n",
                          std::get<0>(t) / 1e6,
                          total_ms > 0 ? 100.0 * (std::get<0>(t) / 1e6) / total_ms : 0.0,
                          std::get<2>(t), std::get<1>(t).c_str());
```

- 意图：席位固定格式（`ms [pct%] xN name`），被 `probe-topn.js` 正则直读。
- 回归要点：格式即协议，改格式必须同步 cli/probe-topn.js 与本文档。

## Hunk 4：env 门控（4437-4439 行）

```cpp
command_queue_props |= CL_QUEUE_PROFILING_ENABLE;
GGML_LOG_INFO("ggml_opencl: operator-level profiling ENABLED (B-line deep probe)\n");
```

- 意图：`GGML_OPENCL_PROFILING` 存在时开启队列 profiling（外层 if 判定 env）。
- 回归要点：默认 OFF = 队列属性不变、零开销——这是"探针可进上游"的前提。

## Hunk 5：mm 形状诊断（14316 行）

```cpp
GGML_LOG_INFO("[CLPROF] mm a=%s:t%d:ne=%d,%d,%d,%d:nb=%llu,%llu,%llu,%llu b=... d=...\n", ...);
```

- 意图：定位具体 GEMM 形状（混合精度/形状回退排查）；Probe CLI 忽略此格式（诊断细节）。
- 回归要点：与 Hunk 3 同 gate。可拆独立 PR。

## 证据（真机实证）

2026-08-14 K Pad（Mali-G925 / turner）：`mul_mm_q4_k/q5_k_f32_l4_lm` 合计 **71.1%**、
`mul_mm_f32_f32_l4_lm` 7.6%、`mul_mv_q4_k_f32` flat 仅 **0.1%** —— 据此才把优化投到 tiled GEMM
（半精度 2.86-3.42×）。无探针时首轮凭经验改 flat 内核只拿 1.09×，方向性浪费实锤。

## 上游 PR 建议

1. 单 PR 一粒资产；message 注明基准版本 + 门控语义 + 附 exemplar 榜单；
2. Hunk 5 可拆独立 PR（诊断行与榜单功能正交）；
3. 随 PR 附带 `cli/probe-topn.js` 同级工具提交（或指向 PocketCL 仓库）。