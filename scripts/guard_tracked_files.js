#!/usr/bin/env node
/**
 * guard_tracked_files — tracked 文件完整性哨兵（2026-08-25 219 文件事故防护）
 *
 * 事故背景：并行窗口/人工操作绕过 git 批量删除 src/components 下 219 个
 * tracked 文件（未 git rm、未提交），tsc/jest/Metro 全链路瘫痪且无任何
 * 审计记录——删除"无声"直到构建才被发现。
 *
 * 检测特征：**index 中仍登记、但工作区消失的 tracked 文件**。
 *   - `git ls-files --deleted`：index 有、磁盘无（含已暂存删除）；
 *   - 减去 `git diff --cached --diff-filter=D`（合法 git rm 的暂存删除）；
 *   - 剩余 = 无声删除。
 * 沙箱环境 git 偶发"拒绝访问"（cygheap 初始化失败）→ 内部三重试兜底；
 * 必须 execFileSync（shell:false 直启 git.exe）——execSync 走 cmd /c 链路
 * 在沙箱下必然触发 cygheap 失败（实测血证）。
 *
 * 挂载点：
 *   - .husky/pre-commit：任何 commit 前强制检查，无声删除直接拒绝提交；
 *   - package.json `yarn verify:worktree`：构建/开发前置手动巡检。
 *
 * B1 扩展（2026-08-26 治理窗口）：规则 SSOT 引用完整性检查——
 * hooks/脚本承诺读取的规则 SSOT（config/、.cursor/rules/、docs/platform/、
 * scripts/hooks/compass.py、AGENTS.md 协议章节）在连仓缺失时 hook 半激活而不自知
 * （假激活误判）。缺失仅输出 WARN 清单，不改变退出码契约（0/1/2 保持定时巡检语义）。
 *
 * 用法：node scripts/guard_tracked_files.js [--quiet] [--allow]
 *   --quiet 仅输出异常结论行（供定时巡检做判断）
 *   --allow 跳过检查直接放行（应急逃生阀，不推荐常态使用）
 * 退出码：0 = 完整/放行；1 = 无声删除；2 = git 不可用（降级放行并警示）
 */
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const quiet = process.argv.includes('--quiet');
const allow = process.argv.includes('--allow');

/** 执行 git 命令（直启 git.exe 不经 cmd），带三重试（沙箱下偶发失败） */
function git(...args) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return execFileSync('git', ['--no-pager', ...args], {
        encoding: 'utf8',
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * B1：规则 SSOT 引用完整性检查（连仓 hook 半激活检测）。
 * 引用清单来自治理修复方案 §2.1（.qoder/specs/治理规则记忆链路修复升级方案_task-6d0f.md）。
 * AGENTS.md 用协议关键词探测（宽松：任一命中即视为存在）。
 */
const SSOT_REFERENCES = [
  {
    p: 'config/aios_mind_bootstrap.md',
    src: 'zero-shot-inject / mind-bootstrap-guard',
    note: '§0 心智恢复协议',
    probe: null,
  },
  {
    p: 'config/context_bootstrap_manifest.json',
    src: 'zero-shot-inject',
    note: 'bootstrap 上下文清单',
    probe: null,
  },
  {
    p: '.cursor/rules',
    src: 'gate-guard / agent_router',
    note: 'persona/subconscious 等 mdc 规则',
    probe: null,
  },
  {
    p: 'scripts/hooks/compass.py',
    src: 'compass-711-gate / zero-shot-inject',
    note: '指南针格式化库',
    probe: null,
  },
  {
    p: 'docs/platform',
    src: 'nine_d_memory_api / agent_router route',
    note: '9D SSOT / EPEV 任务契约',
    probe: null,
  },
  {
    p: 'AGENTS.md',
    src: 'gate-guard / search-depth-guard',
    note: '协议章节 §0/§4.3/§5.4/§5.6 关键词',
    probe: /心智恢复|KG 优先|漏斗层级/,
  },
];

function ssotMissing() {
  const missing = [];
  for (const ref of SSOT_REFERENCES) {
    const abs = path.resolve(ref.p);
    let ok = fs.existsSync(abs);
    if (ok && ref.probe) {
      try {
        ok = ref.probe.test(fs.readFileSync(abs, 'utf8'));
      } catch (e) {
        ok = false;
      }
    }
    if (!ok) {
      missing.push(ref);
    }
  }
  return missing;
}

try {
  if (allow) {
    if (!quiet) {
      console.log('[guard] --allow 跳过检查，放行');
    }
    process.exit(0);
  }

  const missing = git('ls-files', '--deleted').split(/\r?\n/).filter(Boolean);

  // B1：规则 SSOT 引用完整性（前置输出，不改变退出码契约）
  const missingSsot = ssotMissing();
  if (missingSsot.length > 0) {
    console.error(
      `[guard] ⚠️ 规则SSOT引用缺失 ${missingSsot.length}/${SSOT_REFERENCES.length}` +
        '（hook 半激活风险，见治理修复方案 §2.1）：',
    );
    missingSsot.forEach(r =>
      console.error(`  - ${r.p}（${r.src}：${r.note}）`),
    );
  }

  const staged = new Set(
    git('diff', '--cached', '--name-only', '--diff-filter=D')
      .split(/\r?\n/)
      .filter(Boolean),
  );
  const silent = missing.filter(f => !staged.has(f));

  if (silent.length === 0) {
    if (!quiet) {
      console.log(
        `[guard] 工作区完整：${missing.length} 个已登记删除（git rm）均为合法操作`,
      );
    }
    process.exit(0);
  }

  console.error(
    `[guard] ❌ 发现 ${silent.length} 个 tracked 文件被无声删除（未走 git rm/未暂存）：`,
  );
  silent.slice(0, 30).forEach(f => console.error(`  - ${f}`));
  if (silent.length > 30) {
    console.error(`  … 等共 ${silent.length} 个`);
  }
  console.error(
    `\n[guard] 恢复：git restore -- <file>…（批量：git restore -- ${silent
      .slice(0, 10)
      .map(f => `"${f}"`)
      .join(' ')} …）`,
  );
  console.error(
    '[guard] 提示：删除/移动 tracked 文件必须走 git rm / git mv 留痕，' +
      '禁止 IDE 文件树/资源管理器批量删除。',
  );
  process.exit(1);
} catch (e) {
  // git 不可用时降级放行（哨兵不可成为构建阻塞点），但给出可见警示
  console.error(`[guard] ⚠️ 哨兵无法调用 git（${e.message}），本次降级放行`);
  process.exit(2);
}
