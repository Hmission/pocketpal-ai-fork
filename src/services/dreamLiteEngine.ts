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
import {AIOS_ROOT} from '../utils/paths';
import {encodePng, toBase64} from './pngUtil';

const ImageGenNative = NativeModules.ImageGen;

// 与 ModelStore catalog dreamlite 条目同一 AIOS_ROOT 派生（单点路径，防双处硬编码漂移）
const DIR = `${AIOS_ROOT}/dreamlite`;
const TE_DIM = 2048;
const DROP_IDX = 34; // generate 模式截断模板前缀 token 数
// 08-21 编辑链路最佳实践对齐（官方 max_sequence_length=200）：
// generate 200；edit = 64 模板前缀 + 256 视觉 token + ≤200 文本（官方 processor 不截断，端侧文本上限对齐 generate）
const MAX_SEQ_GEN = 200;
const TE_MAX_TOKENS = 200 + DROP_IDX; // generate tokenizer max_length：200+34，超出截断
// 编辑模式 TE 视觉通道（官方 processor 语义）：512² 源图 → patch16 → 32×32 网格 → merge 2×2 → 256 视觉 token
const VIS_GRID = 32;
const N_VIS_TOKENS = VIS_GRID * VIS_GRID / 4;
const IMAGE_PAD_ID = 151655; // <|image_pad|>（Qwen3-VL image_token_index）
const VISION_START_ID = 151652; // <|vision_start|>（诊断用：验证 llama.rn 特殊 token 映射）
// M-RoPE 位置（te_vision_lm.onnx 固定 seq=520，与导出契约一致）：
// 前缀 65（64 + <|vision_start|>1）→ 视觉 256（t=65 恒定；h/w=65+idx//16, 65+idx%16）→ 后缀 81 起；pad 区 1
const VIS_OFFSET = 65;
const TEXT_RESUME = 81;
const LLM_GRID = 16;
const SEQ_EDIT_FIXED = 520;
const VIS_EMB_ROWS = 1024; // 32×32 patch 样本数
const VIS_EMB_FLAT = 3 * 2 * 16 * 16; // [c][t][py][px] 展平（temporal_patch=2，静态图补帧）

let unet: ort.InferenceSession | null = null;
let vae: ort.InferenceSession | null = null;
let vaeEnc: ort.InferenceSession | null = null;
let teCtx: LlamaContext | null = null; // 仅用作 Qwen3 tokenizer
let teOrt: ort.InferenceSession | null = null; // ONNX TE 纯文本（generate，输出 per-token hidden_states）
let teVisVisual: ort.InferenceSession | null = null; // ONNX TE 视觉（edit：pixel_values → image_embeds，fp32 输出）
let teVisLm: ort.InferenceSession | null = null; // ONNX TE 融合 LLM（edit：input_ids+image_embeds → hidden_states，fp32）

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
  const vs = teVisVisual;
  const lm = teVisLm;
  const ctx = teCtx;
  teOrt = null;
  teVisVisual = null;
  teVisLm = null;
  teCtx = null;
  try {
    if (ortS) {
      await ortS.release();
    }
  } catch {
    /* noop */
  }
  try {
    if (vs) {
      await vs.release();
    }
  } catch {
    /* noop */
  }
  try {
    if (lm) {
      await lm.release();
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
    // 08-20 NNAPI 定稿（大王下令，双设备对照实测）：K90（8 Elite）TE 编码 42.1s→25.9s（-38.5%），
    // 全流程 90.7s→64.3s（-29.1%）；小米 13（8 Gen 2）无收益（ORT 自动回退 CPU，无副作用）。
    // 不支持的算子/设备由 ORT 标准机制回退 CPU（EP 声明式优先序，非自写兜底）——单配置保留，非设备分支。
        // 08-21 NNAPI 定稿（大王下令，三设备对照实测）：K90（8 Elite）TE 编码 42.1s→25.9s（-38.5%）收益明确；
    // 小米 13（8 Gen 2）/Mali 平板（天玑 9400+）持平（ORT 自动回退 CPU，无副作用）——单配置保留，非设备分支。
    // 不支持的算子/设备由 ORT 标准机制回退 CPU（EP 声明式优先序，非自写兜底）。
    executionProviders: ['nnapi', 'cpu'],
    enableCpuMemArena: false,
  });
  console.log('[DreamLite] TE fp16 ONNX ready');
}

/** 加载编辑模式双段 TE ONNX（visual + 融合 LLM）：与 teOrt 互斥（两者不同驻，省 ~4GB 峰值）；
 * tokenizer 仍用 te_q8.gguf vocab_only。仅编辑路径调用；generate 路径不动（te_fp16.onnx 纯文本，零回归）。 */
