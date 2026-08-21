/* eslint-disable no-bitwise */ // 字节操作（下采样/编码）为领域必需位运算
/**
 * superResEngine — tiled RealESRGAN 通用图像放大引擎（P6-6）
 *
 * 独立通用能力（不绑定 DreamLite）：任意图片（生成图/上传图/相册照片）2×/4× 放大。
 * 契约（scripts/aios/export_realesrgan_onnx.py 验证）：
 *  - 输入 [1,3,H,W] float32 归一化 0-1（img/255）
 *  - 输出 [1,3,H*4,W*4] float32，RRDBNet 输出可轻微越界（实测约 [-0.1,1.1]）→ 必须 clamp 0-1
 * 模型：general=x4plus（RRDBNet-23）/ anime=x4plus_anime_6B（RRDBNet-6 高清）/ anime_fast=animevideov3
 * （SRVGGNetCompact 快速）——2026-08-21 大王定夺双模型可选：动漫高清 vs 动漫快速（快约 4 倍）
 * 内存纪律：tiled 分块（256 输入 → 1024 输出）+ uint8 输出缓冲，峰值 ~80MB；
 * 放大前需由上层释放 DreamLite/SD 引擎（store 层互斥），本引擎不感知其他引擎。
 */
import * as ort from 'onnxruntime-react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {NativeModules} from 'react-native';
import {encodePng, toBase64, base64ToBytes} from './pngUtil';

const ImageGen = NativeModules.ImageGen;

/** 放大风格：通用写实 / 动漫高清（RRDBNet-6 图片级）/ 动漫快速（SRVGGNetCompact 视频级） */
export type SRStyle = 'general' | 'anime' | 'anime_fast';

const SR_DIR = `${RNFS.DocumentDirectoryPath}/esrgan`;
const TILE = 256; // 输入 tile 尺寸（4× 后 1024）
const OVERLAP = 16; // 输入重叠像素（输出羽化带 64px）
const INPUT_MAX = 1024; // 解码输入长边上限（保证 4× 中间缓冲 ≤4096，防 OOM）
const OUT_OV = OVERLAP * 4;

let srSession: ort.InferenceSession | null = null;
let srStyle: SRStyle | null = null;

const FILES: Record<SRStyle, string> = {
  general: 'realesrgan_x4plus.onnx',
  anime: 'realesrgan_x4plus_anime_6B.onnx',
  anime_fast: 'realesr_animevideov3.onnx',
};

export function superResReady(): boolean {
  return !!srSession;
}

/** 从 assets 复制内置模型到可读写目录（首次使用；版本标记避免重复复制） */
export async function ensureSuperResModels(): Promise<void> {
  const marker = `${SR_DIR}/.v4`; // v4：anime_fast（animevideov3）随双模型可选回归（.v3 装机设备无此文件，须强制重复制）
  try {
    await RNFS.stat(marker);
    return;
  } catch {
    /* 未复制 → 继续 */
  }
  await RNFS.mkdir(SR_DIR);
  for (const f of Object.values(FILES)) {
    await RNFS.copyFileAssets(`esrgan/${f}`, `${SR_DIR}/${f}`);
  }
  await RNFS.writeFile(marker, '1', 'utf8');
}

/** 加载超分模型（同风格已驻留则复用；换风格先释放再加载） */
export async function loadSuperRes(style: SRStyle): Promise<void> {
  if (srSession && srStyle === style) {
    return;
  }
  await unloadSuperRes();
  await ensureSuperResModels();
  const file = FILES[style];
  console.log(`[SuperRes] loading ${file} ...`);
  srSession = await ort.InferenceSession.create(`${SR_DIR}/${file}`, {
    // 08-21 NNAPI 定稿（大王确认 A'，对齐 DreamLite TE 先例）：conv 密集负载，K90（8 Elite）
    // 预期收益（TE 实测 -38.5%）；其余设备 ORT 标准回退 CPU 无副作用——单配置非设备分支。
    // 动态 shape（tile 边缘尺寸非 256）若致 NNAPI 分区失败，由 ORT 回退机制整体走 CPU。
    executionProviders: ['nnapi', 'cpu'],
    graphOptimizationLevel: 'all',
    enableCpuMemArena: false,
  });
  srStyle = style;
  console.log('[SuperRes] session ready');
}

/** 释放超分模型（await 等 native 归还内存，避免叠加 OOM） */
export async function unloadSuperRes(): Promise<void> {
  const s = srSession;
  srSession = null;
  srStyle = null;
  if (s) {
    try {
      await s.release();
    } catch {
      /* noop */
    }
  }
}

/** 原生解码输入图（保持宽高比，较大边 ≤ maxSize）→ {rgb HWC 0-1, w, h} */
async function decodeInput(
  path: string,
  maxSize: number,
): Promise<{rgb: Float32Array; w: number; h: number}> {
  const res = await ImageGen.decodeImageForUpscale(path, maxSize);
  const w = res.width as number;
  const h = res.height as number;
  // 原生返回 base64 RGB 字节（装箱数组过桥 3.1M 元素峰值 ~150MB 有 OOM 风险）；
  // 纯 JS 解码（Hermes atob 二进制字符串语义不可控——真机曾出极暗图，弃用）
  const raw = base64ToBytes(res.rgb as string);
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < raw.length; i++) {
    rgb[i] = raw[i] / 255.0;
  }
  console.log(
    `[SuperRes] decoded ${w}x${h} bytes=${raw.length} first=${Array.from(
      raw.slice(0, 6),
    ).join(',')}`,
  );
  return {rgb, w, h};
}

const to8 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));

