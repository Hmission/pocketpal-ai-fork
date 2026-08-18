---
doc_id: ADR-0007
module: adr
type: adr
status: accepted
version: "1.0"
created: "2026-08-18"
updated: "2026-08-18"
relates:
  - docs/imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md
  - docs/adr/ADR-0006-sd3-2b-engine-compat-route.md
  - docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md
---
<!-- D-FORMAT:v3 -->

# ADR-0007 运行时 LoRA 挂载开关（路线 B）：base 模型 + 独立 LoRA 文件 + 生图页秒级切换

**状态**：accepted | **版本**：1.0 | **更新**：2026-08-18
**决策人**：啄木鸟 + 大王 | **相关**：[训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md) · [ADR-0006](./ADR-0006-sd3-2b-engine-compat-route.md)

## 背景

ADR-0006 烘焙路线（LoRA 合并进 GGUF）已闭环，但**烘焙后无法运行时开关对比**微调效果。SSOT GAP-001 预留的路线 B（运行时挂载）条件已成熟——经代码审计，**整条链路已完成度极高**：

- `imageGenStore.generate` 已有 `loraPath/loraMultiplier` 参数并透传 `txt2img`
- manifest 类型已声明 `lora/loraMultiplier` 字段
- `ImageGenScreen` 已从 manifest 取值透传（`m?.lora ? ${AIOS_MODELS_DIR}/${m.lora}`）
- **JNI 已实现运行时挂载**（`ImageGenJNI.cpp` L403-412）：`loraPath` 非空 → `sd_lora_t` 挂载 → 每次出图生效（`generate_image(gen.loras)`）
- 引擎原生支持：sd.cpp `set_loras` / `apply_loras_at_runtime` + `ggml_ext_merge_lora`

**真实差距仅三项**：① LoRA 文件格式转换（peft 训练产物 → sd.cpp 可加载命名）；② 真机 base 模型回退（当前为烘焙版，不可再外挂）；③ 生图页 LoRA 开关 UI（当前 manifest 声明 lora 则恒开，无开关）。

## 决策

**落地路线 B：base 模型（未合并 GGUF）+ 独立 LoRA 文件 + 生图页「LoRA」开关**：

1. **格式转换**：训练产物（peft `base_model.model.blocks.N.x_block.attn.qkv.lora_A.default.weight`）→ sd.cpp 可加载格式（`lora.joint_blocks.N.x_block.attn.qkv.lora_down/up.weight`，kohya 风格命名，加载时引擎自动加 `lora.` 前缀按主模型 tensor 名匹配）。
2. **本机预验证**：sd-cli `-l <lora>` 直接验证 base + LoRA 出图（零真机风险），通过后再部署。
3. **真机部署**：模型回退 base 版（`.bak` 还原 1.79GB）+ 推送 lora 文件（~83MB）；manifest 的 SD 3.5 Medium 条目声明 `lora` 文件名（供开关取值），**开关默认关**（传空串 = 纯 base）。
4. **UI 开关**：生图页高级参数区加「LoRA」toggle（开 → 传 loraPath / 关 → 空串）+ multiplier 滑条（强度梯度 0-2 可调）。
5. **三态对比**：base 纯出图 / base+LoRA / 烘焙版（保留 `.bak` 备份可随时换回），同一 prompt 人工对比。

## 理由与权衡

- **链路就绪度高**：JNI 挂载与引擎通道已存在，投入集中在格式转换 + UI，成本远低于 08-17 评估时的"需 JNI 透传 + UI 开关 + GGUF 化 LoRA 工具链"全量投入。
- **对比体验最佳**：秒级切换（无需重加载模型）、multiplier 可调看强度梯度——烘焙版做不到。
- **零风险验证路径**：sd-cli 本机验证格式兼容（SD3 2B joint_blocks 的 lora 命名映射是唯一技术不确定点），通过后才动真机。
- **存储可接受**：base 1.79GB + lora 83MB ≈ 烘焙版 2.24GB。

## 被否决的替代方案

| 方案 | 否决原因 |
|------|----------|
| **方案 A：manifest 双条目下拉切换**（base 条目 + 烘焙条目） | 零代码可先上，但切换需重加载模型（30-60s）、占双倍存储（~4GB）；作为 B 未就绪时的兜底，不替代 B |
| **烘焙版 + 外挂 lora** | lora 已合并进权重，再外挂双重叠加 → 出图畸变，不可行 |
| **GGUF 化 LoRA** | sd.cpp 的 lora 加载支持 safetensors（kohya/diffusers 命名），无需 GGUF 化；多一层转换徒增风险 |

## 影响

- **产物**：`lora_humanpose.safetensors`（~83MB，转换后）+ base 模型（真机 `.bak` 还原）。
- **UI**：生图页高级参数区新增「LoRA」开关 + multiplier 滑条；manifest 声明 `lora` 字段但由开关决定传值。
- **验证**：本机 sd-cli 出图 → 真机三态出图对比（base / base+LoRA / 烘焙版）。
- **后续演进**：开关机制成为多 LoRA 风格插件生态的入口（多个 lora 文件 + 选择器）。

## 验证

1. 转换后 lora 文件 key 命名与引擎 `lora.<tensor>.<lora_down/up>.weight` 匹配。
2. 本机 sd-cli：`sd-cli -m base -l lora.safetensors -p "..."` 出图成功（对比 base 纯出图有差异）。
3. 真机：SD 3.5 Medium 条目加载 base 模型，LoRA 开关开 → 出图带微调效果；关 → 纯 base 效果。
4. 三态（base / base+LoRA / 烘焙版）同一 prompt 对比记录。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-18 | 1.0 | 首发：路线 B 落地决策（GAP-001 补齐） |

## 关联文档

- [训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md)（imagegen，GAP-001 状态更新）
- [ADR-0006](./ADR-0006-sd3-2b-engine-compat-route.md)（adr，烘焙路线）
- [生图升级历史规划](../POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md)（superseded）
