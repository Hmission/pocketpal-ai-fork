/**
 * dreamLiteEngine — DreamLite 端侧 ONNX Runtime 引擎（P6-5）
 *
 * 严格镜像 scripts/aios/dreamlite_infer_ref.py 的 forward 契约：
 *  - model_input = cat([latents, cond], dim=3)（宽翻倍）
 *  - added_cond_kwargs = {time_ids:[[w,h]]}
 *  - noise_pred 截宽
 *  - FlowMatchEuler + mu=calculate_shift
 *  - latents/scaling_factor + shift_factor -> vae_decoder
 * 对齐官方 DreamLiteMobilePipeline（diffusers 0.39）：prompt 加 "[Generate]: " 任务前缀；
 * 模板前缀 drop 34 token；max_sequence_length=200（tokenize 后截断到 200+34）。
 */
import * as ort from 'onnxruntime-react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {NativeModules} from 'react-native';
import {initLlama, LlamaContext} from 'llama.rn';
import {encodePng, toBase64} from './pngUtil';

const ImageGenNative = NativeModules.ImageGen;

const DIR = '/sdcard/Documents/AIOS/dreamlite';
const TE_DIM = 2048;
const DROP_IDX = 34; // generate 模式截断模板前缀 token 数
const MAX_SEQ = 128; // UNet 条件序列上限（官方 max_sequence_length=200，端侧折中 128）
const TE_MAX_TOKENS = 200 + DROP_IDX; // 官方 tokenizer max_length：200+34，超出截断

let unet: ort.InferenceSession | null = null;
let vae: ort.InferenceSession | null = null;
let vaeEnc: ort.InferenceSession | null = null;
let teCtx: LlamaContext | null = null; // 仅用作 Qwen3 tokenizer
let teOrt: ort.InferenceSession | null = null; // ONNX TE（输出 per-token hidden_states）

export const dreamLiteReady = () => !!unet && !!vae;

export async function loadDreamLite(): Promise<void> {
  if (unet && vae) {
    return;
  }
  // enableCpuMemArena:false —— ORT 默认 arena 会跨 run 保留峰值内存不归还（连续抽卡 swap 叠加到 9.4GB 被 LMK 杀的主因），
  // 关闭后临时张量用完即归还；1024² 4 步推理 ~24s/步，malloc/free 开销可忽略。
  const opts: ort.InferenceSession.SessionOptions = {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    enableCpuMemArena: false,
  };
  // unet 单路径 fp32（ORT CPU 模拟 fp16 计算慢 ~50%，速度优先）；
  // 不设 fp16 降级分支：fp32 已真机稳定验证，单文件单路径（产品哲学：不兜底不补丁）
  console.log('[DreamLite] loading unet (fp32) ...');
  unet = await ort.InferenceSession.create(`${DIR}/unet_masked.onnx`, opts);
  console.log('[DreamLite] unet loaded, loading vae ...');
  vae = await ort.InferenceSession.create(`${DIR}/vae_decoder.onnx`, opts);
  vaeEnc = await ort.InferenceSession.create(`${DIR}/vae_encoder.onnx`, opts);
  console.log('[DreamLite] sessions ready');
}

export async function unloadDreamLite(): Promise<void> {
  const u = unet;
  const v = vae;
  const ve = vaeEnc;
  unet = null;
  vae = null;
  vaeEnc = null;
  const rel = (s: ort.InferenceSession | null) =>
    s ? s.release().catch(() => {}) : Promise.resolve();
  await Promise.all([rel(u), rel(v), rel(ve)]);
  await releaseTE();
}

/** 释放 TE（ORT+llama tokenizer），用于编码后降内存峰值。
 * 注意：InferenceSession.release() 与 LlamaContext.release() 均为异步，
 * 必须 await 等待 native 真正归还内存；不 await 会导致连续抽卡时旧 session 未释放即叠加新 session → OOM 闪退。 */
export async function releaseTE(): Promise<void> {
  const ortS = teOrt;
  const ctx = teCtx;
  teOrt = null;
  teCtx = null;
  try {
    if (ortS) {
      await ortS.release();
    }
  } catch {
    /* noop */
  }
  try {
    if (ctx) {
      await ctx.release();
    }
  } catch {
    /* noop */
  }
}

/** 加载真实 TE：fp16 ONNX（per-token hidden_states，输出 Cast fp32；桌面实测与 transformers FP32 逐 token cos=1.0）。
 * 旧 te_int8.onnx 因 per-tensor 动态激活量化毁坏 Qwen3 离群通道（kept 区 cos 0.17-0.56 → 糊图）弃用；
 * 不做静默降级：fp16 加载失败直接报错（产品哲学：不兜底不补丁）。tokenizer 仍用 llama.rn 加载 te_q8.gguf。 */