/**
 * 写回 tile 输出（羽化防接缝）：
 * 遍历顺序从左到右、从上到下 → 仅「左带/上带」与已写像素混合（后写者降权），
 * 右带/下带直接覆盖（由后续 tile 的对应带处理），保证重叠区线性过渡无暗缝。
 */
function blit(
  buf: Uint8Array,
  f: Float32Array,
  outW: number,
  outH: number,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
): void {
  for (let y = 0; y < oh; y++) {
    const gy = oy + y;
    if (gy >= outH) {
      break;
    }
    const wy = y < OUT_OV && oy > 0 ? y / OUT_OV : 1;
    for (let x = 0; x < ow; x++) {
      const gx = ox + x;
      if (gx >= outW) {
        break;
      }
      const wx = x < OUT_OV && ox > 0 ? x / OUT_OV : 1;
      const a = wx * wy;
      // ORT 输出为 NCHW [1,3,oh,ow]：按通道平面读（交错读会把 channel0 平面
      // 误当 RGB 交错 → 三通道取自相近位置 → 灰色图——2026-08-19 真机实锤）
      const plane = ow * oh;
      const p = y * ow + x;
      const r = f[p];
      const g = f[plane + p];
      const b = f[2 * plane + p];
      const di = (gy * outW + gx) * 3;
      if (a >= 1) {
        buf[di] = to8(r);
        buf[di + 1] = to8(g);
        buf[di + 2] = to8(b);
      } else {
        buf[di] = buf[di] * (1 - a) + to8(r) * a;
        buf[di + 1] = buf[di + 1] * (1 - a) + to8(g) * a;
        buf[di + 2] = buf[di + 2] * (1 - a) + to8(b) * a;
      }
    }
  }
}

/** 2× 下采样（4× 结果 box 平均 → 半尺寸），2× 档用 */
function downsample2(src: Uint8Array, w: number, h: number): Uint8Array {
  const dw = Math.floor(w / 2);
  const dh = Math.floor(h / 2);
  const dst = new Uint8Array(dw * dh * 3);
  for (let y = 0; y < dh; y++) {
    const y0 = y * 2;
    for (let x = 0; x < dw; x++) {
      const x0 = x * 2;
      const s00 = (y0 * w + x0) * 3;
      const s01 = s00 + 3;
      const s10 = s00 + w * 3;
      const s11 = s10 + 3;
      const d = (y * dw + x) * 3;
      for (let c = 0; c < 3; c++) {
        dst[d + c] =
          (src[s00 + c] + src[s01 + c] + src[s10 + c] + src[s11 + c] + 2) >> 2;
      }
    }
  }
  return dst;
}

/**
 * tiled 超分主入口：解码（限 1024）→ 4× 分块推理 + 羽化 → 2× 下采样（可选）→ PNG 落盘。
 * @param path 输入图片路径（file:// 或裸路径）
 * @param scale 2 或 4
 * @param style general | anime
 * @param onProgress 0-100
 */
export async function upscaleImage(
  path: string,
  scale: 2 | 4,
  style: SRStyle,
  onProgress?: (pct: number) => void,
): Promise<{uri: string; w: number; h: number}> {
  if (!srSession) {
    throw new Error('SuperRes not loaded');
  }
  const p = path.replace(/^file:\/\//, '');
  const {rgb, w: inW, h: inH} = await decodeInput(p, INPUT_MAX);
  const out4W = inW * 4;
  const out4H = inH * 4;
  const buf = new Uint8Array(out4W * out4H * 3);
  const step = TILE - OVERLAP;
  const ostep = step * 4;
  const nx = Math.ceil(inW / step);
  const ny = Math.ceil(inH / step);
  const total = nx * ny;
  let done = 0;
  for (let iy = 0, oy = 0; iy < inH; iy += step, oy += ostep) {
    const ih = Math.min(TILE, inH - iy);
    for (let ix = 0, ox = 0; ix < inW; ix += step, ox += ostep) {
      const iw = Math.min(TILE, inW - ix);
      const n = iw * ih;
      // HWC → NCHW（0-1 float32）
      const inp = new Float32Array(3 * n);
      for (let y = 0; y < ih; y++) {
        const srow = (y + iy) * inW;
        for (let x = 0; x < iw; x++) {
          const s = (srow + x + ix) * 3;
          const d = y * iw + x;
          inp[d] = rgb[s];
          inp[n + d] = rgb[s + 1];
          inp[2 * n + d] = rgb[s + 2];
        }
      }
      const res = await srSession!.run({
        input: new ort.Tensor('float32', inp, [1, 3, ih, iw]),
      });
      blit(
        buf,
        res.output.data as Float32Array,
        out4W,
        out4H,
        ox,
        oy,
        iw * 4,
        ih * 4,
      );
      done++;
      onProgress?.(Math.round((done / total) * 100));
      // 每 tile 打日志（真机验证/排障：首块完成后即可确认在跑）
      console.log(`[SuperRes] tile ${done}/${total}`);
    }
  }
  const final = scale === 4 ? buf : downsample2(buf, out4W, out4H);
  const outW = scale === 4 ? out4W : Math.floor(out4W / 2);
  const outH = scale === 4 ? out4H : Math.floor(out4H / 2);
  const png = encodePng(final, outW, outH);
  const outPath = `${RNFS.DocumentDirectoryPath}/aios_images/upscaled_${Date.now()}.png`;
  await RNFS.writeFile(outPath, toBase64(png), 'base64');
  console.log(`[SuperRes] saved ${outPath} (${outW}x${outH}, ${scale}x)`);
  return {uri: `file://${outPath}`, w: outW, h: outH};
}
