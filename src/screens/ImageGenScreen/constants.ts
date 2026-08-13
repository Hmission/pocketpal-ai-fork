import {ImageGenManifest} from '../../utils/imageGenManifest';

// 模型族徽章文案（语义彩色在 styles.ts 中定义）
export const FAMILY_BADGE: Record<ImageGenManifest['family'], string> = {
  zimage: 'Z-Image',
  sd3: 'SD3.5',
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
  note: '统一文生图 + 图像编辑，4 步 1024px 约 25s',
};

export const PROMPT_LIMIT = 120;

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

// 通用 SD 模型可选尺寸
export const SIZES = [384, 512, 640, 768];

/** 模型条目：设备扫描结果（manifest + 主文件路径），DreamLite 无文件（mainPath=''） */
export interface ModelEntry {
  manifest: ImageGenManifest;
  mainPath: string;
}
