# -*- coding: utf-8 -*-
"""
04_deploy.sh — 真机部署：推送微调后的 SD3.5 GGUF + 校验 + 对比验证

前提：
- 训练机产物: sd35_medium_humanpose_q4_k_m.gguf（03 脚本输出）
- 真机已连接 adb（USB 调试），App 已安装
- 严格遵循真机验证规范：覆盖安装（adb install -r）不用卸载；操作走屏幕模拟

流程：
1. adb 确认设备在线
2. push 微调 GGUF 到 /sdcard/Documents/AIOS/models/
   （保留原 sd35_medium_q4_k_m.gguf 备份为 .bak，可随时回滚）
3. 验证文件就位（ls -l + 大小对比）
4. 覆盖安装 App（如涉及引擎变更）→ 冷启动
5. 提示人工对比：原版 vs 微调版（同一 prompt / seed 出图对比）

用法（在 Windows 开发机，adb 可用）:
  bash 04_deploy.sh E:\\sd35_lora\\release\\sd35_medium_humanpose_q4_k_m.gguf
"""
set -e

GGUF_IN="$1"
if [ -z "$GGUF_IN" ]; then
  echo "用法: bash 04_deploy.sh <微调GGUF绝对路径>"
  exit 1
fi
if [ ! -f "$GGUF_IN" ]; then
  echo "[FAIL] 文件不存在: $GGUF_IN"
  exit 1
fi

REMOTE_DIR="/sdcard/Documents/AIOS/models"
REMOTE_NEW="sd35_medium_humanpose_q4_k_m.gguf"
REMOTE_BAK="sd35_medium_q4_k_m.gguf.bak"

echo "== 1/5 设备检查 =="
adb devices | grep -w "device" || { echo "[FAIL] 无在线设备"; exit 1; }

echo "== 2/5 备份原模型 =="
adb shell "ls $REMOTE_DIR/sd35_medium_q4_k_m.gguf" >/dev/null 2>&1 && {
  adb shell "cp $REMOTE_DIR/sd35_medium_q4_k_m.gguf $REMOTE_DIR/$REMOTE_BAK"
  echo "  已备份 -> $REMOTE_BAK"
}

echo "== 3/5 推送微调模型 =="
adb push "$GGUF_IN" "$REMOTE_DIR/$REMOTE_NEW"
adb shell "ls -l $REMOTE_DIR/$REMOTE_NEW"

echo "== 4/5 文件完整性 =="
LOCAL_SIZE=$(stat -c %s "$GGUF_IN" 2>/dev/null || stat -f %z "$GGUF_IN")
REMOTE_SIZE=$(adb shell "stat -c %s $REMOTE_DIR/$REMOTE_NEW" | tr -d '\r')
echo "  本地 $LOCAL_SIZE / 远端 $REMOTE_SIZE"
[ "$LOCAL_SIZE" = "$REMOTE_SIZE" ] && echo "  [OK] 大小一致" || { echo "  [WARN] 大小不一致，请重推"; exit 1; }

echo "== 5/5 覆盖安装 + 冷启动 =="
# APK 路径（如有新构建）可加参数传入；无则跳过安装
if [ -n "$2" ] && [ -f "$2" ]; then
  adb install -r "$2"
  echo "  已覆盖安装: $2"
fi
adb shell am force-stop com.pocketpalai
adb shell monkey -p com.pocketpalai -c android.intent.category.LAUNCHER 1

echo ""
echo "[DONE] 部署完成。"
echo "下一步（人工对比验证）:"
echo "  1. 启动投屏（scrcpy），打开 App 生图页"
echo "  2. 检查模型下拉：应出现 SD3.5 人体姿态版（或替换版同名）"
echo "  3. 同一 prompt 分别用原版(.bak 可临时改回)与微调版出图，对比人体姿态表现"
