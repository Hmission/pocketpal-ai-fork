# AIOS PocketPal 编译→安装→验证一键脚本
# 用法: .\scripts\aios\build-install-verify.ps1 [-SkipBuild] [-SkipInstall] [-VerifyOnly]
# 依赖: F:\pp 短路径编译链 + ADB + 真机已连接

param(
  [switch]$SkipBuild,
  [switch]$SkipInstall,
  [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"
$adb = "C:\Users\90897\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$pkg = "com.pocketpalai"
$apk = "F:\pp\android\app\build\outputs\apk\prod\debug\app-prod-debug.apk"

function Step($msg) { Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }

# Step 1: TypeScript 类型检查
if (!$VerifyOnly) {
  Step "TypeScript 类型检查"
  Push-Location "F:\pp"
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { Write-Host "TSC FAILED" -ForegroundColor Red; exit 1 }
  Pop-Location
}

# Step 2: Gradle 构建
if (!$SkipBuild -and !$VerifyOnly) {
  Step "Gradle 构建 assembleProdDebug"
  Push-Location "F:\pp\android"
  .\gradlew.bat assembleProdDebug
  if ($LASTEXITCODE -ne 0) { Write-Host "GRADLE FAILED" -ForegroundColor Red; exit 1 }
  Pop-Location
  $size = [math]::Round((Get-Item $apk).Length / 1MB, 0)
  Write-Host "APK: $size MB" -ForegroundColor Green
}

# Step 3: 安装 APK
if (!$SkipInstall -and !$VerifyOnly) {
  Step "安装 APK"
  & $adb install -r $apk
}

# Step 4: 授权存储访问
Step "授权 MANAGE_EXTERNAL_STORAGE"
& $adb shell appops set $pkg MANAGE_EXTERNAL_STORAGE allow

# Step 5: 启动应用
Step "启动应用"
& $adb shell am start -n "$pkg/.MainActivity"

# Step 6: UI 验证
Step "UI 层次结构 dump"
Start-Sleep -Seconds 3
& $adb shell uiautomator dump /sdcard/ui_dump.xml
& $adb pull /sdcard/ui_dump.xml "F:\pp\.tmp\ui_dump.xml" 2>$null

# Step 7: 生成即落盘验证
Step "生成即落盘验证"
$date = Get-Date -Format "yyyy-MM-dd"
& $adb shell ls /sdcard/Documents/AIOS/workspace/conversations/
& $adb shell cat "/sdcard/Documents/AIOS/workspace/conversations/$date.md" 2>$null

# Step 8: Workspace 文件验证
Step "Workspace 文件验证"
& $adb shell ls /sdcard/Documents/AIOS/workspace/

Write-Host "`n[DONE] 验证完成" -ForegroundColor Green
