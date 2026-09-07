---
doc_id: POCKETPAL_CHAIN_AUDIT_20260907_B
module: root
type: audit
status: active
version: '1.0'
created: '2026-09-07'
relates:
  [
    POCKETPAL_ICON_SPEC,
    POCKETPAL_DESIGN_SPEC,
    ONDEVICE_VIDEO_GEN_ANALYSIS,
    POCKETPAL_STARMAP_DOMAINS,
    POCKETPAL_CHAIN_AUDIT_20260907,
  ]
---

<!-- D-FORMAT:v3 -->

# 第二轮链路排查：图标上色语言断裂（大王已报障）+ P2 视频主线可行性收口

> 2026-09-07 · 大王令「图标统一处理 + 继续推 P2 + 6D/星图全量排查，出全面修复升级方案」
> 方法：`gate` → route 啄木鸟（`allow_execute` 后方动手）+ 两路只读专工（P2 链路面 / 图标一致性面）
> + 三项物性实测探针（svgr 真产物 / 全仓资产分级 / 调用点上色口径）。装机验证按大王令**集中后做**。

## 一、结论速览

1. **电话图标不镂空不是审美问题，是违规调用**：本仓 143 处图标上色走 `stroke=`（正确），11 处走 `fill=`（违规），其中 5 处把封闭轮廓填成实心块——大王报的顶栏电话钮、通话页挂断/麦克风/喇叭正在其中。
2. **它能长期存活，是因为两卷规范互相矛盾**：`ICON_SPEC §4` 说「颜色必须传 `stroke=`」（对），`DESIGN_SPEC §3` v3.4「传参红线」说「着色**只能**传 `fill`，传别的无效」（错）。上一窗（§157）据此还把现象误读成「视觉重量」，用「渲染尺寸 m(20)→s(16)」做了补丁并写进 `ICON_SPEC §4.1`。**规则层的补丁比代码层的补丁更坏**——它让下一个人照错口径写。
3. **P2 视频线今天卡的全是纯工程链，不卡引擎**：引擎侧 `generate_video` 已是 sd.cpp 公开 API（禁区零改动）；缺的是 JNI 视频桥、帧→容器封装、RN 视频任务形态、Wan 分发四件；而「断点续跑」按**片段粒度**做即可，不必进禁区——原方案（step 级 checkpoint）反而违反「不兜底不补丁」。

## 二、图标线：物性实测与三层根因

### 2.1 svgr 真产物（探针 `.tmp/probe_svgr_output_162.js`，配置逐字对齐 `react-native-svg-transformer@1.5.1` 默认值）

```jsx
// src/assets/icons/phone.svg 生成后
<Svg xmlns fill="none" viewBox="0 0 24 24" {...props}>
  <Path stroke={props.fill} strokeWidth={2} d="…" />   // 无 fill 声明
</Svg>
```

三条事实，全部实测得出（第一次探针因我误配 `convertColors` 得出「svgo 会吃掉 `fill="none"`」的**假结论，已作废**）：

- `replaceAttrValues` 生效：描边资产的颜色字面量被换成 `{props.fill}` → **上色入口名实错位**（传的是 fill，起作用的是 stroke）。
- `{...props}` 展在 root 且**覆盖资产自带的 `fill="none"`** → Path 无显式 fill 即继承 root 的 fill → **封闭轮廓被填实**。
- Path 显式写 `fill="none"` **能存活 svgo** → 资产侧自证语义可行。

### 2.2 三层根因

| 层 | 内容 | 处置 |
|---|---|---|
| L1 规则 | `DESIGN_SPEC §3` 传参红线 与 `ICON_SPEC §4` 互斥；`§4.1` 是把违规后果写成条款的补丁 | 两卷合一：描边型只准传 `stroke=`；作废 `§4.1` 的「降一档」口径，保留其中正确的「反白只适用实心底衬」 |
| L2 调用 | 11 处 `fill=`（5 处可见故障） | 改 `stroke=`；顶栏电话钮的 `s(16)` 尺寸补丁**本波不撤**（填实消除后重量需真机复量，两个变量同时改会互相遮蔽），仅就地标注为「待复量值」并挂 W7-V |
| L3 资产 | 67 个描边资产的可绘制元素无显式 fill，靠继承 | 纯描边资产补 `fill="none"`（归一化脚本一次性），**dual-use 资产除外**（`star.svg` 评分态靠 `fill` 做实心，不可动） |
| L4 闸 | `check_icons.py` 只校验资产几何，管不到上色口径 | 加双向校验：资产侧 stroke 型须自带 `fill="none"`；调用侧 stroke 型资产禁单独传 `fill`。并挂 `pre-commit` 第 7 闸 |

