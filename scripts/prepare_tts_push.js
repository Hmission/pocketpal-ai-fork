/**
 * prepare_tts_push.js — 小米13 TTS 模型推送前准备
 * 1) kokoro/tokens.txt（sherpa 生成链，从 tokenizer.json 生成，逻辑对齐 sherpaConvert.generateKokoroTokensTxt）
 * 2) supertonic/unicode_indexer.bin（int32 LE，对齐 convertUnicodeIndexer）
 * 3) supertonic/voices/{F1-F5,M1-M5}.bin（6×int64 头 + ttl/dp float32，对齐 convertVoiceStyle）
 * 4) kitten/espeak-ng-data（复用本地 kokoro 同源标准包，sherpa-onnx 共用）
 * 5) 校验 kitten_sherpa.onnx 下载完整性
 */
const fs = require('fs');
const path = require('path');

const BASE = 'F:/pp/.tmp/tts_models';

// ---------- 1. kokoro tokens.txt ----------
const tk = JSON.parse(
  fs.readFileSync(path.join(BASE, 'kokoro/tokenizer.json'), 'utf8'),
);
const vocab = tk.model && tk.model.vocab;
if (!vocab) throw new Error('kokoro tokenizer.json 缺少 model.vocab');
const lines = Object.entries(vocab).map(([t, id]) => `${t} ${id}`);
lines.sort((a, b) => Number(a.split(' ').pop()) - Number(b.split(' ').pop()));
fs.writeFileSync(path.join(BASE, 'kokoro/tokens.txt'), lines.join('\n') + '\n');
console.log(`[1] kokoro/tokens.txt OK (${lines.length} lines)`);

// ---------- 2. supertonic unicode_indexer.bin ----------
const arr = JSON.parse(
  fs.readFileSync(path.join(BASE, 'supertonic/unicode_indexer.json'), 'utf8'),
);
const uBuf = Buffer.alloc(arr.length * 4);
arr.forEach((v, i) => uBuf.writeInt32LE(v, i * 4));
fs.writeFileSync(path.join(BASE, 'supertonic/unicode_indexer.bin'), uBuf);
console.log(`[2] supertonic/unicode_indexer.bin OK (${arr.length} ints)`);

// ---------- 3. supertonic voices .bin ----------
function convertVoiceStyleSync(jsonPath, binPath) {
  const style = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const ttl = style.style_ttl && style.style_ttl.data;
  const dp = style.style_dp && style.style_dp.data;
  if (!ttl || !dp)
    throw new Error(`voice json 缺 style_ttl/style_dp: ${jsonPath}`);
  const ttlFlat = [];
  for (const d2 of ttl) for (const d1 of d2) ttlFlat.push(...d1);
  const dpFlat = [];
  for (const d2 of dp) for (const d1 of d2) dpFlat.push(...d1);
  const total = 48 + ttlFlat.length * 4 + dpFlat.length * 4;
  const buf = Buffer.alloc(total);
  const dims = [1, 50, 256, 1, 8, 16];
  dims.forEach((d, i) => buf.writeBigInt64LE(BigInt(d), i * 8));
  let off = 48;
  for (const v of ttlFlat) {
    buf.writeFloatLE(v, off);
    off += 4;
  }
  for (const v of dpFlat) {
    buf.writeFloatLE(v, off);
    off += 4;
  }
  fs.writeFileSync(binPath, buf);
  return total;
}
let vCount = 0;
for (const f of fs.readdirSync(path.join(BASE, 'supertonic'))) {
  if (/^[FM][1-5]\.json$/.test(f)) {
    const out = f.replace('.json', '.bin');
    const sz = convertVoiceStyleSync(
      path.join(BASE, 'supertonic', f),
      path.join(BASE, 'supertonic', out),
    );
    vCount++;
    console.log(`[3] supertonic/${out} OK (${sz} bytes)`);
  }
}
console.log(`[3] total ${vCount} voice bins`);

// ---------- 4. kitten espeak-ng-data（复用 kokoro 同源标准包） ----------
const srcE = path.join(BASE, 'kokoro/espeak-ng-data');
const dstE = path.join(BASE, 'kitten/espeak-ng-data');
fs.cpSync(srcE, dstE, {recursive: true});
const eCount = (() => {
  let n = 0;
  const walk = d => {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else n++;
    }
  };
  walk(dstE);
  return n;
})();
console.log(`[4] kitten/espeak-ng-data copied (${eCount} files)`);

// ---------- 5. kitten_sherpa.onnx 校验 ----------
const ksh = path.join(BASE, 'kitten/kitten_sherpa.onnx');
if (fs.existsSync(ksh) && fs.statSync(ksh).size > 20 * 1024 * 1024) {
  console.log(`[5] kitten_sherpa.onnx OK (${fs.statSync(ksh).size} bytes)`);
} else {
  console.log(
    `[5] kitten_sherpa.onnx MISSING/INCOMPLETE (${fs.existsSync(ksh) ? fs.statSync(ksh).size : 0})`,
  );
}

console.log('DONE');
