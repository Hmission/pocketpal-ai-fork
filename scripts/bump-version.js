#!/usr/bin/env node
/**
 * bump-version.js — 版本号四处同步单点命令（发布流程唯一入口）
 *
 * 用法：
 *   node scripts/bump-version.js <major|minor|patch>   按 semver 自动计算
 *   node scripts/bump-version.js 2.1.0                 显式指定目标版本
 *
 * 四处同步：
 *   .version（单一事实源） / package.json /
 *   android/app/build.gradle（versionName + versionCode 自增 1） /
 *   ios/PocketPal.xcodeproj/project.pbxproj（MARKETING_VERSION +
 *   CURRENT_PROJECT_VERSION 全出现处）
 *
 * 规则：
 *   - 当前版本以 .version 为准
 *   - versionCode 全局单调递增，每次 bump +1（升级兼容红线）
 *   - 目标版本与当前相同 → 显式失败（不静默）
 *   - 后续动作不在脚本内：CHANGELOG 收编 + commit + git tag（发布流程见 AGENTS.md）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function computeTarget(current, arg) {
  if (SEMVER_RE.test(arg)) return arg;
  const m = current.match(SEMVER_RE);
  if (!m) throw new Error(`当前版本格式非法: ${current}`);
  const maj = Number(m[1]);
  const min = Number(m[2]);
  const pat = Number(m[3]);
  if (arg === 'major') return `${maj + 1}.0.0`;
  if (arg === 'minor') return `${maj}.${min + 1}.0`;
  if (arg === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`参数必须是 semver 版本号或 major|minor|patch，收到: ${arg}`);
}

function bumpVersion(rootDir, arg) {
  const versionPath = path.join(rootDir, '.version');
  const current = fs.readFileSync(versionPath, 'utf8').trim();
  const target = computeTarget(current, arg);
  if (target === current) {
    throw new Error(`版本号已是 ${current}，无需 bump`);
  }

  const changes = [];

  // 1) .version（单一事实源）
  fs.writeFileSync(versionPath, `${target}\n`);
  changes.push(`.version: ${current} -> ${target}`);

  // 2) package.json
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = fs.readFileSync(pkgPath, 'utf8');
  const pkgNext = pkg.replace(/"version":\s*"[^"]+"/, `"version": "${target}"`);
  if (pkgNext === pkg) throw new Error('package.json 未找到 version 字段');
  fs.writeFileSync(pkgPath, pkgNext);
  changes.push(`package.json: -> ${target}`);

  // 3) android/app/build.gradle（versionCode 自增）
  const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
  const gradle = fs.readFileSync(gradlePath, 'utf8');
  const codeMatch = gradle.match(/versionCode\s+(\d+)/);
  if (!codeMatch) throw new Error('build.gradle 未找到 versionCode');
  const newCode = Number(codeMatch[1]) + 1;
  let gradleNext = gradle.replace(/versionCode\s+\d+/, `versionCode ${newCode}`);
  gradleNext = gradleNext.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${target}"`,
  );
  if (!/versionName/.test(gradleNext)) {
    throw new Error('build.gradle 未找到 versionName');
  }
  fs.writeFileSync(gradlePath, gradleNext);
  changes.push(`build.gradle: versionName -> ${target}, versionCode -> ${newCode}`);

  // 4) ios pbxproj（全出现处替换）
  const pbxPath = path.join(
    rootDir,
    'ios',
    'PocketPal.xcodeproj',
    'project.pbxproj',
  );
  const pbx = fs.readFileSync(pbxPath, 'utf8');
  const marketingCount = (pbx.match(/MARKETING_VERSION = [^;]+;/g) || []).length;
  if (marketingCount === 0) {
    throw new Error('project.pbxproj 未找到 MARKETING_VERSION');
  }
  const pbxNext = pbx
    .replace(
      /CURRENT_PROJECT_VERSION = \d+;/g,
      `CURRENT_PROJECT_VERSION = ${newCode};`,
    )
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${target};`);
  fs.writeFileSync(pbxPath, pbxNext);
  changes.push(
    `project.pbxproj: ${marketingCount} 处 MARKETING_VERSION -> ${target}, CURRENT_PROJECT_VERSION -> ${newCode}`,
  );

  return {current, target, newCode, changes};
}

module.exports = {bumpVersion, computeTarget};

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('用法: node scripts/bump-version.js <major|minor|patch|x.y.z>');
    process.exit(1);
  }
  try {
    const root = path.resolve(__dirname, '..');
    const r = bumpVersion(root, arg);
    console.log(`OK ${r.current} -> ${r.target} (versionCode ${r.newCode})`);
    r.changes.forEach(c => console.log(`  - ${c}`));
    console.log(
      `\n后续（发布流程）: CHANGELOG [Unreleased] 收编定版 -> git commit -> git tag v${r.target}`,
    );
  } catch (e) {
    console.error(`FAIL ${e.message}`);
    process.exit(1);
  }
}