### 2.3 波及面实测（探针 `.tmp/probe_icons_162.js` → `.tmp/icon_probe_162.json`）

`svg_total=144 stroke=67 fill=76 mixed=0 unknown=1 exposedDefect=67`（67 个描边资产全部「传 fill 即被填实」）；调用侧 `stroke=` 143 处、`fill=` 11 处、`color=` 1 处。可见故障点：`ChatHeader:114`、`PhoneCallOverlay:505/511/552/575`；无可见故障但口径错：`EnhancedSearchBar:243`、`HeaderRight:184`、`PalHeaderRight:78`；**故意实心不得误伤**：`SquarePalCard:507`、`PalDetailSheet:257`（star，stroke+fill 同传）；`HeaderLeft:37` 是 fill 型资产（`arrow-left-md`），传 fill 正确。

### 2.4 附带发现：B10 图标尺寸裸数字未收干净

`theme.iconSize` 有 `xs14/s16/m20/l24/xl28`，但 `SettingsScreen:55`(18)、`ChatInput:830`(20)、`AudioWorkshopTab:724`(26)、`OnboardingBottomBar:50`(13)、`SquarePalCard:225`(10) 等仍在硬编码，且 18/26/13/10 无对应 token（离档值）。登记 W9，不混进图标上色这一波。

## 三、P2 视频主线：链路现状与真缺口

### 3.1 环节存在度（证据取自专工回报，已回读实物）

| 环节 | 状态 | 证据 |
|---|---|---|
| 引擎 `generate_video`（禁区，公开 API） | 已有 | `cpp/stable-diffusion.cpp/include/stable-diffusion.h:506` |
| 引擎视频能力探测 | 已有 | 同上 `:447` `sd_ctx_supports_video_generation` |
| 采样 checkpoint / resume | **完全无** | 头文件仅 `save_imatrix`（量化标定，非采样态）`:577` |
| JNI 视频导出桥 | **完全无** | `ImageGenJNI.cpp:546-643` 只有 `nativeTxt2img` |
| 帧→WebM 容器封装 | **完全无（未编进 APK）** | muxer 在 `examples/common/media_io.cpp`，而 `jni/CMakeLists.txt:29-31` `SD_BUILD_EXAMPLES OFF`、`SD_WEBM OFF` |
| RN 视频任务形态 | 完全无 | `imageGenQueueCore.ts:19-43` `GenParamsSnapshot` 无 frames/fps/output；src 内 `video_frames` 零命中 |
| Wan 模型分发条目 | 无 | manifest 未登记 DiT-Q4 / UMT5-Q3 / WanVAE |
| 保活前台服务 + WakeLock + 票据制 | 已有 | `VideoTaskService*`、`nightTaskRegistry.ts:21-36` |
| 心跳真中断 / 取消 | 已有（本链 W1 刚修） | `imageGenStore.ts:418-423`、`sd_cancel_generation` |

**文档需勘误两条**：① ONDEVICE_VIDEO §7.4「开 `SD_WEBM` 一行即可」不成立——还需链 libwebm 并把 muxer 纳入 app 编译面；② 星图 `imageGen` 域写「双 tab（生图/视频）」不实（实为生图 / 音频工坊，全仓无文生视频 tab）。

### 3.2 「video」一名三义，开工前必须收名

`VideoTaskService`（实为**夜间长任务保活服务**，与视频生成无关）/ `VideoPalScreen`+`hasVideoCapability`（**摄像头围观问答**）/ 未来真正的文生视频。若不先收名，新代码会接在歧义符号上，日志与指南针也会串台。→ 列 W8 前置。