export async function loadTE(): Promise<void> {
  if (teCtx && teOrt) {
    return;
  }
  // vocab_only:true —— 只加载词表、跳过 1.83GB 权重张量（tokenizer 不需要权重），内存从 GB 级降到几十 MB，加载秒级
  console.log('[DreamLite] loading TE tokenizer (vocab only) ...');
  teCtx = await initLlama({
    model: `${DIR}/te_q8.gguf`,
    vocab_only: true,
    n_ctx: 256,
    n_threads: 4,
  });
  teOrt = await ort.InferenceSession.create(`${DIR}/te_fp16.onnx`, {
    executionProviders: ['cpu'],
    enableCpuMemArena: false,
  });
  console.log('[DreamLite] TE fp16 ONNX ready');
}

// flow-matching 动态位移（对齐官方 scheduler.set_timesteps(mu)）
// 参考 dreamlite_infer_ref.py：mu = calculate_shift(lat*lat//4)，1024² → seq=4096 → mu=1.16
// 桌面 A/B：与 diffusers FlowMatchEulerDiscreteScheduler 逐值一致（max diff 6e-8）
function shiftedSigmas(steps: number, latArea: number): number[] {
  // 注意：seq = 面积/4，勿再平方（旧实现 seq=(area²)/4 → mu 溢出 → exp=Inf → NaN → 纯黑）
  const mu = calculateShift(latArea / 4);
  const em = Math.exp(mu);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = 1 - (i / (steps - 1)) * (1 - 1 / steps);
    out.push(em / (em + (1 / t - 1)));
  }
  return out;
}

const GEN_TEMPLATE =
  '<|im_start|>system\nDescribe the image by detailing the color, shape, size, texture, ' +
  'quantity, text, spatial relationships of the objects and background:<|im_end|>\n' +
  '<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n';

