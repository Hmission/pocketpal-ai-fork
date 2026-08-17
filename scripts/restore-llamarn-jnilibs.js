#!/usr/bin/env node
/* eslint-env node */
/**
 * llama.rn jniLibs 完整性检查与恢复（2026-08-17 防御脚本）
 *
 * 背景：llama.rn 0.12.7 上游发布不一致——npm 包代码（RNLlama.java）期望
 * librnllama_jni_*.so（带 _jni 后缀，含 JNI 绑定的本地编译产物），但官方
 * postinstall 下载的 prebuilt 只有无 _jni 的核心库。本项目依赖早期本地编译
 * 的 _jni 变体（不在任何版本控制中）。jniLibs 一旦被删（重装依赖/清理），
 * 仅靠官方 postinstall 无法恢复 → RNLlama.loadNative() 全部 dlopen 失败 →
 * "JSI bindings not installed"。
 *
 * 本脚本在 yarn postinstall 时运行：检测缺失 → 按优先级从备份源恢复 →
 * 全部失败则显式报错（把"无声丢失"变成"自动修复或明确失败"）。
 *
 * 恢复源优先级：
 *   1. .tmp/llamarn-jni-backup/（本脚本成功运行后同步的滚动备份）
 *   2. android/app/build/intermediates/merged_native_libs/<variant>/<merge>NativeLibs/out/lib/<abi>/
 *      （gradle 构建缓存，clean 后失效）
 *   3. android/app/build/outputs/apk/prod/release/app-prod-release.apk（旧版 APK 提取）
 *   4. 全部失败 → exit 1 显式报错
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JNI_LIBS = path.join(
  ROOT,
  'node_modules/llama.rn/android/src/main/jniLibs',
);
const BACKUP_DIR = path.join(ROOT, '.tmp/llamarn-jni-backup');
const RELEASE_APK = path.join(
  ROOT,
  'android/app/build/outputs/apk/prod/release/app-prod-release.apk',
);
// 防空文件/损坏文件。_jni 变体存在两种形态：685KB JNI shim（依赖 9.4MB 核心库）
// 与 15.4MB 引擎内联版，均有效；阈值取 100KB 只拦空文件/截断文件。
const MIN_SO_BYTES = 100 * 1024;

// 完整清单：无 _jni 核心库（官方 prebuilt 可下载）+ _jni 变体（本项目必需、官方缺失）
const EXPECTED = {
  'arm64-v8a': [
    'librnllama.so',
    'librnllama_v8.so',
    'librnllama_v8_2.so',
    'librnllama_v8_2_dotprod.so',
    'librnllama_v8_2_dotprod_i8mm.so',
    'librnllama_v8_2_dotprod_i8mm_hexagon_opencl.so',
    'librnllama_v8_2_i8mm.so',
    'librnllama_jni.so',
    'librnllama_jni_v8.so',
    'librnllama_jni_v8_2.so',
    'librnllama_jni_v8_2_dotprod.so',
    'librnllama_jni_v8_2_dotprod_i8mm.so',
    'librnllama_jni_v8_2_dotprod_i8mm_hexagon_opencl.so',
    'librnllama_jni_v8_2_i8mm.so',
  ],
  x86_64: [
    'librnllama.so',
    'librnllama_x86_64.so',
    'librnllama_jni.so',
    'librnllama_jni_x86_64.so',
  ],
};

const log = msg => console.log(`[llamarn-restore] ${msg}`);
const err = msg => console.error(`[llamarn-restore] ERROR: ${msg}`);

function isValid(pathName) {
  try {
    return (
      fs.existsSync(pathName) &&
      fs.statSync(pathName).isFile() &&
      fs.statSync(pathName).size >= MIN_SO_BYTES
    );
  } catch {
    return false;
  }
}

function missingFiles(abi) {
  const dir = path.join(JNI_LIBS, abi);
  return EXPECTED[abi].filter(f => !isValid(path.join(dir, f)));
}

/** 枚举可用的恢复源目录（按优先级，只保留存在且含 .so 的） */
function listSources(abi) {
  const sources = [];
  // 1. 滚动备份（本脚本同步，物理稳定）
  sources.push(path.join(BACKUP_DIR, abi));
  // 2. gradle 构建缓存（clean 后失效，仍是快速来源）
  const mergedRoot = path.join(
    ROOT,
    'android/app/build/intermediates/merged_native_libs',
  );
  if (fs.existsSync(mergedRoot)) {
    for (const variant of fs.readdirSync(mergedRoot)) {
      const variantDir = path.join(mergedRoot, variant);
      if (!fs.statSync(variantDir).isDirectory()) continue;
      const mergeSub = fs
        .readdirSync(variantDir)
        .find(n => n.startsWith('merge') && n.endsWith('NativeLibs'));
      if (!mergeSub) continue;
      const out = path.join(variantDir, mergeSub, 'out', 'lib', abi);
      if (fs.existsSync(out)) sources.push(out);
    }
  }
  return sources;
}

