#!/usr/bin/env node
/* PocketCL T2 CLI：CLPROF 算子榜单聚合器（probe-topn.js）
 *
 * 数据源（引擎侧 ggml-opencl.cpp 打点，格式已实锤 2026-08-29）：
 *   header: [CLPROF] === kernel time top %zu (total %.1f ms, %zu calls) ===
 *   row:    [CLPROF] %8.2f ms (%5.1f%%) x%-6zu %s
 *   (另有 mm 形状行 [CLPROF] mm a=... 属诊断细节，本工具忽略)
 * 用法：
 *   adb logcat -d | node cli/probe-topn.js --top 10
 *   node cli/probe-topn.js -f logcat.txt --top 10 --json
 * 语义（对齐 handbook 铁律 1）：先出算子榜单再动手——榜单即每一轮优化的入口。
 */
const fs = require('fs');

/* [CLPROF]   1234.56 ms ( 71.1%) x42     mul_mm_q4_k_f32_l4_lm */
const ROW_RE =
  /\[CLPROF\]\s+([\d.]+)\s+ms\s*\(\s*([\d.]+)%\)\s*x(\d+)\s+([A-Za-z0-9_]+)/;
/* [CLPROF] === kernel time top 10 (total 5200.0 ms, 89 calls) === */
const HEADER_RE =
  /\[CLPROF\] === kernel time top \d+ \(total\s+([\d.]+)\s+ms, (\d+) calls\) ===/;

function parseArgs(argv) {
  const args = {top: 10, json: false, file: null};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--top') args.top = parseInt(argv[++i], 10) || 10;
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '-f' || argv[i] === '--file') args.file = argv[++i];
  }
  return args;
}

function aggregate(lines) {
  const buckets = new Map(); /* name -> {ms, calls} */
  const header = {totalMs: 0, calls: 0, found: false};

  for (const line of lines) {
    const h = line.match(HEADER_RE);
    if (h) {
      header.found = true;
      header.totalMs = parseFloat(h[1]);
      header.calls = parseInt(h[2], 10);
      continue;
    }
    const m = line.match(ROW_RE);
    if (m) {
      const name = m[4];
      const ms = parseFloat(m[1]);
      const calls = parseInt(m[3], 10);
      const b = buckets.get(name) || {ms: 0, calls: 0};
      b.ms += ms;
      b.calls += calls;
      buckets.set(name, b);
    }
  }
  return {buckets, header};
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.file
    ? fs.readFileSync(args.file, 'utf8')
    : fs.readFileSync(0, 'utf8'); /* stdin：adb logcat -d | 直接管道 */

  const {buckets, header} = aggregate(input.split(/\r?\n/));
  const sorted = [...buckets.entries()]
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, args.top);
  const totalMs = header.found
    ? header.totalMs
    : [...buckets.values()].reduce((s, b) => s + b.ms, 0);
  const totalCalls = header.found
    ? header.calls
    : [...buckets.values()].reduce((s, b) => s + b.calls, 0);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          top: args.top,
          totalMs: Math.round(totalMs * 10) / 10,
          totalCalls,
          headerFound: header.found,
          entries: sorted.map(([name, b]) => ({
            name,
            calls: b.calls,
            totalMs: Math.round(b.ms * 10) / 10,
            avgMs: Math.round((b.ms / b.calls) * 100) / 100,
            pctOfTotal:
              totalMs > 0 ? Math.round((b.ms / totalMs) * 1000) / 10 : 0,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `[probe-topn] top ${sorted.length} kernels (total ${totalMs.toFixed(1)} ms, ${totalCalls} calls${header.found ? '' : ' [无 header，按行聚合]'})`,
  );
  console.log('  时间(ms)  占比%  次数  内核名');
  for (const [name, b] of sorted) {
    console.log(
      `  ${b.ms.toFixed(2).padStart(9)}  ${(totalMs > 0 ? (b.ms / totalMs) * 100 : 0).toFixed(1).padStart(5)}  ${String(b.calls).padStart(4)}  ${name}`,
    );
  }
  if (args.top < buckets.size)
    console.log(
      `  ... 其余 ${buckets.size - args.top} 个内核未展示（--top 调整）`,
    );
}

main();