export async function loadTEVision(): Promise<void> {
  if (teVisLm) {
    return;
  }
  if (teOrt) {
    await releaseTE(); // 互斥：先释放纯文本 TE，避免双 session 同驻 OOM
  }
  console.log('[DreamLite] loading TE vision tokenizer (vocab only) ...');
  teCtx = await initLlama({
    model: `${DIR}/te_q8.gguf`,
    vocab_only: true,
    n_ctx: 256,
    n_threads: 4,
  });
  // 双段：visual（pixel_values → image_embeds，fp32 输出）→ 融合 LLM（input_ids + image_embeds → hidden_states）
  // 08-21 真机验证：双段 TE 曾用 nnapi EP，出图与桌面（CPU）完全无关（NNAPI 数值失真）；
  // 桌面同一套 ONNX 三 seed 稳定产出正确编辑——定稿 CPU（编辑链路正确性优先，不做 NNAPI 设备分支）
  teVisVisual = await ort.InferenceSession.create(`${DIR}/te_vision_visual.onnx`, {
    executionProviders: ['cpu'],
    enableCpuMemArena: false,
  });
  teVisLm = await ort.InferenceSession.create(`${DIR}/te_vision_lm.onnx`, {
    executionProviders: ['cpu'],
    enableCpuMemArena: false,
  });
  console.log('[DreamLite] TE vision ONNX ready');
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

// 官方 pipeline_dreamlite_mobile.py prompt_template_encode_edit（含 <|vision_start|> 占位语义，逐字复刻）：
// 前缀 = system 描述 + user 开始 + <|vision_start|>（桌面实测 64 token，与官方 edit_start_idx=64 对齐）；
// 中间 = 256 个 <|image_pad|>（视觉 token 位置，hidden 由 ViT 提供）；后缀 = 指令 + 收尾。
const EDIT_TEMPLATE_PRE =
  '<|im_start|>system\nDescribe the key features of the input image (color, shape, size, ' +
  "texture, objects, background), then explain how the user's text instruction should alter " +
  "or modify the image. Generate a new image that meets the user's requirements while maintaining " +
  'consistency with the original input where appropriate.<|im_end|>\n<|im_start|>user\n' +
  '<|vision_start|>';
const EDIT_TEMPLATE_SUF =
  '<|vision_end|>\n{}<|im_end|>\n<|im_start|>assistant\n';
const EDIT_DROP_IDX = 64;

/** 复刻 pipeline encode_prompt：官方模板 + "[Generate]: "/"[Edit]: " 前缀 → TE per-token → drop 前缀 → pad。
 * edit 模式走双段 teVision（visual + 融合 LLM）：pixelValues 为 512² 源图 [-1,1]（与官方归一化等价），
 * input_ids 中 256 个 <|image_pad|> 的 hidden 由 ViT 提供 → prompt_embeds 含视觉 token（官方语义）。 */
export async function encodePrompt(
  prompt: string,
  maxLen = MAX_SEQ_GEN,
  mode: 'generate' | 'edit' = 'generate',
  pixelValues?: Float32Array,
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
    let ids: number[];
    let real = 0;
    if (mode === 'edit') {
      // 逐字复刻官方模板：前缀(含 <|vision_start|>) + 256×image_pad + 后缀(指令)；
      // 固定 seq=520（te_vision_lm.onnx 导出契约）：指令不足时 pad 0（mask=0 遮住）
      const preIds = await tokenizeIds(EDIT_TEMPLATE_PRE);
      const sufIds = await tokenizeIds(EDIT_TEMPLATE_SUF.replace('{}', inner));
      const textCap = SEQ_EDIT_FIXED - preIds.length - N_VIS_TOKENS;
      const body = [...preIds, ...Array(N_VIS_TOKENS).fill(IMAGE_PAD_ID), ...sufIds.slice(0, textCap)];
      real = body.length;
      // 08-21 诊断：llama.rn tokenize 对 Qwen3-VL 特殊 token（<|vision_start|>/<|image_pad|>）的映射验证
      console.log(
        '[DreamLite] edit tokenize preLen=',
        preIds.length,
        'sufLen=',
        sufIds.length,
        'hasVisStart=',
        preIds.includes(VISION_START_ID),
        'padCnt=',
        body.filter(v => v === IMAGE_PAD_ID).length,
        'real=',
        real,
      );
      ids = body.slice(0, SEQ_EDIT_FIXED).concat(Array(Math.max(0, SEQ_EDIT_FIXED - body.length)).fill(0));
    } else {
      const text = GEN_TEMPLATE.replace('{}', inner);
      const tk = await teCtx!.tokenize(text);
      // 官方 tokenizer: max_length=200+34, truncation → 截断到前 234 token
      ids = ((tk as any).tokens ?? (tk as any)).slice(0, TE_MAX_TOKENS);
      real = ids.length; // generate 无 pad：全部为真实 token（mask 边界 real-dropIdx 依赖此值）
    }
    const seq = ids.length;
    if (seq <= dropIdx) {
      return null;
    }
    const ids64 = ids.map(v => BigInt(v));
    const mask64 = ids.map((_, i) => BigInt(mode === 'edit' && i >= real ? 0 : 1));
    let hs: Float32Array;
    if (mode === 'edit') {
      if (!teVisVisual || !teVisLm) {
        return null;
      }
      if (!pixelValues || pixelValues.length !== 3 * 512 * 512) {
        return null; // 视觉条件缺失：显式失败（上层报错），不做纯文本降级
      }
      // 视觉段：512² [-1,1] → [1024,1536] patch 数组（官方 processor 契约）→ te_vision_visual.onnx
      const pv = buildPixelValues(pixelValues);
      const visRes: any = await teVisVisual.run({
        pixel_values: new ort.Tensor('float32', pv, [VIS_EMB_ROWS, VIS_EMB_FLAT]),
        image_grid_thw: new ort.Tensor('int64', [1, VIS_GRID, VIS_GRID] as any, [1, 3]),
      });
      const imageEmbeds = visRes.image_embeds.data as Float32Array; // [256,2048] fp32
      // 融合 LLM：M-RoPE 位置端侧构造（官方 get_rope_index 单图解析式）
      const posIds = buildPositionIds(real);
      const res: any = await teVisLm.run({
        input_ids: new ort.Tensor('int64', ids64 as any, [1, seq]),
        attention_mask: new ort.Tensor('int64', mask64 as any, [1, seq]),
        image_embeds: new ort.Tensor('float32', imageEmbeds, [N_VIS_TOKENS, TE_DIM]),
        image_grid_thw: new ort.Tensor('int64', [1, VIS_GRID, VIS_GRID] as any, [1, 3]),
        position_ids: new ort.Tensor('int64', posIds as any, [3, 1, seq]),
      });
      hs = res.hidden_states.data as Float32Array; // [1,seq,2048]，含视觉 token
    } else {
      if (!teOrt) {
        return null;
      }
      const res: any = await teOrt.run({
        input_ids: new ort.Tensor('int64', ids64 as any, [1, seq]),
        attention_mask: new ort.Tensor('int64', mask64 as any, [1, seq]),
      });
      hs = res.hidden_states.data as Float32Array; // [1,seq,2048]
    }
    const kept = seq - dropIdx;
    // 08-21 修复：mask/enc 边界用真实 token 数（real-dropIdx），对齐官方 prompt_embeds_mask
    // （官方 _extract_masked_hidden 先按 attention_mask 提取真实 token 再 drop，pad 区不参与注意力）。
    // 旧实现用 kept（含 LM 输出的 pad 区 hidden 161 行）→ 注意力被无效 token 污染 → 编辑条件失真
    const realKept = Math.max(0, real - dropIdx);
    const len = Math.min(realKept, maxLen);
    const out = new Float32Array(maxLen * TE_DIM); // zero pad
    const mask = new Float32Array(maxLen); // 1=真实 token, 0=pad
    for (let i = 0; i < len; i++) {
      mask[i] = 1;
      for (let d = 0; d < TE_DIM; d++) {
        out[i * TE_DIM + d] = hs[(dropIdx + i) * TE_DIM + d];
      }
    }
    console.log(
      '[DreamLite] TE encoded seq=',
      seq,
      'kept=',
      len,
      'mode=',
      mode,
      'vis=',
      mode === 'edit' ? N_VIS_TOKENS : 0,
    );
    return {enc: out, mask};
  } catch (e) {
    console.log('[DreamLite] TE encode fail', (e as any)?.message);
    return null;
  }
}

