# PocketCL patches/ — 引擎层补丁集（回馈主航道备料）

> 定位：A 类 `upstream-first` 资产的**净改动整理**，为 llama.cpp/ggml/sd.cpp 上游 PR 备料。
> 基准：PocketCL v0.1 · 2026-08-29。对应方案文档 §13.1 A 类五资产。

## 1. 背景：为什么是"改动地图"而不是正式 patch

- 引擎副本 `android/app/src/main/cpp/stable-diffusion.cpp/` 的嵌套仓库历史**已丢失**
  （`.git` 在复制入库时剥离，`ggml/.git` 是残留 gitdir 指针 `../.git/modules/ggml`，目标不存在）；
- 因此无法从本地 git 产出基于上游基线的标准 diff；
- **做法**：每项 A 类资产整理 `map.md`（改动点精确行段 + 代码摘录 + 意图 + 回归要点）+ `metadata.json`（机读）；
  网络恢复后 `git fetch` 上游 sd.cpp/ggml → rebase 到上游基线 → 生成正式 patch → PR。
- 回归铁律：所有探针/开关**编译期常驻 + 运行期 env 门控（零开销）**，随包需声明。

## 2. 资产清单（对应 kernels/MANIFEST.json ownership=upstream-first）

| 目录 | 资产 | 载体文件 | 状态 |
|---|---|---|---|
| clprof-operator-probe/ | 算子级探针（CLPROF） | ggml/src/ggml-opencl.cpp | ✅ 已整理（2026-08-29） |
| mali-half-prec-tiled-gemm/ | Mali 半精度 tiled GEMM（5 hunks x4 内核） | ggml/src/ggml-opencl + 4 内核 .cl | ✅ 已整理（2026-08-29） |
| qcom-double-guard/ | qcom 扩展双重守卫（编译期宏+运行时过滤） | ggml-opencl.cpp + 9 内核 .cl | ✅ 已整理（2026-08-29） |
| f16-kqkqv-adreno-guard/ | F16 KQ/KQV 守卫（三重复合，107ae9c 快照） | ggml-opencl.cpp + kq_kqv.cl | ✅ 已整理（2026-08-29） |
| vae-tiled-512px/ | VAE tiled 512px（默认参数修复 + Z-Image 强制） | src/core/backend_fit.cpp + stable-diffusion.cpp | ✅ 已整理（2026-08-29） |

## 3. 生成正式 patch 的 SOP（**2026-09-02 已锚定基线 V0**）

**基线 V0（2026-09-02 实锤）**：vendored ggml = **v0.15.3**（CMakeLists GGML_VERSION 0.15.3），上游 `ggml-org/ggml` 同名 tag 存在（object 9ec395b0fc），codeload 下载通道可达。回馈目标勘正：A 类 OpenCL 相关 4 项 → `ggml-org/ggml`；vae-tiled-512px → `leejet/stable-diffusion.cpp`（§12.8 旧写「llama.rn」已勘正，见 OPEN_KERNEL_PLAN §14.2）。

1. codeload 下载 ggml v0.15.3 基线 tarball → `.tmp/ggml-upstream` 解压为干净工作树（无需 clone、不碰本仓引擎副本）；
2. 按 `map.md` 的行段在工作副本上对照确认改动范围（与 vendored 版本 diff 交叉核对）；
3. `git diff <上游基线> -- <carrierFile>` 提取 → 按资产切分 hunk；
4. 每条 PR 独立 commit：asset 一粒，message 带基准版本号 + 回归证据（nan=0/加速倍数）；
5. `metadata.json` 的 `prUrl` 字段回填收尾。
6. 首波执行中（2026-09-02）：mali-half-prec + qcom-double-guard 两枚（状态见 OPEN_KERNEL_PLAN §14.4）。

## 4. 锋利边界（提交前自查）

- 只带 A 类资产，B 类自研增量（xmem GEMM 等）不进上游 PR；
- 探针类改动必须有 env 门控（零开销回归），不得默认开启改变行为；
- 双守卫（铁律 2）：vendor 扩展内核必须编译期宏 + 运行时过滤双保护，否则不进 PR。