### 3.3 内存可行性：`te=disk` 可能直接免掉「双 ctx 分段加载」专项

不分段峰值估 4–5GB（DiT Q4≈1.0 + UMT5 Q3≈3.06 + WanVAE≈0.7 + 解码缓冲），K90 PSS 安全预算 4GB、5.16GB MoE 已被 HyperOS 杀过（有血证）→ 高风险。但 JNI 已在用引擎原生 `params_backend="te=disk"`（`ImageGenJNI.cpp:483-485`，klein/z_image 线上生效）：若 UMT5 走此路成立，峰值可降到 `max(DiT+VAE)` ≈ 1.7GB，**DEV_BACKLOG 项 5（双 ctx 分段加载）就不必做**。这是典型的「先验证更干净的现成路径，再造新机制」。

### 3.4 断点续跑：片段粒度重跑，而不是 step 级 checkpoint

step 级 checkpoint 必须改引擎采样循环钩子（禁区，需专项批准），且会在引擎外养一份「半截 latent 文件」状态副本——**双份状态源**。改为**镜头/片段粒度**：每段一次 `generate_video`、段产物落盘、被杀只丢当前段，续跑语义直接复用队列既有的抽数累加/停止续跑状态机（`imageGenQueueCore.ts:240-264`）。零禁区改动，且更符合「单状态机链路」。原 DEV_BACKLOG 项 4 的 step 方案建议作废。

### 3.5 队列 / 保活 / 心跳复用面：三处零冲突，禁止新建第二套

视频与生图同为 sd.cpp ctx，天然该共 `engineMutex` 的 `image` 单槽（正是要的互斥）；`nightTaskRegistry` 票据制 owner `'video'` 已预留，直接复用；心跳 600s（CPU/OpenCL）覆盖 Wan 单步 2–4min。**唯一需真机取证**：`generate_video` 是否每步触发 `sd_progress_cb`——若整段无事件会被 W1 的心跳误判为 hang。

## 四、6D 归置

| 维 | 本轮发现 |
|---|---|
| **D1 链** | 图标：着色链从「调用点 props → svgr 映射 → root 覆盖 → path 继承」四跳，任一跳说错就实心；视频：出片链缺 4 环（JNI 桥 / 封装 / 任务形态 / 分发） |
| **D2 簇** | 两卷规范对同一事实（图标上色口径）给出互斥结论；`video` 一词跨三域复用 |
| **D3 面** | 144 资产二值（描边/面性）却只有一种上色入口；11 处违规口径是同一病灶的面 |
| **D4 锚** | 视频线的锚是「我的手机跑通了一条端侧视频」这一刻（跑分软件式玩法），不是可用创作工具——据此砍掉 step checkpoint 与双 ctx 两个工程量 |
| **D5 态** | 图标无状态（纯呈现）；视频任务态若另起 checkpoint 文件即成第二份状态源，坚决不接 |
| **D6 策** | 先收规则与名（W7/W8），再补纯工程链（W9-W11），真机可行性验证集中在装机窗 |

## 五、波次规划

