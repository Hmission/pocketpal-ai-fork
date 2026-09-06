#!/usr/bin/env node
/**
 * 跨平台 postinstall（取代 scripts/postinstall.sh，MASTER_LOG §151）。
 *
 * 为什么换掉 .sh：那版在本机（Windows）是**回声执行**——`yarn install` 会原样打印
 * `$ ./scripts/postinstall.sh` 并以退出码 0 报 "Done"，但脚本内每一步都没真跑
 * （实测：删掉 onnxruntime 的 max-page-size 行 + 一颗 jniLibs .so 后完整 install，
 * 两者均未恢复）。yarn 在 Windows 用 cmd 起 `.sh`，命中 WSL 存根 / 无关联解释器，
 * 于是整条恢复链形同虚设；老开发机靠手工补救，新克隆的人直接踩空。
 *
 * 三条纪律：
 *   1. **失败要响**：关键步任一失败即非零退出（旧版 `|| echo WARNING` 把丢失变成静默）；
 *   2. **不做网络硬依赖**：可选项（OpenCL 头文件）失败只警告，不挂住 install；
 *   3. **自检播报**：结束时打印补丁与原生库的真实落地状态，别让人去 grep node_modules。
 *
 * 另记一条使用纪律：**别用 `yarn install --ignore-scripts`**。它会连 llama.rn 官方
 * postinstall 一起跳过，结果是 jniLibs 18 颗原生库不下载、patch-package 不应用
 * （生图 ONNX 丢 16KB page 对齐与 ORT 锁版本）。本脚本不跑 pod，没有"Mac 步骤
 * 挡住 Windows"的顾虑。
 */

const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const log = msg => console.log(`[postinstall] ${msg}`);
const failures = [];

const run = (cmd, args) =>
  spawnSync(cmd, args, {cwd: ROOT, stdio: 'inherit', encoding: 'utf8'});

/** 关键步：非零退出即记账，最后统一 fail。 */
function must(label, cmd, args) {
  const r = run(cmd, args);
  if (r.status !== 0) {
    failures.push(`${label}（exit ${r.status}）`);
    console.error(`[postinstall] ERROR: ${label} 失败`);
  }
}

// ── 1. patch-package：把 patches/ 下的改动打进 node_modules ──────────────────
// 走 index.js 入口而非 npx：Windows 下 npx 是 .cmd，需要 shell，跨平台反而易歪。
const PATCH_ENTRY = path.join(ROOT, 'node_modules/patch-package/index.js');
if (fs.existsSync(PATCH_ENTRY)) {
  must(
    'patch-package 未应用（生图 ONNX 会缺 16KB page 对齐与 ORT 锁版本）',
    process.execPath,
    [PATCH_ENTRY],
  );
} else {
  failures.push(
    'patch-package 未安装（node_modules/patch-package/index.js 缺失）',
  );
}

// ── 2. llama.rn 原生库：缺则从备份恢复，缺且无备份则硬失败 ───────────────────
must(
  'llama.rn jniLibs 校验/恢复失败（RNLlama.loadNative 会 dlopen 失败，聊天起不来）',
  process.execPath,
  [path.join(ROOT, 'scripts/restore-llamarn-jnilibs.js')],
);

// ── 3. OpenCL 头文件（可选）：仅在源码重编 llama.rn 时才需要 ─────────────────
// 当前发布链用官方 prebuilt，不依赖它；缺网/缺 git 时不该拖垮 install，故只警告。
const OPENCL_HEADERS = path.join(
  ROOT,
  'node_modules/llama.rn/third_party/OpenCL-Headers',
);
if (!fs.existsSync(OPENCL_HEADERS)) {
  log(
    'OpenCL headers missing, cloning (optional, only needed to rebuild llama.rn from source)…',
  );
  fs.mkdirSync(path.dirname(OPENCL_HEADERS), {recursive: true});
  const r = run('git', [
    'clone',
    '--depth',
    '1',
    'https://github.com/KhronosGroup/OpenCL-Headers.git',
    OPENCL_HEADERS,
  ]);
  if (r.status !== 0) {
    log('WARN: OpenCL headers clone failed — 仅影响源码重编 llama.rn，可忽略');
  }
}

// ── 4. 自检播报：把"落地没有"摊在眼前，不让人事后 grep ─────────────────────
const probes = [
  {
    what: 'onnxruntime 16KB page 对齐',
    ok: () =>
      fs
        .readFileSync(
          path.join(
            ROOT,
            'node_modules/onnxruntime-react-native/android/CMakeLists.txt',
          ),
          'utf8',
        )
        .includes('max-page-size=16384'),
  },
  {
    what: 'onnxruntime ORT 锁版本',
    ok: () => {
      const g = fs.readFileSync(
        path.join(
          ROOT,
          'node_modules/onnxruntime-react-native/android/build.gradle',
        ),
        'utf8',
      );
      return (
        g.includes('onnxruntime-android:1.27.0@aar') &&
        g.includes('import org.gradle.util.internal.VersionNumber')
      );
    },
  },
  {
    what: 'llama.rn jniLibs（arm64-v8a 14 颗）',
    ok: () => {
      const dir = path.join(
        ROOT,
        'node_modules/llama.rn/android/src/main/jniLibs/arm64-v8a',
      );
      if (!fs.existsSync(dir)) {
        return false;
      }
      const names = new Set(fs.readdirSync(dir));
      return (
        ['librnllama.so', 'librnllama_jni.so', 'librnllama_v8.so'].every(n =>
          names.has(n),
        ) && names.size >= 14
      );
    },
  },
];

console.log('');
log('=== 构建链自检 ===');
for (const probe of probes) {
  let ok = false;
  try {
    ok = probe.ok();
  } catch {
    ok = false;
  }
  log(`${ok ? 'OK  ' : 'FAIL'} ${probe.what}`);
  if (!ok) {
    failures.push(`自检未通过：${probe.what}`);
  }
}

if (failures.length) {
  console.error('');
  console.error(
    `[postinstall] FAILED（${failures.length} 项）：\n${failures
      .map(f => `  - ${f}`)
      .join('\n')}`,
  );
  console.error(
    '[postinstall] 现在打出的安装包会缺功能，请先修好再构建（勿用 --ignore-scripts 绕过）。',
  );
  process.exit(1);
}
log('全部通过');
