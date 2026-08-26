---
doc_id: DEVICE_SCREENCAST_SOP
module: sop
type: sop
status: active
version: "1.0"
created: "2026-08-24"
updated: "2026-08-24"
relates: [DEVICE_DEPLOYMENT_SOP, DOC_MANAGEMENT]
---

<!-- D-FORMAT:v3 -->

<!-- 文档管理：机制见 docs/DOC_MANAGEMENT.md；AI 用法见 docs/CURSOR_DOC_USAGE.md。
更新时：1) 更新 frontmatter 的 updated/version；2) 同步 type/status/relates 与文末「关联文档」；
3) 在 docs/INDEX.md 中登记。-->

# 多设备投屏 · SOP（Device Screencast Operations）

**状态**：active | **版本**：1.0 | **更新**：2026-08-24

> **定位**：通过 ADB + scrcpy 对多台已连接真机拉起投屏的操作手册。
> **铁律（2026-08-24 事故定规）**：**设备身份必须以 `adb shell getprop` 查询 + 屏幕分辨率判定为准，禁止按 USB 连接顺序 / 出现先后臆断序列号归属**。窗口标题标错即等于操作对象搞错，后续任何点击/截图/装机都会落到错误设备上。

---

## 一、设备身份黄金标准（唯一可信来源）

> 下表是**当前在档设备的权威身份映射**。新增/换机后必须先按 §2.1 重新实测，再更新本表并走 §五验收。
> **禁止**仅凭 `adb devices` 的列表顺序、transport_id、或「第几个连上」来推断设备名。

| 设备名 | 序列号（serial） | 机型代号 | 分辨率 | 屏幕比例 | 判定特征 |
| --- | --- | --- | --- | --- | --- |
| **小米13** | `66b1777f` | ishtar（2304FPN6DC） | 1080×2400 | 0.45（≈21:9 手机） | 旗舰直屏手机 |
| **红米K90** | `aab688d9` | myron（25102RKBEC） | 1200×2608 | 0.46（≈20:9 手机） | 手机，窄长 |
| **红米平板** | `P7AAJZS8Q4C6BAUC` | turner（25079RPDCC） | 1880×3008 | 0.625（≈16:10 平板） | 平板，宽屏 |

**判定口诀**：
- **宽屏比（宽/高 ≥ 0.6）→ 平板；窄长比（宽/高 ≤ 0.5）→ 手机**。
- 手机之间再用 `getprop ro.product.model` 的机型代号区分（ishtar=小米13、myron=K90）。
- 平板与手机只要分辨率比例对得上，**即使型号名相同（都叫 Redmi）也不会混淆**。

---

## 二、日常操作

### 2.1 投屏前：实测并锁定设备身份（必做，不可跳过）

```bash
# 1) 列出所有已连接设备及机型代号
adb devices -l

# 2) 逐台查询真实型号（身份判定的唯一依据）
for s in <serial1> <serial2> <serial3>; do
  echo "=== $s ==="
  adb -s $s shell getprop ro.product.model
  adb -s $s shell getprop ro.product.brand
done

# 3) 查询分辨率（手机/平板判定的唯一依据）
for s in <serial1> <serial2> <serial3>; do
  echo -n "$s: "; adb -s $s shell wm size
done
```

**期望结果**：每台设备返回型号 + 分辨率，与 §一 黄金标准表逐一对得上。若新设备不在表内 → 先补测、更新 §一 表，再投屏。

### 2.2 拉起投屏（按身份，非按顺序）

> scrcpy 路径（WinGet 安装，v4.1）：
> `C:\Users\90897\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe`
> 已加入 PATH 时可直接 `scrcpy`。

**命令模板**（`--serial` 锁定设备，`--window-title` 用 §一 表中的权威设备名）：

```bash
# 小米13
scrcpy --serial 66b1777f        --window-title "小米13"
# 红米K90
scrcpy --serial aab688d9        --window-title "红米K90"
# 红米平板
scrcpy --serial P7AAJZS8Q4C6BAUC --window-title "红米平板"
```