// 生成串行队列（2026-08 糊图根因修复）：并发触发（连点/双发/再来一张抢跑）时
// 排队执行——DreamLite 的 TE 是「加载→编码→即释放」结构，两次生成并发会互相
// 踩踏（后发者拿到已释放/未就绪的 TE → 编码静默失败 → 零条件去噪 = 纯色糊图）。
// 队列保证同一时刻只有一次生成在跑，TE 生命周期严格串行。
let genQueue: Promise<unknown> = Promise.resolve();
function enqueueGen<T>(fn: () => Promise<T>): Promise<T> {
  const run = genQueue.then(fn, fn);
  genQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// 官方 pipeline_dreamlite_mobile.py prompt_template_encode_edit（纯文本近似：去 vision 占位 token，
// 桌面实测模板前缀恰好 64 token，与官方 edit_start_idx=64 对齐）
const EDIT_TEMPLATE =
  '<|im_start|>system\nDescribe the key features of the input image (color, shape, size, ' +
  "texture, objects, background), then explain how the user's text instruction should alter " +
  "or modify the image. Generate a new image that meets the user's requirements while maintaining " +
  'consistency with the original input where appropriate.<|im_end|>\n<|im_start|>user\n' +
  '{}<|im_end|>\n<|im_start|>assistant\n';
const EDIT_DROP_IDX = 64;

/** 复刻 pipeline encode_prompt：官方模板 + "[Generate]: "/"[Edit]: " 前缀 → TE per-token → drop 前缀 → pad */
export async function encodePrompt(
  prompt: string,
  maxLen = MAX_SEQ,
  mode: 'generate' | 'edit' = 'generate',
): Promise<{enc: Float32Array; mask: Float32Array} | null> {
  if (!teCtx) {
    return null;
  }
  try {
    const dropIdx = mode === 'edit' ? EDIT_DROP_IDX : DROP_IDX;
    // 官方 generate：prompt_str = f"[Generate]: {prompt}"；edit：diptych 双联画语义（左=编辑结果，右=原图）
    const inner =
      mode === 'edit'
        ? `[Edit]: A diptych with two side-by-side images of the same scene. Compared to the right side, the left one has ${prompt}`
        : `[Generate]: ${prompt}`;
    const tpl = mode === 'edit' ? EDIT_TEMPLATE : GEN_TEMPLATE;
    const text = tpl.replace('{}', inner);
    const tk = await teCtx!.tokenize(text);
    const ids: number[] = (tk as any).tokens ?? (tk as any);
    // 官方 tokenizer: max_length=200+34, truncation → 截断到前 234 token
    const trimmed = ids.slice(0, TE_MAX_TOKENS);
    const seq = trimmed.length;
    if (seq <= dropIdx || !teOrt) {
      return null;
    }
    const ids64 = trimmed.map(v => BigInt(v));
    const mask64 = trimmed.map(() => BigInt(1));
    const res: any = await teOrt.run({
      input_ids: new ort.Tensor('int64', ids64 as any, [1, seq]),
      attention_mask: new ort.Tensor('int64', mask64 as any, [1, seq]),
    });
    const hs = res.hidden_states.data as Float32Array; // [1,seq,2048]
    const kept = seq - dropIdx;
    const len = Math.min(kept, maxLen);
    const out = new Float32Array(maxLen * TE_DIM); // zero pad
    const mask = new Float32Array(maxLen); // 1=真实 token, 0=pad
    for (let i = 0; i < len; i++) {
      mask[i] = 1;
      for (let d = 0; d < TE_DIM; d++) {
        out[i * TE_DIM + d] = hs[(dropIdx + i) * TE_DIM + d];
      }
    }
    console.log(
      '[DreamLite] TE(ORT) encoded seq=',
      seq,
      'kept=',
      len,
      'mode=',
      mode,
    );
    return {enc: out, mask};
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

// PNG 编码工具已抽取至 ./pngUtil（encodePng/toBase64），生图与超分引擎共享

/** 4 步 flow-matching 去噪（cond 为条件 latents），返回解码 RGB [-1,1] */
async function denoise(
  cond: Float32Array,
  width: number,
  height: number,
  steps: number,
  encOverride?: Float32Array,
  onStep?: (step: number, steps: number) => void,
  maskOverride?: Float32Array,
): Promise<Float32Array> {
  const latW = width / 8;
  const latH = height / 8;
  let latents = new Float32Array(4 * latH * latW);
  for (let i = 0; i < latents.length; i++) {
    latents[i] = gauss();
  }
  const enc = encOverride ?? new Float32Array(MAX_SEQ * TE_DIM);
  const mask = maskOverride ?? new Float32Array(MAX_SEQ);
  const tid = new Float32Array([width, height]);
  // 对齐官方：mu-shifted sigmas
  const sigmas = shiftedSigmas(steps, latH * latW);
  const mask64 = Array.from(mask).map(v => BigInt(v));
  for (let i = 0; i < steps; i++) {
    const sigma = sigmas[i];
    const t = sigma * 1000;
    // model_input = cat([latents, cond], dim=3) -> [1,4,latH,latW*2]
    const inp = new Float32Array(4 * latH * latW * 2);
    for (let y = 0; y < latH; y++) {
      for (let x = 0; x < latW; x++) {
        for (let c = 0; c < 4; c++) {
          const src = (c * latH + y) * latW + x;
          inp[(c * latH + y) * latW * 2 + x] = latents[src];
          inp[(c * latH + y) * latW * 2 + latW + x] = cond[src];
        }
      }
    }
    const feeds = {
      sample: new ort.Tensor('float32', inp, [1, 4, latH, latW * 2]),
      timestep: new ort.Tensor('float32', [t], [1]),
      encoder_hidden_states: new ort.Tensor('float32', enc, [
        1,
        MAX_SEQ,
        TE_DIM,
      ]),
      encoder_attention_mask: new ort.Tensor('int64', mask64 as any, [
        1,
        MAX_SEQ,
      ]),
      time_ids: new ort.Tensor('float32', tid, [1, 2]),
    };
    const res = await unet!.run(feeds);
    console.log(`[DreamLite] step ${i + 1}/${steps} done`);
    onStep?.(i + 1, steps);
    const np = res.noise_pred.data as Float32Array; // [1,4,latH,latW*2]
    const next = new Float32Array(latents.length);
    const sigmaNext = i + 1 < steps ? sigmas[i + 1] : 0;
    const d = sigmaNext - sigma;
    for (let y = 0; y < latH; y++) {
      for (let x = 0; x < latW; x++) {
        for (let c = 0; c < 4; c++) {
          const dst = (c * latH + y) * latW + x;
          const srcNp = (c * latH + y) * latW * 2 + x;
          next[dst] = latents[dst] + d * np[srcNp];
        }
      }
    }
    latents = next;
  }
  // decode: latents/scaling_factor + shift_factor -> vae（ckpt/vae/config.json：scaling_factor=1.0，shift_factor=0.0）
  const sf = 1.0;
  const dec = new Float32Array(latents.length);
  for (let i = 0; i < latents.length; i++) {
    dec[i] = latents[i] / sf;
  }
  const vres = await vae!.run({
    latents: new ort.Tensor('float32', dec, [1, 4, latH, latW]),
  });
  return vres.image.data as Float32Array; // [1,3,height,width] [-1,1]
}

async function saveRgb(
  img: Float32Array,
  width: number,
  height: number,
): Promise<string> {
  // VAE ONNX 输出为 NCHW [1,3,H,W]，需转 HWC(RGB 交错)，否则灰图/9宫格
  const hw = width * height;
  const to8 = (v: number) =>
    Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)));
  const rgb = new Uint8Array(hw * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      rgb[p * 3] = to8(img[p]);
      rgb[p * 3 + 1] = to8(img[hw + p]);
      rgb[p * 3 + 2] = to8(img[2 * hw + p]);
    }
  }
  const png = encodePng(rgb, width, height);
  const out = `${RNFS.DocumentDirectoryPath}/dreamlite_${Date.now()}.png`;
  await RNFS.writeFile(out, toBase64(png), 'base64');
  console.log('[DreamLite] saved', out);
  return `file://${out}`;
}

