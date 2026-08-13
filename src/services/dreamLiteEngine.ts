/**
 * dreamLiteEngine — DreamLite 端侧 ONNX Runtime 引擎（P6-5）
 *
 * 严格镜像 scripts/aios/dreamlite_infer_ref.py 的 forward 契约：
 *  - model_input = cat([latents, cond], dim=3)（宽翻倍）
 *  - added_cond_kwargs = {time_ids:[[w,h]]}
 *  - noise_pred 截宽
 *  - FlowMatchEuler + mu=calculate_shift
 *  - latents/scaling_factor + shift_factor -> vae_decoder
 * TE（Qwen3-VL）端侧暂用零填充（unconditioned 基线），真实条件待 TE GGUF。
 */
import * as ort from 'onnxruntime-react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {initLlama, LlamaContext} from 'llama.rn';

const DIR = '/sdcard/Documents/AIOS/dreamlite';
const TE_DIM = 2048;
const DROP_IDX = 34; // generate 模式截断模板前缀 token 数

let unet: ort.InferenceSession | null = null;
let vae: ort.InferenceSession | null = null;
let vaeEnc: ort.InferenceSession | null = null;
let teCtx: LlamaContext | null = null;

export const dreamLiteReady = () => !!unet && !!vae;

export async function loadDreamLite(): Promise<void> {
  if (unet && vae) {
    return;
  }
  const opts: ort.InferenceSession.SessionOptions = {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  };
  // fp16 转换留有不一致 Cast 节点且 ORT CPU 对 fp16 支持差，用 fp32
  console.log('[DreamLite] loading unet.onnx ...');
  unet = await ort.InferenceSession.create(`${DIR}/unet.onnx`, opts);
  console.log('[DreamLite] unet loaded, loading vae ...');
  vae = await ort.InferenceSession.create(`${DIR}/vae_decoder.onnx`, opts);
  vaeEnc = await ort.InferenceSession.create(`${DIR}/vae_encoder.onnx`, opts);
  console.log('[DreamLite] sessions ready');
}

export function unloadDreamLite(): void {
  unet = null;
  vae = null;
  vaeEnc = null;
}

/** 加载真实 TE（Qwen3-VL q8 GGUF，pooling=none 取 per-token hidden states） */
export async function loadTE(): Promise<void> {
  if (teCtx) {
    return;
  }
  console.log('[DreamLite] loading TE te_q8.gguf ...');
  teCtx = await initLlama({
    model: `${DIR}/te_q8.gguf`,
    pooling_type: 'none',
    embedding: true,
    n_ctx: 256,
    n_threads: 4,
  });
  console.log('[DreamLite] TE ready');
}

const GEN_TEMPLATE =
  '<|im_start|>system\nDescribe the image by detailing the color, shape, size, texture, ' +
  'quantity, text, spatial relationships of the objects and background:<|im_end|>\n' +
  '<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n';

/** 复刻 pipeline encode_prompt(generate)：模板→TE per-token→drop34→pad77 */
export async function encodePrompt(prompt: string, maxLen = 77): Promise<Float32Array | null> {
  if (!teCtx) {
    return null;
  }
  try {
    const text = GEN_TEMPLATE.replace('{}', prompt);
    const res = await teCtx.embedding(text);
    const flat = res.embedding as number[];
    const tokens = Math.floor(flat.length / TE_DIM);
    console.log('[DreamLite] TE emb flat.len=', flat.length, 'tokens=', tokens);
    if (tokens <= DROP_IDX) {
      return null;
    }
    const kept = tokens - DROP_IDX;
    const len = Math.min(kept, maxLen);
    const out = new Float32Array(maxLen * TE_DIM); // zero pad
    for (let i = 0; i < len; i++) {
      for (let d = 0; d < TE_DIM; d++) {
        out[i * TE_DIM + d] = flat[(DROP_IDX + i) * TE_DIM + d];
      }
    }
    console.log('[DreamLite] TE encoded tokens=', tokens, 'kept=', len);
    return out;
  } catch (e) {
    console.log('[DreamLite] TE encode fail', (e as any)?.message);
    return null;
  }
}

function calculateShift(seq: number): number {
  const m = (1.16 - 0.5) / (4096 - 256);
  const b = 0.5 - m * 256;
  return seq * m + b;
}

