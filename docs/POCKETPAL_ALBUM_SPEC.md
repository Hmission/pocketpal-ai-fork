---
doc_id: POCKETPAL_ALBUM_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-18"
updated: "2026-08-18"
relates: [POCKETPAL_INNERLIFE_SPEC, POCKETPAL_PLAY_SPEC, POCKETPAL_PRODUCT_SPEC, POCKETPAL_STARMAP_DOMAINS]
---

<!-- D-FORMAT:v3 -->

# 记忆绘本 · 玩法 SPEC（ALBUM_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-18

> **定位**：把记忆从「数据库」升格为「成长相册」——周度故事（写作模型现编）+ DreamLite 封面插画，
> 记忆→创作闭环（迭代队列波次 3）。数字生命玩具的第三层：会回首往事。
> **配套**：素材源 = aiosMemory 记忆 + chick_diary 日记；封面引擎 = DreamLite（端侧唯一跑通模型）。

## 一、定位与边界

- **负责**：
  - **周度绘本**：手动触发「生成本周绘本」——聚合近 7 天记忆+日记 → 写作模型写周度故事 → 管家增强英文提示词 → DreamLite 出封面 → 落盘 `memories/album/YYYY-Www/`
  - **绘本浏览**：MemoryScreen 入口查看已生成绘本（故事文本 + 封面图）
- **不负责**（明确排除）：
  - 不做自动/定时生成（生图与聊天引擎互斥，自动触发会打断体验；手动=显式用户主权）
  - 不做多页绘本排版（单封面 + 单篇故事，锋利不臃肿；多页留待好用后再议）
  - 不接入第三方生图（DreamLite 单通道，与聊天闭环一致）
- **上下游**：读 aiosMemory（listMemories）/ rituals（listDiaries）→ 写 albumBook（生成）→ 消费 MemoryScreen 浏览

## 二、核心原则 / 公理

1. **手动触发**：绘本生成是重操作（写故事 + 出图，会挤占聊天引擎），只在 MemoryScreen 显式按钮触发——不自动、不打断。
2. **素材即真实**：故事素材只来自记忆库与日记——女妖回顾的是真实发生的事，不是编造。
3. **周文件即幂等**：`memories/album/YYYY-Www/` 已存在 → 跳过生成（返回已有），不覆盖不重复。
4. **无兜底无补丁**：素材不足（无记忆无日记）→ 显式返回提示；出图失败 → 返回错误文案（复用 imageGenStore.error）；任一环节失败不静默。
5. **引擎选择复用既有模式**：故事用 `modelStore.engine ?? promptWriter`（与记忆提取同款回退）；封面提示词用管家增强（writePrompt）；出图 DreamLite 固定 1024×1024·4 步。

## 三、架构概要

```
MemoryScreen「绘本」按钮（手动）
   → albumBook.createWeeklyAlbum()
   → ①素材：listMemories(近7天) + listDiaries(近7天)
   → ②故事：modelStore.engine ?? promptWriter —— 女妖口吻 200-400 字周度故事
   → ③封面提示词：promptWriter.writePrompt(story)（英文 SD 提示词）
   → ④出图：imageGenStore.generateDreamLiteEntry(1024, 1024, 4, sdPrompt)
   → ⑤落盘：memories/album/YYYY-Www/{story.md, cover.png}（RNFS.copyFile 共享存储）
        ↓
MemoryScreen「绘本」Modal：listAlbums() 周列表 → 展开（故事文本 + 封面 Image）
```

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | MemoryScreen 手动按钮（用户主动） |
| 输出 | 周度故事 + 封面图（memories/album/YYYY-Www/） |
| 持久状态 | `memories/album/YYYY-Www/story.md` + `cover.png`（共享存储，卸载不丢） |
| 事件 / 日志 | console.log 落盘路径；生成进度走 imageGenStore 既有状态机 |

## 五、契约

- **paths.ts**：`AIOS_ALBUM_DIR`（memories/album/）入 ensureAiosDirs。
- **albumBook.createWeeklyAlbum()**：返回 `{ok, album?, error?}`；本周已存在 → `{ok:false, error:'已存在'}`；素材空 → 显式错误；出图失败 → 复用 imageGenStore.error。
- **albumBook.listAlbums() / readAlbum(weekKey)**：周列表（新→旧）+ 读取 story.md 与 cover 路径（v1.1：readAlbum 独立导出，契约对齐）。
- **MemoryScreen**：Appbar 新增「绘本」action（book-open-variant）→ Modal：空态引导 + 生成按钮 / 周列表展开查看（故事文本 + 封面缩放预览）。

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | albumBook 用例全绿（素材聚合/故事生成/落盘/幂等/失败显式） |
| 真机验收 | 有记忆后点「生成本周绘本」→ 故事+封面落盘 → MemoryScreen 可浏览 → 重启后仍在 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| ALBUM-1 | 单封面单故事，无多页排版 | 好用后再议（锋利边界内） |
| ALBUM-2 | 出图耗时（DreamLite 加载+4 步） | 生成期间 Modal 显示进度（imageGenStore 状态机）；驻留引擎秒级复用 |

## 八、关联

- **同层子系统**：memory（aiosMemory 素材 + MemoryScreen 入口）、imageGen（DreamLite 封面）、workspace（chick_diary 素材）
- **相关 ADR**：无（玩法层）
- **操作手册 (SOP)**：UI_GATE_VERIFICATION_SOP（验证门禁沿用）

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-18 | 1.0 | 首发：周度绘本（故事+封面）+ MemoryScreen 浏览 |
| 2026-08-19 | 1.1 | 闭环收口：readAlbum(weekKey) 独立导出（契约对齐，listAlbums 内联拆分） |

## 关联文档

- [内心生活玩法](./POCKETPAL_INNERLIFE_SPEC.md)（spec，波次 2，日记素材源）
- [玩具工坊玩法](./POCKETPAL_PLAY_SPEC.md)（spec，波次 1）
- [产品路线图（P 系列）](./POCKETPAL_PRODUCT_SPEC.md)（positioning）