/** 文生图：有 TE 用真实 prompt 条件；TE 编码失败显式报错（不静默降级零条件=糊图）。
 * 整个流程（TE 加载→编码→释放→去噪→保存）经 genQueue 串行化。 */
export function generateDreamLite(
  width = 1024,
  height = 1024,
  steps = 4,
  prompt?: string,
  onStep?: (step: number, steps: number) => void,
): Promise<string> {
  return enqueueGen(async () => {
    if (!unet || !vae) {
      throw new Error('DreamLite not loaded');
    }
    let enc: Float32Array | null = null;
    let mask: Float32Array | null = null;
    if (prompt) {
      await loadTE();
      const r = await encodePrompt(prompt);
      await releaseTE(); // 编码完即释放 TE（await 等待 native 归还内存），降低与 UNet 同驻的内存峰值
      if (!r) {
        // 锋利：TE 编码失败不做零条件降级（输出=纯色糊图），显式失败让上层出错误卡
        throw new Error('TE 编码失败，未生成图片，请重试');
      }
      enc = r.enc;
      mask = r.mask;
    }
    const img = await denoise(
      new Float32Array(4 * (height / 8) * (width / 8)),
      width,
      height,
      steps,
      enc ?? undefined,
      onStep,
      mask ?? undefined,
    );
    return saveRgb(img, width, height);
  });
}

/** 原生解码上传图片→归一化 RGB（按较大边压缩到 size） */
export async function decodeImageToRgb(
  path: string,
  size: number,
): Promise<Float32Array> {
  const arr = await ImageGenNative.decodeImageToRgb(path, size);
  const f = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    f[i] = arr[i];
  }
  return f;
}

/** 图像编辑：源图 RGB[-1,1] → VAE encode 作条件 → 4 步去噪。
 * prompt 为编辑指令（官方 diptych 语义），可选；无 prompt 时退化为纯图像条件重绘。
 * 经 genQueue 串行化（与文生图互斥，TE 生命周期不踩踏）。 */
export function editDreamLite(
  sourceRgb: Float32Array,
  width = 1024,
  height = 1024,
  steps = 4,
  onStep?: (step: number, steps: number) => void,
  prompt?: string,
): Promise<string> {
  return enqueueGen(async () => {
    if (!unet || !vae || !vaeEnc) {
      throw new Error('DreamLite not loaded');
    }
    const eres = await vaeEnc.run({
      image: new ort.Tensor('float32', sourceRgb, [1, 3, height, width]),
    });
    const cond = eres.latents.data as Float32Array;
    console.log('[DreamLite] source encoded, cond len', cond.length);
    // 编辑文本条件（官方 [Edit]: diptych 模板，drop 64）；编码完即释放 TE
    let enc: Float32Array | undefined;
    let mask: Float32Array | undefined;
    if (prompt && prompt.trim()) {
      await loadTE();
      const r = await encodePrompt(prompt.trim(), MAX_SEQ, 'edit');
      await releaseTE();
      if (!r) {
        throw new Error('TE 编码失败，未生成图片，请重试');
      }
      enc = r.enc;
      mask = r.mask;
    }
    const img = await denoise(cond, width, height, steps, enc, onStep, mask);
    return saveRgb(img, width, height);
  });
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