/** llama.rn tokenize → id 数组（特殊 token 如 <|im_start|>/<|vision_start|> 映射为词表 id） */
async function tokenizeIds(text: string): Promise<number[]> {
  const tk = await teCtx!.tokenize(text);
  return (tk as any).tokens ?? (tk as any);
}

/** 512² 源图 [-1,1]（NCHW 三平面展平）→ 官方 pixel_values 契约 [1024,1536]：
 * 每样本 = 一个 16×16 patch × [c][t][py][px]（temporal_patch=2 静态图补帧复制，官方 _preprocess 语义）。 */
function buildPixelValues(visRgb: Float32Array): Float32Array {
  const out = new Float32Array(VIS_EMB_ROWS * VIS_EMB_FLAT);
  const side = 512;
  for (let gh = 0; gh < VIS_GRID; gh++) {
    for (let gw = 0; gw < VIS_GRID; gw++) {
      const s = gh * VIS_GRID + gw;
      let off = s * VIS_EMB_FLAT;
      for (let c = 0; c < 3; c++) {
        const plane = c * side * side;
        for (let py = 0; py < 16; py++) {
          const row = plane + (gh * 16 + py) * side + gw * 16;
          for (let px = 0; px < 16; px++) {
            const v = visRgb[row + px];
            // [c][t=0/1][py][px]：两帧相同
            out[off + c * 512 + py * 16 + px] = v;
            out[off + c * 512 + 256 + py * 16 + px] = v;
          }
        }
      }
    }
  }
  return out;
}

