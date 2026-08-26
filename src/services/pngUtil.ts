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

// ===== PNG tEXt 生成参数元数据（开发项3：双写盘路径单路径收口）=====
// 契约：key 固定 'aios.gen'（App 命名空间，与 C 端 stbi_write_png 的 'parameters'
// 参数解耦，避免 WebUI 生态同名 key 撞车；value = UTF-8 JSON）。
// tEXt 块插在 IHDR 之后（IDAT 之前），PNG 规范允许任意位置。
// 写盘统一走 store 编排层 finishTask（三通道唯一汇聚点）：读回已落盘 PNG → 插块 → 回写。
// pngWithMeta 是插块非重编码（IDAT 像素零改动），C 族（JNI stbi_write_png 产物）与
// JS 族（DreamLite/超分 encodePng 产物）共用同一注入函数，零 C / 零 Kotlin / 零签名膨胀。
// 读回按 key + schema 双重门控：仅认本 App 写入的 JSON 对象（modelId 必填），
// 外部图无 aios.gen 块 → 返回 null（回落 DB 字段，不报错）。

export const PNG_META_KEY = 'aios.gen';

/** 生成参数元数据（SD/DreamLite/超分三通道共用 schema）
 * steps/cfg/seed 可空：超分/编辑通道无采样步数与 CFG，DreamLite flow matching 无显式 seed。 */
export interface PngGenMeta {
  prompt: string;
  modelId: string;
  steps: number | null;
  cfg: number | null;
  seed: number | null;
  width: number;
  height: number;
  backend: string;
  durationMs: number;
}

/** UTF-8 编码（Hermes 无 TextEncoder，手写实现：ASCII 直通，U+0080 以上多字节） */
function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c < 0xdc00) {
      // 代理对
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

/** UTF-8 解码（Hermes 无 TextDecoder，手写实现） */
function utf8Decode(d: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < d.length) {
    const b = d[i];
    if (b < 0x80) {
      s += String.fromCharCode(b);
      i++;
    } else if (b < 0xe0) {
      s += String.fromCharCode(((b & 0x1f) << 6) | (d[i + 1] & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      s += String.fromCharCode(
        ((b & 0x0f) << 12) | ((d[i + 1] & 0x3f) << 6) | (d[i + 2] & 0x3f),
      );
      i += 3;
    } else {
      const cp =
        ((b & 0x07) << 18) |
        ((d[i + 1] & 0x3f) << 12) |
        ((d[i + 2] & 0x3f) << 6) |
        (d[i + 3] & 0x3f);
      const off = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (off >> 10), 0xdc00 + (off & 0x3ff));
      i += 4;
    }
  }
  return s;
}

/** tEXt 块 value 上限 512 字节（方案 §D6：防异常块，PNG 规范无硬限但防极端 prompt 撑爆） */
const PNG_META_MAX_BYTES = 512;

/** 按 UTF-8 字节数截断字符串（二分缩字符，不切断多字节序列——中文/emoji 安全） */
function utf8Truncate(s: string, maxBytes: number): string {
  if (utf8Encode(s).length <= maxBytes) {
    return s;
  }
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (utf8Encode(s.slice(0, mid)).length <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return s.slice(0, lo);
}

/**
 * 给 PNG 字节注入 tEXt 元数据块（IHDR 之后插入）。
 * value 超 512 字节时按 UTF-8 字节感知截 prompt（不切多字节序列）；极端（核心字段仍超限）
 * 裁核心参数，保证块不超限（方案 §D6 裁定）。
 */
export function pngWithMeta(png: Uint8Array, meta: PngGenMeta): Uint8Array {
  let m: PngGenMeta = meta;
  let bytes = utf8Encode(JSON.stringify(m));
  if (bytes.length > PNG_META_MAX_BYTES) {
    // prompt 字节预算 = 总预算 − 空 prompt 的 JSON 开销（其余字段占位）
    const overhead = utf8Encode(JSON.stringify({...meta, prompt: ''})).length;
    const promptBudget = Math.max(0, PNG_META_MAX_BYTES - overhead);
    m = {...meta, prompt: utf8Truncate(meta.prompt, promptBudget)};
    bytes = utf8Encode(JSON.stringify(m));
    if (bytes.length > PNG_META_MAX_BYTES) {
      // 极端：modelId/backend 也超长（实际不会）→ 只留核心参数
      m = {
        prompt: '',
        modelId: utf8Truncate(meta.modelId, 64),
        steps: meta.steps,
        cfg: meta.cfg,
        seed: meta.seed,
        width: meta.width,
        height: meta.height,
        backend: utf8Truncate(meta.backend, 64),
        durationMs: meta.durationMs,
      };
      bytes = utf8Encode(JSON.stringify(m));
    }
  }
  const key = utf8Encode(PNG_META_KEY);
  const data = new Uint8Array(key.length + 1 + bytes.length); // key + null sep + value
  data.set(key, 0);
  data[key.length] = 0;
  data.set(bytes, key.length + 1);
  const tex = chunk('tEXt', data);
  // IHDR chunk = 签名(8) + IHDR(25)；tEXt 插在其后
  const insertAt = 8 + 25;
  const out = new Uint8Array(png.length + tex.length);
  out.set(png.subarray(0, insertAt), 0);
  out.set(tex, insertAt);
  out.set(png.subarray(insertAt), insertAt + tex.length);
  return out;
}

/**
 * 扫描 PNG 块，读取 tEXt 元数据（key='aios.gen'）。
 * 无 meta（旧图/外部图）→ 返回 null，调用方回落 DB 字段，不报错。
 */
export function readPngMetaBytes(png: Uint8Array): PngGenMeta | null {
  if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50) {
    return null;
  }
  let off = 8;
  while (off + 12 <= png.length) {
    // 长度（大端）
    const len =
      (png[off] << 24) |
      (png[off + 1] << 16) |
      (png[off + 2] << 8) |
      png[off + 3];
    if (len < 0 || off + 12 + len > png.length) {
      return null;
    }
    const type = String.fromCharCode(
      png[off + 4],
      png[off + 5],
      png[off + 6],
      png[off + 7],
    );
    if (type === 'tEXt') {
      const data = png.subarray(off + 8, off + 8 + len);
      const sep = data.indexOf(0);
      if (sep > 0) {
        const key = utf8Decode(data.subarray(0, sep));
        if (key === PNG_META_KEY) {
          try {
            const parsed = JSON.parse(utf8Decode(data.subarray(sep + 1)));
            // schema 门控：仅认本 App 写入的结构（modelId 必填）。
            // 'parameters' 是 WebUI 生态通用 key——外部图的同名块（参数串/非对象）
            // 在此被显式过滤，回落 DB 字段。
            if (
              parsed &&
              typeof parsed === 'object' &&
              typeof parsed.modelId === 'string'
            ) {
              return parsed as PngGenMeta;
            }
            return null;
          } catch {
            return null;
          }
        }
      }
    }
    off += 12 + len;
    if (type === 'IEND') {
      break;
    }
  }
  return null;
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