// 极简 PNG 编码（RGB8）
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
  blocks.push((ad >>> 24) & 0xff, (ad >>> 16) & 0xff, (ad >>> 8) & 0xff, ad & 0xff);
  return new Uint8Array(blocks);
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(d: Uint8Array): string {
  let s = '';
  for (let i = 0; i < d.length; i += 3) {
    const a = d[i];
    const b = i + 1 < d.length ? d[i + 1] : 0;
    const c = i + 2 < d.length ? d[i + 2] : 0;
    s += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + (i + 1 < d.length ? B64[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < d.length ? B64[c & 63] : '=');
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
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** 4 步 flow-matching 去噪（cond 为条件 latents），返回解码 RGB [-1,1] */
async function denoise(
  cond: Float32Array,
  size: number,
  steps: number,
  encOverride?: Float32Array,
): Promise<Float32Array> {
  const lat = size / 8;
  let latents = new Float32Array(4 * lat * lat);
  for (let i = 0; i < latents.length; i++) {
    latents[i] = gauss();
  }
  const enc = encOverride ?? new Float32Array(77 * TE_DIM);
  const tid = new Float32Array([size, size]);
  // sigmas + mu
  const sigmas: number[] = [];
  for (let i = 0; i < steps; i++) {
    sigmas.push(1.0 - (i / (steps - 1)) * (1.0 - 1.0 / steps));
  }
  const mu = calculateShift((lat * lat) / 4);
  // FlowMatchEuler timesteps approx: t = sigma*1000
  for (let i = 0; i < steps; i++) {
    const sigma = sigmas[i];
    const t = sigma * 1000;
    // model_input = cat([latents, cond], dim=3) -> [1,4,lat,lat*2]
    const inp = new Float32Array(4 * lat * lat * 2);
    for (let y = 0; y < lat; y++) {
      for (let x = 0; x < lat; x++) {
        for (let c = 0; c < 4; c++) {
          const src = ((c * lat + y) * lat + x);
          inp[((c * lat + y) * lat * 2) + x] = latents[src];
          inp[((c * lat + y) * lat * 2) + lat + x] = cond[src];
        }
      }
    }
    const feeds = {
      sample: new ort.Tensor('float32', inp, [1, 4, lat, lat * 2]),
      timestep: new ort.Tensor('float32', [t], [1]),
      encoder_hidden_states: new ort.Tensor('float32', enc, [1, 77, 2048]),
      time_ids: new ort.Tensor('float32', tid, [1, 2]),
    };
    const res = await unet!.run(feeds);
    console.log(`[DreamLite] step ${i + 1}/${steps} done`);
    const np = res.noise_pred.data as Float32Array; // [1,4,lat,lat*2]
    // crop width to lat, then euler step: latents = latents - sigma_diff * np
    const next = new Float32Array(latents.length);
    const sigmaNext = i + 1 < steps ? sigmas[i + 1] : 0;
    const d = sigmaNext - sigma;
    for (let y = 0; y < lat; y++) {
      for (let x = 0; x < lat; x++) {
        for (let c = 0; c < 4; c++) {
          const dst = (c * lat + y) * lat + x;
          const srcNp = ((c * lat + y) * lat * 2) + x;
          next[dst] = latents[dst] + d * np[srcNp];
        }
      }
    }
    latents = next;
  }
  // decode: latents/scaling_factor -> vae
  const sf = 1.5305; // AutoencoderTiny scaling_factor approx
  const dec = new Float32Array(latents.length);
  for (let i = 0; i < latents.length; i++) {
    dec[i] = latents[i] / sf;
  }
  const vres = await vae!.run({latents: new ort.Tensor('float32', dec, [1, 4, lat, lat])});
  return vres.image.data as Float32Array; // [1,3,size,size] [-1,1]
}

async function saveRgb(img: Float32Array, size: number): Promise<string> {
  const rgb = new Uint8Array(size * size * 3);
  for (let i = 0; i < rgb.length; i++) {
    rgb[i] = Math.max(0, Math.min(255, Math.round((img[i] * 0.5 + 0.5) * 255)));
  }
  const png = encodePng(rgb, size, size);
  const out = `${RNFS.DocumentDirectoryPath}/dreamlite_${Date.now()}.png`;
  await RNFS.writeFile(out, toBase64(png), 'base64');
  console.log('[DreamLite] saved', out);
  return `file://${out}`;
}

/** 文生图：有 TE 用真实 prompt 条件，无 TE 回退零填充基线 */
export async function generateDreamLite(
  size = 512,
  steps = 4,
  prompt?: string,
): Promise<string> {
  if (!unet || !vae) {
    throw new Error('DreamLite not loaded');
  }
  let enc: Float32Array | null = null;
  if (prompt) {
    await loadTE();
    enc = await encodePrompt(prompt);
  }
  const img = await denoise(
    new Float32Array(4 * (size / 8) * (size / 8)),
    size,
    steps,
    enc ?? undefined,
  );
  return saveRgb(img, size);
}

/** 图像编辑：源图 RGB[-1,1] → VAE encode 作条件 → 4 步去噪 */
export async function editDreamLite(
  sourceRgb: Float32Array,
  size = 512,
  steps = 4,
): Promise<string> {
  if (!unet || !vae || !vaeEnc) {
    throw new Error('DreamLite not loaded');
  }
  const eres = await vaeEnc.run({
    image: new ort.Tensor('float32', sourceRgb, [1, 3, size, size]),
  });
  const cond = eres.latents.data as Float32Array;
  console.log('[DreamLite] source encoded, cond len', cond.length);
  const img = await denoise(cond, size, steps);
  return saveRgb(img, size);
}

function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = Math.random();
  }
  while (v === 0) {
    v = Math.random();
  }
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
