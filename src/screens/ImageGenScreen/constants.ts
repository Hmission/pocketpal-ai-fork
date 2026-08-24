import {ImageGenManifest} from '../../utils/imageGenManifest';

// 模型族徽章文案（语义彩色在 styles.ts 中定义）
export const FAMILY_BADGE: Record<ImageGenManifest['family'], string> = {
  zimage: 'Z-Image',
  sd3: 'SD3.5',
  flux: 'FLUX.2',
  classic: '',
  dreamlite: 'DreamLite',
};

// DreamLite 作为统一模型选项进入顶部选择栏（同一模型不分出图/编辑；模式切换由预览区分页驱动）
export const DREAMLITE_MANIFEST: ImageGenManifest = {
  id: 'dreamlite',
  label: 'DreamLite Mobile',
  family: 'dreamlite',
  main: '',
  defaults: {steps: 4, cfg: 1, size: 1024},
  note: '何时选：默认主力，文生图 + 图像编辑一体，最快出图。体积：套件约 6.4GB（unet 1.56 + TE 1.71 + te_fp16.data 3.20 + vae×2）。适配：全设备（ONNX 引擎，4 步 1024px 约 25s）',
};

export const PROMPT_LIMIT = 120;

// 08-18 修复：提示词按 token 计（原按字符 120 过低——120 字符≈30 tokens 远低于模型上限）
// 08-21 对齐官方：dreamlite 文本条件上限从 128 提到 200（官方 max_sequence_length=200）
// 各模型 token 上限（编码器硬限，超出将被截断）：
//   dreamlite: 200（UNet 条件上限，官方 max_sequence_length=200；编辑模式另有 256 视觉 token）
//   sd3: 77（CLIP-L/G max_length=77，训练/推理一致，引擎 chunk_len=77）
//   zimage: 256（LLM 编码，宽松）
//   flux: 256（Qwen3-4B TE 与 zimage 同源同限，08-22 klein 接入）
export const PROMPT_TOKEN_LIMIT: Record<string, number> = {
  dreamlite: 200,
  sd3: 77,
  zimage: 256,
  flux: 256,
};

/** 粗估 token 数：英文 ~4 字符/token，中文 1 字符/token（BPE 近似，供输入提示） */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) {
      ascii++;
    } else {
      nonAscii++;
    }
  }
  return Math.ceil(ascii / 4) + nonAscii;
}

// 官方多分辨率训练桶（~1M 像素，与 HF Space 选项一致；旧自定尺寸如 576×1024 偏离训练桶会导致非方图质量下降）
export const RATIOS: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '9:7': [1152, 896],
  '7:9': [896, 1152],
  '3:2': [1216, 832],
  '2:3': [832, 1216],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
};

// 通用 SD 模型比例档（08-18 升级：原仅方形尺寸 → 比例可选，对齐 DreamLite 画幅模式）
// 端侧 512 级：像素 16 倍数对齐 VAE(8x)/patch(2)；2:3/3:2 竖横对齐人体姿态训练分布
// 非 Dream 模型出图宽高由此表派生（默认 1:1 = 512×512）
export const SD_RATIOS: Record<string, [number, number]> = {
  '1:1': [512, 512],
  '2:3': [512, 768],
  '3:2': [768, 512],
  '3:4': [384, 512],
  '4:3': [512, 384],
};

/** 模型条目：设备扫描结果（manifest + 主文件路径），DreamLite 无文件（mainPath=''） */
export interface ModelEntry {
  manifest: ImageGenManifest;
  mainPath: string;
}