| 波 | 目标 | 前置 | 验收 | 禁区 | 归属 |
|---|---|---|---|---|---|
| **W7** | 图标上色语言根治：两卷规范合一 + 11 处调用点改 `stroke=` + 67 资产自证语义 + `check_icons.py` 双向校验挂第 7 闸 | 无 | `check_icons.py` exit 0；探针 `exposedDefect=0`、`fill=` 站点仅剩 dual-use/fill 型；tsc/jest/prettier/eslint 全绿 | 否 | **本窗落码** |
| **W7-V** | 真机目视：顶栏电话钮与通话页四钮镂空且描边色随主题；**定尺寸档**（s(16) 是否该回 m(20) 靠像素复量定，不靠推算） | 装机 | 截图像素量得 phone 与同栏图标的墨迹宽度对比 + §登记 | 否 | 装机窗（并入 DEV_BACKLOG P1 项 31） |
| **W8** | 收名：`VideoTaskService` → 夜间长任务服务语义（保留兼容别名或一次性改调用点，探针定范围）；星图 `imageGen` 域「视频 tab」勘误；`video` 三义在 STARMAP 分域登记 | W7 | grep `video` 每处归属唯一域；星图与代码一致 | 否 | 下一窗 |
| **W9** | B10 图标尺寸裸数字收口：`18/26/13/10` 四值先裁定「补 token 还是归到邻档」，再统一 `theme.iconSize.*` | W7 | grep 零裸数字 + 真机不劣化 | 否 | 择期（可与 W7-V 并） |
| **W10** | `nativeGenVideo` JNI 桥：填 `sd_vid_gen_params_t`（frames/fps）+ 帧导出 + Kotlin 方法 + 取消/心跳接线 | W8 | 端侧出一段可播放帧序列（先不落容器）；真机取证 `sd_progress_cb` 心跳 | 否（纯调既有公开 API） | 主线，需真机 |
| **W11** | 帧→容器：裁定「编 `SD_WEBM`+libwebm+纳入 muxer」vs「RN 侧封装（MediaCodec/ImageWriter）」 | W10 | 输出一个可分享文件；编译面改动须可回退留痕 | **半触**（CMake 编译范围，非 sd.cpp 源码） | 主线 |
| **W12** | 视频任务形态入既有队列（`kind:'video'` + 片段粒度续跑）+ Wan 三文件 manifest 条目 + 分发 | W11 | 队列面板可见视频条目、进度/停止/续跑语义与生图一致；夜间一条 5s 480p 出片 | 否 | 主线终点 |
| **W13** | （条件触发）双 ctx 分段加载——仅当 `te=disk` 对 UMT5 无效才立项 | W10 实测 | 峰值 <4GB 实测 | 可能 | 观望，优先免做 |

## 六、明确不做

- 不做 step 级 checkpoint（引入引擎外状态副本，且违反禁区纪律）——**DEV_BACKLOG 项 4 建议作废改判**。
- 不做双 ctx 分段加载专项（先验 `te=disk`，能免则免）——项 5 同样降为条件触发。
- 不为图标新建组件体系、不引入 icon-font/第三方图标库、不加运行时"判断该传 fill 还是 stroke"的兜底。
- 不为视频新建第二套队列/保活/状态机（专工已判定三处可复用，零冲突）。
- LTX-Video 备选维持观望（P3 项 8），效果级不足以推翻 Wan 路线前不投入。
- 本轮不碰 `theme: any` 历史面债与 48 处空 catch 清零（§160.7 已裁）。

## 七、本轮新发现登记（续 CHAIN_AUDIT_20260907 的 N 序列）

| # | 发现 | 处置 |
|---|---|---|
| N14 | 两卷规范对图标上色口径**互斥**（`ICON_SPEC §4` vs `DESIGN_SPEC §3` 传参红线），后者含事实错误（把「传 `color=` 无效」错误推广为「只能传 `fill`」） | 当场修：规则合一，DESIGN_SPEC 红线改写 |
| N15 | `ICON_SPEC §4.1`「封闭轮廓降一档尺寸」是把填实误读为视觉重量的**补丁条款**，并据此留下 `ChatHeader` 的 s(16) | 当场作废该理论的普适性；尺寸值保留但改标「待复量」，由 W7-V 像素定档（不撤未验改动） |
| N16 | svgr 上色链的三重错位：值映射不分属性、root props 覆盖 `fill="none"`、svgo 行为未知 | 已实测三项物性并写入 SPEC（附探针脚本名，后续以测代猜） |
| N17 | `video` 一名三义（保活服务 / 摄像头围观 / 文生视频） | W8 收名 |
| N18 | 星图 `imageGen` 域「双 tab（生图/视频）」不实；ONDEVICE_VIDEO §7.4「开 SD_WEBM 一行即可」低估编译面 | 文档回写（W8 与本报告同步） |
| N19 | B10 图标尺寸裸数字仍有漏网，含 18/26/13/10 四个无 token 的离档值 | W9 登记，不混波 |
| N20 | **第二套上色机制**：`speaker`/`volume-off`/`volume-on`/`waves` 描边色写 `currentColor`，不吃 `.svgrrc` 映射且覆盖继承 → 调用侧传 `stroke=` 完全无效、描边恒黑（`SystemSettingsScreen:86` 正踩上，暗色模式不可见）；SPEC 旧条文「默认 #333333 **或** currentColor」正是允许这种双轨的口子 | 当场收：4 件归一为 `#333333`，SPEC §一第 4 条改为禁止 currentColor，并入 `check_icons.py` 校验 |
| N21 | `check_icons.py` 存在但**没挂任何 npm 脚本与 pre-commit 闸**（所以上色这一类从来没人拦）；且它的「双描边」正则只匹 `#hex`，挡不住四件资产的可见 `fill="white"` 遮罩层（写死白色，暗色模式会露白块） | 闸已挂（`yarn lint:icons` + pre-commit 第 7 闸，已做两次负向测试确认可红）；白底遮罩层四件**不当波顺手改**（会改变观感），登记 DEV_BACKLOG 项 34 |
| N22 | 既有单测**把违规当规格钉住**：`ChatHeader.test.tsx` 断言「电话钮着色走 fill」并引用 DESIGN_SPEC 错误红线 | 当场改正断言（stroke 为正 + 反向钉 `fill` 必为 undefined），并记原因于注释 |