/** M-RoPE 位置 [3,1,520]（te_vision_lm.onnx 固定 seq，与官方 get_rope_index 单图解析式一致，
 * 桌面已逐值验证）：前缀 0..64 三轴；视觉 65..320（t=65；h=65+idx//16；w=65+idx%16）；
 * 后缀 81.. 递增；pad 区（≥real）保持 1。 */
function buildPositionIds(real: number): number[] {
  const seq = SEQ_EDIT_FIXED;
  const pos = new Array<number>(3 * seq).fill(1); // 初始 1（官方 mask=0 位置语义）
  const setRow = (row: number, i: number, v: number) => {
    pos[row * seq + i] = v;
  };
  for (let i = 0; i < Math.min(65, seq); i++) {
    setRow(0, i, i);
    setRow(1, i, i);
    setRow(2, i, i);
  }
  const visEnd = Math.min(65 + N_VIS_TOKENS, seq);
  for (let i = 65; i < visEnd; i++) {
    const k = i - 65;
    setRow(0, i, VIS_OFFSET);
    setRow(1, i, VIS_OFFSET + Math.floor(k / LLM_GRID));
    setRow(2, i, VIS_OFFSET + (k % LLM_GRID));
  }
  for (let i = visEnd; i < seq; i++) {
    const v = TEXT_RESUME + (i - visEnd);
    setRow(0, i, v);
    setRow(1, i, v);
    setRow(2, i, v);
  }
  if (real < seq) {
    for (let i = real; i < seq; i++) {
      setRow(0, i, 1);
      setRow(1, i, 1);
      setRow(2, i, 1);
    }
  }
  return pos;
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
  // 序列长度跟随条件实际长度（generate 200 / edit 520），非固定 128
  const seqLen = encOverride ? encOverride.length / TE_DIM : MAX_SEQ_GEN;
  const enc = encOverride ?? new Float32Array(seqLen * TE_DIM);
  const mask = maskOverride ?? new Float32Array(seqLen);
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
        seqLen,
        TE_DIM,
      ]),
      encoder_attention_mask: new ort.Tensor('int64', mask64 as any, [
        1,
        seqLen,
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
  // B28：输出统一到 aios_images/（与 SD 生成/放大同目录，路径单一事实源）
  const out = `${RNFS.DocumentDirectoryPath}/aios_images/dreamlite_${Date.now()}.png`;
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

/** 图像编辑：源图 RGB[-1,1] → VAE encode 作条件 → 4 步去噪（官方 edit 语义）。
 * visRgb 为 512² 源图 [-1,1]（TE 视觉通道输入，与 cond 双解码同源）；
 * prompt 为编辑指令（官方 diptych 语义文本条件，配合视觉 token 才是完整条件）；
 * 无 visRgb / 无 prompt / TE 编码失败均显式报错（不降级，链路保持官方语义）。
 * 经 genQueue 串行化（与文生图互斥，TE 生命周期不踩踏）。 */
export function editDreamLite(
  sourceRgb: Float32Array,
  width = 1024,
  height = 1024,
  steps = 4,
  onStep?: (step: number, steps: number) => void,
  prompt?: string,
  visRgb?: Float32Array,
): Promise<string> {
  return enqueueGen(async () => {
    if (!unet || !vae || !vaeEnc) {
      throw new Error('DreamLite not loaded');
    }
    if (!visRgb || visRgb.length !== 3 * 512 * 512) {
      throw new Error('编辑缺少 512² 视觉条件（visRgb）');
    }
    const eres = await vaeEnc.run({
      image: new ort.Tensor('float32', sourceRgb, [1, 3, height, width]),
    });
    const cond = eres.latents.data as Float32Array;
    console.log('[DreamLite] source encoded, cond len', cond.length);
    // 编辑文本条件：全模型 TE（ViT 视觉 token + diptych 指令，drop 64）；编码完即释放 TE
    if (!prompt || !prompt.trim()) {
      throw new Error('编辑缺少指令（prompt）');
    }
    await loadTEVision();
    const r = await encodePrompt(prompt.trim(), SEQ_EDIT_FIXED, 'edit', visRgb);
    await releaseTE();
    if (!r) {
      throw new Error('TE 编码失败，未生成图片，请重试');
    }
    const img = await denoise(cond, width, height, steps, r.enc, onStep, r.mask);
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