/** 从目录源复制缺失的 so，返回仍未恢复的列表 */
function copyMissing(abi, missing) {
  for (const srcDir of listSources(abi)) {
    if (missing.length === 0) break;
    for (const f of [...missing]) {
      const src = path.join(srcDir, f);
      if (isValid(src)) {
        const dstDir = path.join(JNI_LIBS, abi);
        fs.mkdirSync(dstDir, {recursive: true});
        fs.copyFileSync(src, path.join(dstDir, f));
        log(`restored ${abi}/${f} <- ${path.relative(ROOT, srcDir)}`);
        missing.splice(missing.indexOf(f), 1);
      }
    }
  }
  return missing;
}

/**
 * 从 zip/APK 提取条目（纯 Node 实现，不依赖 tar/解压命令）。
 * APK 中的 .so 为 STORED 未压缩（Android 打包惯例，保证可 mmap），
 * 直接字节复制；DEFLATE 条目用内置 zlib 解压兜底。
 */
function extractZipEntries(apkPath, wantedSet) {
  const buf = fs.readFileSync(apkPath);
  const out = new Map(); // name -> Buffer

  // 定位 EOCD（签名 PK\x05\x06），注释最长 65535
  const eocdStart = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= eocdStart; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return out;

  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdEnd = cdOffset + cdSize;
  let pos = cdOffset;

  while (pos + 46 <= cdEnd) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break; // 中央目录条目签名 PK\x01\x02
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);

    if (wantedSet.has(name)) {
      // 本地文件头定位数据（签名 PK\x03\x04）
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) {
        out.set(name, Buffer.from(data)); // STORED
      } else if (method === 8) {
        try {
          const zlib = require('zlib');
          out.set(name, zlib.inflateRawSync(data)); // DEFLATE 兜底
        } catch {
          // 解压失败则跳过该条目
        }
      }
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** 最后手段：从旧版 release APK 提取（纯 Node zip 读取） */
function restoreFromApk() {
  if (!fs.existsSync(RELEASE_APK)) return;
  const wanted = new Set();
  for (const abi of Object.keys(EXPECTED)) {
    for (const f of EXPECTED[abi]) wanted.add(`lib/${abi}/${f}`);
  }
  const entries = extractZipEntries(RELEASE_APK, wanted);
  if (entries.size === 0) return;

  for (const [entryName, data] of entries) {
    if (data.length < MIN_SO_BYTES) continue;
    const parts = entryName.split('/'); // lib/<abi>/<file>
    const abi = parts[1];
    const f = parts[2];
    const dstDir = path.join(JNI_LIBS, abi);
    fs.mkdirSync(dstDir, {recursive: true});
    const dst = path.join(dstDir, f);
    if (!isValid(dst)) {
      fs.writeFileSync(dst, data);
      log(`restored ${abi}/${f} <- release APK`);
    }
  }
}

/** 成功恢复后同步滚动备份，供下次快速恢复 */
function syncBackup(abi) {
  const srcDir = path.join(JNI_LIBS, abi);
  const dstDir = path.join(BACKUP_DIR, abi);
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(dstDir, {recursive: true});
  for (const f of fs.readdirSync(srcDir)) {
    if (!f.endsWith('.so')) continue;
    const src = path.join(srcDir, f);
    if (isValid(src)) fs.copyFileSync(src, path.join(dstDir, f));
  }
}

function main() {
  if (!fs.existsSync(JNI_LIBS)) {
    // 目录整体被删是典型故障场景：创建空目录后走常规恢复流程
    log('llama.rn jniLibs 目录不存在，尝试从备份源恢复…');
    fs.mkdirSync(JNI_LIBS, {recursive: true});
  }
  let allOk = true;
  for (const abi of Object.keys(EXPECTED)) {
    let missing = missingFiles(abi);
    if (missing.length > 0) {
      log(`${abi} 缺失 ${missing.length} 个 so，尝试恢复…`);
      missing = copyMissing(abi, missing);
    }
    if (missing.length > 0) {
      restoreFromApk();
      missing = missingFiles(abi);
    }
    if (missing.length > 0) {
      err(`${abi} 仍缺失: ${missing.join(', ')}`);
      err(
        '恢复源均不可用。请从备份找回 librnllama_jni*.so 放入 ' +
          'node_modules/llama.rn/android/src/main/jniLibs/<abi>/，' +
          '或运行 yarn build:android-libs（本地编译 llama.rn，耗时数小时）。',
      );
      allOk = false;
    } else {
      syncBackup(abi);
      log(`${abi} 完整（${EXPECTED[abi].length} 个 so）`);
    }
  }
  if (!allOk) {
    process.exit(1);
  }
  log('llama.rn jniLibs 完整性检查通过');
}

main();