## 八、W7 执行回执（本窗已落码）

- **规则层**：ICON_SPEC v1.1（§一新增第 5 条、§一第 4 条禁 currentColor、§四上色口径硬规、
  §4.1 作废降档理论、新增 §4.2 机制实测 / §4.3 dual-use 登记 / §4.4 收口清单）；
  DESIGN_SPEC v3.27（§3 传参红线改写并指回单一事实源）。
- **资产层**：`normalize_icons.py` 新增两条规则（描边元素自证 `fill="none"` + currentColor 归一），
  实跑改 67 件（star 按 dual-use 豁免）；验收探针 `EXPOSED_COUNT` 67→1（只剩已登记的 star），
  currentColor 残留 0。
- **调用层**：8 处 `fill=`→`stroke=`（`ChatHeader` 电话钮；`PhoneCallOverlay` 挂断/按住说话/喇叭开/喇叭关；
  `EnhancedSearchBar` 清除钮；`HeaderRight`/`PalHeaderRight` 菜单钮）；star 两处补 dual-use 语义注释；
  `HeaderLeft`（`arrow-left-md` 面性资产）不动。
- **闸**：`check_icons.py` 双向校验（资产侧自证 fill / 禁 currentColor；调用侧描边型禁只传 fill）
  + `yarn lint:icons` + pre-commit 第 7 闸。**负向测试两次均 exit 1**（临时探针资产 + 临时回改调用点），
  证明不是永真闸；两次负向样本已清除。
- **测试**：`ChatHeader.test.tsx` 一条断言改正（它原本把违规当规格）。
- **门禁**：tsc 0 错；eslint 0 error（30 既有 warning）；prettier 绿；**jest 350 套 / 4854 passed + 2 skipped / 318 快照全绿**；`check_icons` exit 0。
- **未验（诚实挂账）**：镂空观感、描边色随主题（尤其暗色模式 volume 系）、s(16) 定档——均需真机，
  已入 DEV_BACKLOG P1 项 31；本窗设备不在线，未假装看过。

## 九、待大王裁定

1. **顶栏电话入口的容器语言**：它是透明裸触区，通话页控制钮是「域彩 12% 淡底 + 1px 描边」，输入栏发送钮是「实心域彩圆 + 反白图标」。三套各有场景，但**淡底 vs 实心+反白**必须全局二选一，否则漂移会继续长。请定一个。
2. **DEV_BACKLOG 项 4（step checkpoint）作废、项 5（双 ctx）降为条件触发**，P2 改按本报告 W8→W12 排序——确认即更新台账。
3. W11 的容器封装路线（CMake 开 `SD_WEBM`+libwebm vs RN 侧 MediaCodec 封装）需真机与构建环境验证，**授权我下窗开跑**还是先补一份纯静态推演？
4. 39 笔未 push（大版本封版前纪律），是否安排一次补推。
