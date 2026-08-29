# PocketCL

**Android 端侧异构性能调校层（tuning layer）——把手机 SoC 的纸面算力变成实际吞吐。**

上游引擎（ggml / llama.cpp / sd.cpp）解决「跨平台能跑」，PocketCL 解决「在 Adreno / Mali 上榨干」：设备指纹 DB → 内核选择 → 跑分回注 的闭环工具集。

> 状态：**Phase 1 T0 实体化（2026-08-29，本地开发中）**——骨架与第一份资产，尚未发布。
> 定位与战略基准见小黄鸡仓 `docs/POCKETPAL_OPEN_KERNEL_PLAN.md`（内部文档）。

## 目录

```
pocketcl/
├── specs/architecture.md   # 三层架构落地（L1 设备DB / L2 内核集合 / L3 tuning）
├── devices/                # 设备指纹卡（JSON schema + 真机实锤样例）
├── kernels/                # 内核资产清单（机读）+ 双重守卫/半精度样板
└── handbook/               # 失败案例与调优铁律（做引擎的人直接抄）
```

## 原则（锋利边界）

- **Upstream-First**：能合回上游的代码全部合回（ggml/sd.cpp/llama.rn），本仓只放「不属于任何上游」的增量；
- **零侵入三态接入**：环境变量开关 → 补丁集 → 深度接入，用户不动引擎也能受益；
- **真机唯一权威**：无真机实测数据的性能声明不发布（本仓铁律）。

## License

MIT（与上游 ggml/llama.cpp 同牌，合并零摩擦）