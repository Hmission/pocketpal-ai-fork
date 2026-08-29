#!/usr/bin/env node
/* PocketCL T1 CLI：设备卡生成器（device-card.js）
 *
 * 用途（Phase 1 验收项：设备卡 JSON 生成器可复现）：
 *   1) --list                    列出 devices/ 现有设备卡
 *   2) --id <id> [--probe <j>]   生成/合并设备卡：
 *        - 读 devices/<id>.json 静态卡（三态诚实分级，getprop 实锤口径）
 *        - 可选 --probe：新设备运行时探测 JSON（getprop/OpenCL 探测），
 *          其 verified 段合并进输出，pending 段保留
 *        - 输出到 stdout（--out <file> 落盘）
 * 示例：
 *   node cli/device-card.js --list
 *   node cli/device-card.js --id k90-promax-sm8850
 *   node cli/device-card.js --id neue-device --probe probe.json --out devices/neue-device.json
 *
 * 原则：输出永远三态诚实（verified 带 source / pending 明示待测 / reference 标注口径），
 *       无 source 的 verified 项会被拒绝——真机唯一权威。
 */
const fs = require('fs');
const path = require('path');

const DEVICES_DIR = path.join(__dirname, '..', 'devices');
const REQUIRED = [
  'id',
  'product',
  'model',
  'serial',
  'soc',
  'gpuFamily',
  'gpuModel',
  'ramMb',
];

function fail(msg) {
  console.error(`[device-card] ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {list: false, id: null, probe: null, out: null};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--list':
        args.list = true;
        break;
      case '--id':
        args.id = argv[++i] || null;
        break;
      case '--probe':
        args.probe = argv[++i] || null;
        break;
      case '--out':
        args.out = argv[++i] || null;
        break;
    }
  }
  return args;
}

function validateCard(card, sourceFile) {
  for (const k of REQUIRED) {
    if (!(k in card)) fail(`卡片缺少必需字段 ${k}（${sourceFile}）`);
  }
  if (!['adreno', 'mali', 'unknown'].includes(card.gpuFamily))
    fail(`gpuFamily 非法: ${card.gpuFamily}（${sourceFile}）`);
  if (!Array.isArray(card.verified))
    fail(`verified 必须为数组（${sourceFile}）`);
  for (const v of card.verified) {
    if (!v.source)
      fail(
        `verified 项 ${v.key} 缺 source——无来源证据的实测项禁止发布（${sourceFile}）`,
      );
  }
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    const files = fs
      .readdirSync(DEVICES_DIR)
      .filter(f => f.endsWith('.json') && f !== 'schema.json');
    for (const f of files) {
      const card = JSON.parse(
        fs.readFileSync(path.join(DEVICES_DIR, f), 'utf8'),
      );
      console.log(
        `${card.id}  ${card.product}/${card.soc}  ${card.gpuFamily}:${card.gpuModel}  verified=${card.verified.length} pending=${(card.pending || []).length}`,
      );
    }
    return;
  }

  if (!args.id) fail('需要 --id <设备卡 id> 或 --list');
  const cardFile = path.join(DEVICES_DIR, `${args.id}.json`);
  if (!fs.existsSync(cardFile))
    fail(`设备卡不存在: ${cardFile}（先准备 getprop 实锤探测）`);
  const card = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
  validateCard(card, cardFile);

  if (args.probe) {
    if (!fs.existsSync(args.probe)) fail(`probe 文件不存在: ${args.probe}`);
    const probe = JSON.parse(fs.readFileSync(args.probe, 'utf8'));
    if (!probe.verified || !Array.isArray(probe.verified))
      fail('probe 需要 verified 数组（每项含 key/value/source）');
    for (const v of probe.verified)
      if (!v.source) fail(`probe verified 项 ${v.key} 缺 source`);
    for (const v of probe.verified) {
      if (!card.verified.some(x => x.key === v.key)) card.verified.push(v);
    }
    card.updated = new Date().toISOString().slice(0, 10);
    validateCard(card, `${cardFile} + probe`);
  }

  const out = JSON.stringify(card, null, 2) + '\n';
  if (args.out) {
    fs.writeFileSync(args.out, out, 'utf8');
    console.log(`[device-card] 已写入 ${args.out}`);
  } else {
    process.stdout.write(out);
  }
}

main();
