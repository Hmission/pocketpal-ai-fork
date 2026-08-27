---
doc_id: POCKETPAL_OFFLINE_LICENSE_DESIGN
module: root
type: design
status: active
version: '1.0'
created: '2026-08-27'
updated: '2026-08-27'
relates: [POCKETPAL_MASTER_LOG, POCKETPAL_PRODUCT_SPEC]
---

<!-- D-FORMAT:v3 -->

# 离线激活码授权设计(Offline License Activation)

> 状态：方案定稿，待实现（R1/R2/R3 迭代，见 §114/MASTER_LOG）
> 定性：卖工具软件授权，非生成式 AI 服务——只提供 App 本体、不提供模型、不提供算力、无账号体系

## 一、产品定性

- 激活码 = 软件 license（授权），按月购买（激活起算 30 天）
- 无服务器、纯本地鉴权；模型由用户自行安装，版权与内容责任在用户侧
- 合规红线：不提供模型、不做规避监管设计、推广话术与渠道合规（详见 §114.1）

## 二、链路全景

```
[大王侧 · 发卡工具(Ed25519 私钥)]          [用户侧 · App(内置公钥)]
  输入:设备ID + 30天                          安装 → 首启 → LicenseGate
  输出:激活码(签名)                               │     (启动唯一决策点)
      ▲                                           ▼
      │ 用户把设备ID发给大王               ┌─ 无激活 → ActivationScreen
      │(微信/闲鱼,产品既定)               │   展示设备ID → 复制发给大王
      │                                   │   输入激活码 → activate()
      └──────────── 大王回激活码 ─────────┤     ├─ 验签失败 → 提示无效
                                          │     ├─ 设备不匹配 → 提示非本机码
                                          │     └─ 成功 → ACTIVE(30天起算)
                                          ├─ ACTIVE → 主界面(正常使用)
                                          │   每次启动:防回拨 + 剩余天数
                                          │   剩余≤3天 → 到期提醒
                                          └─ EXPIRED → LockedScreen(续费指引)
```

## 三、单状态机（全 App 唯一授权状态）

```
UNACTIVATED ──activate(验签✓ + 设备ID匹配✓)──▶ ACTIVE
ACTIVE      ──30天耗尽/检测到回拨──────────▶ EXPIRED
EXPIRED     ──输入新码(验签✓ + 设备匹配✓)──▶ ACTIVE
任何非法路径(篡改状态/回拨时间) ──────────────▶ EXPIRED(锁死)
```

- 仅 2 命令：`activate` / `check`；仅 3 条合法转移
- 无第四种状态、无宽限期兜底、无容错分支；JS 层零散落判断，一切经 LicenseGate

## 四、组件划分（三件套，无第四件）

| 组件 | 位置 | 职责（仅此，不多做） |
|---|---|---|
| **LicenseModule** | native(JNI/C++)，复用 `hardware_info.cpp` 编译链 | ①`getDeviceId()` ②`activate(code)` ③`getStatus()`——验签、防回拨、状态持久化全在 native，JS 摸不到 |
| **LicenseGate + 双屏** | JS 层，共 3 个文件 | 启动唯一决策点 + ActivationScreen + LockedScreen |
| **发卡工具** | 大王电脑(Python) | `keygen`(生成密钥对)/`issue`(签发码)/`ledger`(本地账本) |

- 不建服务、不建账号、不碰现有 Stripe（Pals 在线支付与离线授权是两条平行链路，互不干扰也互不补救）

## 五、激活码格式与密码学

```
激活码 = "PC1." + Base32(payload) + "." + Base32(Ed25519签名)
payload = { device_id: 设备指纹, days: 30, issued_at, nonce }
```

- 私钥只存在于大王的发卡工具；App 只内置公钥 → 码不可伪造
- 设备ID 焊死在 payload → 码转卖无效（他人设备指纹不匹配）
- **minSdk 24 关键决策**：系统自带 Ed25519 需 API 28+，验签下沉 C++（monocypher，单文件零依赖），已复用现有 JNI 链，不新增 gradle 依赖

## 六、防回拨（native 内闭环）

```
持久化(双写:文件 + SharedPreferences,互相校验,不一致即锁):
  max_wall_time      ← 每次启动 max(历史, 当前墙钟)
  激活锚点            ← { wall_anchor, elapsed_anchor } 激活时记录
运行时判定:
  wall_now < max_wall_time            → 回拨 → EXPIRED
  elapsed_now - elapsed_anchor > 30天 → 到期 → EXPIRED
  (elapsedRealtime 不受改系统时间影响,重启后由 max_wall_time 跨重启兜底)
```

## 七、防破解：只做两层

| 层 | 手段 | 理由 |
|---|---|---|
| 1 | 验签 + 状态机 + 防回拨全部在 C++ | 单点下沉，JS/Kotlin 层无可 patch 的判断逻辑 |
| 2 | 签名自校验（native 读证书指纹，不符即退） | 防重打包，成本极低、收益高 |

明确不做（避免臃肿）：反调试全家桶、bundle 加密、虚拟机检测、多套冗余校验——每加一层，链路就多一个补丁式分叉。
**边界声明**：纯离线天花板 = 提高破解成本，而非绝对防破解。接受它。

## 八、6D 排查结论

| 维度 | 结论 | 判定 |
|---|---|---|
| D1 合规 | 工具授权非服务；不提供模型；激活码=软件授权；App 内不做规避监管设计 | ✅ 基线成立 |
| D2 密码学 | Ed25519 私钥不出大王电脑；公钥内置无害；码绑设备不可转卖；防回拨双通道 | ✅ 方案闭合 |
| D3 体验 | 全链路 3 屏：激活屏(设备ID大字+一键复制) → 主界面 → 锁定屏；到期前 3 天轻提醒 | ✅ 干净 |
| D4 工程 | 单状态机 + 单 gate + 单 native 模块(3 方法)；复用现有 package 注册与 JNI 链；无兜底分支 | ✅ 锋利 |
| D5 逆向 | 两层防御聚焦最高性价比；接受离线天花板 | ⚠️ 已声明边界 |
| D6 生命周期 | 发卡账本(设备ID/签发日/状态)；换机=新码(明规则)；升级不清状态；卸载重装=同设备同码可复用 | ✅ 规则明确 |

## 九、迭代路线（端到端优先）

- **R1 最小闭环**：发卡工具 + native activate/验签 + 激活页 + 锁定页 → 一码走通全链路
- **R2 时间纵深**：防回拨 + 到期提醒 + 状态双写校验
- **R3 加固收口**：签名自校验 + 体验打磨

## 十、设计原则

这条链路只有 3 个组件、1 个状态机、2 个命令、3 个屏幕。没有兜底、没有补丁、没有"以防万一"的隐藏分支——每一个元素都有且仅有一个存在理由。