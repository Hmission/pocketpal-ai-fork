/* eslint-disable no-bitwise */ // PNG/字节操作为领域必需位运算（抽取自 dreamLiteEngine，显式豁免）
/**
 * pngUtil — 纯 JS PNG 编码工具（RGB8，zlib stored 不压缩）
 *
 * 从 dreamLiteEngine 抽取共享：生图引擎与超分引擎共用。
 * 契约：encodePng(rgb, w, h) 输入 RGB 交错 Uint8Array [0,255]，输出完整 PNG bytes。
 */

function crc32(buf: Uint8Array): number {
  let c: number;
  const table = crcTable();
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

let _table: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (_table) {
    return _table;
  }
  _table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    _table[n] = c >>> 0;
  }
  return _table;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const out = new Uint8Array(12 + len);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, len);
  for (let i = 0; i < 4; i++) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(data, 8);
  dv.setUint32(8 + len, crc32(out.subarray(4, 8 + len)));
  return out;
}

// zlib "stored"（不压缩）封装：0x78 0x01 + stored blocks + adler32，纯 JS 无依赖
function adler32(d: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    a = (a + d[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibStored(d: Uint8Array): Uint8Array {
  const blocks: number[] = [];
  blocks.push(0x78, 0x01);
  for (let off = 0; off < d.length; off += 65535) {
    const len = Math.min(65535, d.length - off);
    const last = off + len >= d.length ? 1 : 0;
    blocks.push(last); // BFINAL+BTYPE(00)
    blocks.push(len & 0xff, (len >> 8) & 0xff, ~len & 0xff, (~len >> 8) & 0xff);
    for (let i = 0; i < len; i++) {
      blocks.push(d[off + i]);
    }
  }
  const ad = adler32(d);
  blocks.push(
    (ad >>> 24) & 0xff,
    (ad >>> 16) & 0xff,
    (ad >>> 8) & 0xff,
    ad & 0xff,
  );
  return new Uint8Array(blocks);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(d: Uint8Array): string {
  let s = '';
  for (let i = 0; i < d.length; i += 3) {
    const a = d[i];
    const b = i + 1 < d.length ? d[i + 1] : 0;
    const c = i + 2 < d.length ? d[i + 2] : 0;
    s +=
      B64[a >> 2] +
      B64[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < d.length ? B64[((b & 15) << 2) | (c >> 6)] : '=') +
      (i + 2 < d.length ? B64[c & 63] : '=');
  }
  return s;
}

export function encodePng(rgb: Uint8Array, w: number, h: number): Uint8Array {
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  const idat = zlibStored(raw);
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const B64_REVERSE = (() => {
  const t: Record<string, number> = {};
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) {
    t[chars[i]] = i;
  }
  return t;
})();

/** base64 → 字节数组（纯 JS 位运算，不依赖 Hermes atob 的二进制字符串语义）。 */
export function base64ToBytes(b64: string): Uint8Array {
  let len = b64.length;
  while (len > 0 && b64[len - 1] === '=') {
    len--;
  }
  const out = new Uint8Array(Math.floor((len * 6) / 8));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < len; i++) {
    acc = (acc << 6) | B64_REVERSE[b64[i]];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}
