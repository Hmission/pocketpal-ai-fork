import {ImageGenManifest, ModelFamily} from '../../utils/imageGenManifest';
import type {Theme} from '../../utils/types';

// 模型族徽章文案（颜色见下方 FAMILY_BADGE_TOKEN，均走 theme token）
export const FAMILY_BADGE: Record<ImageGenManifest['family'], string> = {
  zimage: 'Z-Image',
  sd3: 'SD3.5',
  flux: 'FLUX.2',
  classic: '',
  dreamlite: 'DreamLite',
  krea2: 'Krea2',
};

/**
 * 徽章色 token 名（DESIGN_SPEC §1.4）：由 token 面派生而不手写联合——
 * 新增 `badge*` token 自动进入可选集。
 */
export type FamilyBadgeColorToken = Extract<
  keyof Theme['colors'],
  `badge${string}`
>;

/**
 * 族 → 徽章色 token（**唯一定义点**，2026-09-07 W5 双份事实源收口）。
 *
 * 旧状态：同一事实三处表达——`QueuePanel` 一份 Record、`styles.ts` 五个 `badge*`
 * 样式键、`ModelPickerPanel` 一条五层三元链。新增族时三元链会静默落到
 * `s.badgeZ`（错色不报错）。现在两处 UI 共读本表。
 *
 * 用全量 `Record<ModelFamily, …>` 而非 Partial：`ModelFamily` 新增成员时 tsc 在此
 * 报错，逼着先去 DESIGN_SPEC §1.4 登记色再上屏。`classic` 为历史族、SPEC 未登色
 * → 显式 null，调用侧回落 info。
 */
export const FAMILY_BADGE_TOKEN: Record<
  ModelFamily,
  FamilyBadgeColorToken | null
> = {
  dreamlite: 'badgeDreamlite',
  sd3: 'badgeSd35',
  zimage: 'badgeZImage',
  flux: 'badgeFlux',
  krea2: 'badgeKrea2',
  classic: null,
};

/**
 * 族 → 徽章色值。入参宽至 `string`：队列快照的 family 落在持久化边界（DB 里
 * 可能是历史/未知键），做真判定而非强转；未知/未登色族回落 info，不抛不猜。
 */
export function familyBadgeColor(theme: Theme, family: string): string {
  const token =
    family in FAMILY_BADGE_TOKEN
      ? FAMILY_BADGE_TOKEN[family as ModelFamily]
      : null;
  return token ? theme.colors[token] : theme.colors.info;
}

/** 族 → 徽章显示名（与模型下拉同源）；未知键与未登名（classic）回落原始键名。 */
export function familyBadgeLabel(family: string): string {
  const label =
    family in FAMILY_BADGE ? FAMILY_BADGE[family as ModelFamily] : '';
  return label || family;
}

/**
 * 队列摘要文案（格式化单点，2026-09-07 W5）：吸底胶囊（GenActionBar）与面板
 * 「开始队列」按钮（QueuePanel）同源。
 *
 * 旧写法是编排层把已拼好的字符串当 prop 传进来，组件内另留一份
 * `` `${queueItemCount} 项` `` 兜底：字符串缺失就静默换成另一种文案（两种格式并存）。
 * 现在组件只接数值，拼法只此一处。两个调用侧传的 `draws` 语义不同（胶囊传总抽数、
 * 开始按钮传剩余抽数），本函数只统一措辞不统一口径。
 */
export const formatQueueSummary = (items: number, draws: number): string =>
  `${items} 项 · ${draws} 抽`;

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

// 08-24 编辑输出单契约：DreamLite 编辑固定 1024×1024（官方最小方形训练桶）。
// 旧实现 sq=min(画幅) 跟随画幅（2:3→832²、9:16→768²）均为桶外方形 → 糊图风险；
// 与聊天内联编辑（chatImageTask）/相册封面（albumBook）的 1024² 统一为单点契约。
export const DREAM_EDIT_SIZE = 1024;

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
  // 8-26：Krea2 文本编码器 Qwen3-VL-4B，与 zimage/flux 同源同限
  krea2: 256,
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