- 每台一条后台任务，`--window-title` **必须与 §一 表一致**，禁止凭手感填。
- 窗口内鼠标点击 / 拖拽 / 滚轮直接映射到对应设备；关闭窗口即断开该路投屏。

### 2.3 校验投屏对象正确（拉起后必做）

1. 观察每个窗口标题是否与 §一 表一致。
2. 用窗口画面内容反查：平板应显示平板桌面（宽屏）、手机应显示手机桌面（窄长）。
3. 若发现标题与画面不符 → 立即 `taskkill /IM scrcpy.exe /F` 全杀，回到 §2.1 重新锁定身份再拉起。

---

## 三、故障排查

### 3.1 已知问题与解法

| 症状 | 根因 | 解法 |
| --- | --- | --- |
| **窗口标题与设备不符（本次事故）** | 按 USB 连接顺序臆断序列号归属，未实测型号/分辨率 | 回到 §2.1 用 `getprop` + `wm size` 实测；更新 §一 黄金标准表；全杀重拉 |
| 某台设备投屏黑屏 / 无信号 | 设备息屏或 ADB 授权失效 | 点亮设备屏幕；`adb -s <serial> devices` 确认状态为 `device`；必要时重新授权 |
| `adb devices` 只看到部分设备 | USB 线只支持数据未插紧 / 驱动未装 | 换线重插；确认数据线（非仅充电线）；检查设备管理器驱动 |
| 分辨率判定冲突（两台比例接近） | 单靠比例不足以区分 | 叠加 `getprop ro.product.model` 机型代号 + 设备实际画面内容双重确认 |
| scrcpy 报 `no device found` | serial 写错或设备已断开 | 回 `adb devices -l` 核对当前真实 serial |

### 3.2 诊断路径（按优先级）

1. **先锁身份**：`adb devices -l` + 逐台 `getprop` + `wm size`，确认每台设备真实身份。
2. **再对黄金标准**：与 §一 表逐条比对，找出「声称身份 ≠ 实测身份」的设备。
3. **再验画面**：投屏窗口标题 vs 实际画面内容（宽屏=平板，窄长=手机）。
4. **最后定位根因**：是身份标错（回 §2.1）、设备断开（回 adb 状态）、还是驱动/授权问题。

---

## 四、变更操作

### 4.1 新增 / 换机后更新黄金标准

1. 按 §2.1 实测新设备的 `model` + `brand` + `wm size`。
2. 更新 §一 黄金标准表（新增一行 / 修改变更行的序列号与特征）。
3. 更新 frontmatter 的 `updated`、`version`。
4. 走 §五 验收。

### 4.2 回滚方案

- 投屏窗口标错：`taskkill /IM scrcpy.exe /F` 全部终止，回到 §2.1 重测重拉，无副作用。
- 黄金标准表更新错误：以最近一次实测 `getprop`/`wm size` 输出为准回改。

---

## 五、验收标准

一次「多设备投屏」任务完成的验收：

| # | 检查项 | 通过标准 |
| --- | --- | --- |
| 1 | 身份实测 | 每台设备 `getprop` + `wm size` 输出与 §一 表一致 |
| 2 | 窗口标题 | 每个 scrcpy 窗口标题 == §一 表中的权威设备名 |
| 3 | 画面反查 | 宽屏画面落在平板名下、窄长画面落在手机名下 |
| 4 | 无串扰 | 各窗口操作只影响对应设备，无交叉 |

---

## 变更日志

| 日期 | 版本 | 变更 |
| --- | --- | --- |
| 2026-08-24 | 1.0 | 首发。固化三设备身份黄金标准；定「身份实测优先、禁止按连接顺序臆断」铁律（2026-08-24 平板/K90 标反事故）。 |

## 关联文档

- [真机部署 SOP](./DEVICE_DEPLOYMENT_SOP.md)（sop，装机/换机清单）
- [文档管理机制](../DOC_MANAGEMENT.md)（root）
