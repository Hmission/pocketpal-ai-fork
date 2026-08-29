# PocketCL

**Android 端侧异构性能调校层（tuning layer）——把手机 SoC 的纸面算力变成实际吞吐。**

上游引擎（ggml / llama.cpp / sd.cpp）解决「跨平台能跑」，PocketCL 解决「在 Adreno / Mali 上榨干」：设备指纹 DB → 内核选择 → 跑分回注 的闭环工具集。

> 状态：**Phase 1 T0 实体化（2026-08-29，本地开发中）**——骨架与第一份资产，尚未发布。
> 定位与战略基准见小黄鸡仓 `docs/POCKETPAL_OPEN_KERNEL_PLAN.md`（内部文档）。

## 目录

```
pocketcl/
├── include/pocketcl.h     # 公共 C API（v0.2 草案：T1 四对象 + R 层五对象声明）
├── src/                   # Core 实现（device / program / policy / profiler，占位待 T1）
├── specs/architecture.md  # 架构落地 v0.3（L1/L2/L3 + API 布局 + R 层调度层）
├── devices/               # 设备指纹卡（JSON schema + 真机实锤样例）
├── kernels/               # 内核资产清单（机读）+ 双重守卫/半精度样板
├── cli/                   # 设备卡生成器 + 探针 CLI（Phase 1 T1/T2 占位）
└── handbook/              # 失败案例与调优铁律（做引擎的人直接抄）
```

## 状态

- **定位 v0.3**：混合计算调度层（R 层）——决策卡+工具集升级完成（2026-08-29）：
  `pc_context/pc_queue/pc_event/pc_memory/pc_scheduler` 五对象草案入 API，
  architecture.md 第六章规格先行，实装按「痛点触发」推进（跨引擎资源冲突 / T3.2 回注）

- **T0 设备卡与内核资产** ✅（devices/ 双卡 + kernels/ 双样板 + MANIFEST + handbook 五铁律）
- **T1 公共 API 与 CLI** ✅（2026-08-29）：`include/pocketcl.h` v0.1 + `src/` 四实现
  （device 枚举分级 / program 双重守卫编译 / policy 策略引擎 / profiler CLPROF 聚合）+ `cli/device-card.js`（冒烟过）
  —— 编译验证待 NDK/CI 环境（本机无编译器）；真机链路（getprop 指纹注入）待真机窗口
- **T2 探针 CLI** ✅（2026-08-29）：`cli/probe-topn.js`——CLPROF logcat 解析 → 算子榜单
  （header/行格式与引擎打点实锤对齐，`adb logcat -d | node cli/probe-topn.js` 直通；
  文本/JSON 双输出，样例冒烟通过，71.1% 热点复现）
- **T3 编译器路线** ✅ T3.1 预研（2026-08-29）：`specs/compiler-roadmap.md`（路线三选：
  单算子 TVM 替换起步/MLC 远期/手动保底）+ `t3-hotspot-inventory.json`（71.1% 覆盖机读清单）
  + `t3-search-space.json`（3 维搜索空间 + 设备卡硬约束 + CLPROF 评估闭环）；
  T3.2 单算子试点待 GPU/编译环境
- **T4 引擎层补丁 patch 化** ✅（2026-08-29）：patches/ 五资产改动地图全部交付
  （clprof-probe / mali-half-prec / qcom-guard / f16-kqkqv / vae-tiled），正式 patch 待网络恢复 rebase

## 原则（锋利边界）

- **Upstream-First**：能合回上游的代码全部合回（ggml/sd.cpp/llama.rn），本仓只放「不属于任何上游」的增量；
- **零侵入三态接入**：环境变量开关 → 补丁集 → 深度接入，用户不动引擎也能受益；
- **真机唯一权威**：无真机实测数据的性能声明不发布（本仓铁律）。

## License

MIT（与上游 ggml/llama.cpp 同牌，合并零摩擦）