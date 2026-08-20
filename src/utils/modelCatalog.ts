/**
 * modelCatalog — MODEL_MATRIX 代码化唯一事实源
 *
 * 门禁：本文件条目必须与 docs/POCKETPAL_MODEL_MATRIX.md 入选清单（§1 LLM 7 件 +
 * §2 生图 3 件 + §6 文件清单）逐字节一致。变更流程：大王钦定 → 先更新 MODEL_MATRIX
 * 文档 → 再同步本文件（__tests__/modelCatalog.test.ts 断言清单完整性）。
 *
 * 下载源显式声明：sources 声明该条目可用的下载源（'hf' | 'modelscope'）；
 * 空数组 = 无在线源（模型页仅展示，不给假下载按钮）。sources 语义 = 条目
 * 至少一个文件有该源即声明；单文件在某源无 repo 时由 resolveFileSource
 * 自动回退到其余可用源（跨仓套件如 SD3.5/Z-Image 的 companions 分布多仓）。
 *
 * 镜像实测记录（2026-08-20，modelscope.cn 详情+文件列表 API）：
 * - 有镜像（同名同文件）：LiquidAI/LFM2.5-2.6B-GGUF、LiquidAI/LFM2.5-8B-A1B-GGUF、
 *   unsloth/Ministral-3-3B-Instruct-2512-GGUF、city96/stable-diffusion-3.5-medium-gguf、
 *   AI-ModelScope/stable-diffusion-3.5-fp8、AI-ModelScope/stable-diffusion-3.5-medium、
 *   leejet/Z-Image-Turbo-GGUF、unsloth/Qwen3-4B-GGUF、Comfy-Org/z_image_turbo
 * - 无镜像（404）：HauhauCS 两个 Qwen3.5 repo（仅 HF）、MiniCPM 管家
 *   （社区微调 Fable5 V2 Heretic 出自 GnLOLot HF 仓库，魔搭无此版；官方
 *   openbmb/MiniCPM5-1B-GGUF 只有原版 F16/Q4_K_M/Q8_0，无 heretic——不替换）
 */

import {DownloadSource} from './downloadSources';

export type CatalogCategory = 'llm' | 'imagegen';

export interface CatalogFile {
  /** 精确文件名（与 MODEL_MATRIX §6 一致，即真机落盘名） */
  name: string;
  sizeBytes: number;
  /** 落盘目录（AIOS_ROOT 下）：models/ = LLM 与生图权重；dreamlite/ = DreamLite ONNX 套件 */
  dir: 'models' | 'dreamlite';
  /** 远程相对路径（默认 = name；远程子目录/改名文件用，如 text_encoders/clip_l.safetensors） */
  remotePath?: string;
  /** 每源远程路径覆盖（默认 = remotePath ?? name；两源路径不同时用） */
  remotePathBySource?: Partial<Record<DownloadSource, string>>;
  /** 每源 repo 覆盖（默认 = 条目级 hfRepo/modelscopeRepo；跨仓套件用） */
  repoBySource?: Partial<Record<DownloadSource, string>>;
}

export interface CatalogModel {
  /** 唯一 id（author/repo/filename 风格，与 Model.id 对齐） */
  id: string;
  category: CatalogCategory;
  displayName: string;
  /** 主文件（LLM=GGUF 主模型；生图=main 权重） */
  file: CatalogFile;
  /** 套件其余文件（mmproj 视觉伴侣 / 生图 companions） */
  extras?: CatalogFile[];
  /** 可用下载源（显式声明；空 = 无在线源，仅展示） */
  sources: DownloadSource[];
  /** HF repo id（sources 含 'hf' 时必填） */
  hfRepo?: string;
  /** ModelScope repo id（sources 含 'modelscope' 时必填；镜像确认后补充） */
  modelscopeRepo?: string;
  /** 设备适配推荐（仅排序提示，不隐藏任何条目） */
  tierHint?: 'low' | 'mid' | 'high' | 'flagship';
  /** 用途定位（MODEL_MATRIX 定位列） */
  role?: string;
}

/** LLM 入选清单（MODEL_MATRIX §1 + DEVICE_DEPLOYMENT_SOP §1.1 字节数） */
export const CATALOG_LLM: CatalogModel[] = [
  {
    id: 'HauhauCS/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf',
    category: 'llm',
    displayName: 'Qwen3.5-2B 无限制',
    file: {
      name: 'Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf',
      sizeBytes: 2012012000,
      dir: 'models',
    },
    extras: [
      {
        name: 'mmproj-Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-f16.gguf',
        sizeBytes: 668226688,
        dir: 'models',
      },
    ],
    // 2026-08-20 魔搭镜像（zensignGG 账号，与 HF 原仓逐字节一致）：
    // zensignGG/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-GGUF
    sources: ['hf', 'modelscope'],
    hfRepo: 'HauhauCS/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive',
    modelscopeRepo: 'zensignGG/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-GGUF',
    tierHint: 'low',
    role: '写作/聊天主力',
  },
  {
    id: 'HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf',
    category: 'llm',
    displayName: 'Qwen3.5-4B 无限制',
    file: {
      name: 'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf',
      sizeBytes: 2707513696,
      dir: 'models',
    },
    extras: [
      {
        name: 'mmproj-Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-BF16.gguf',
        sizeBytes: 675568768,
        dir: 'models',
      },
    ],
    // 2026-08-20 魔搭镜像（zensignGG 账号，与 HF 原仓逐字节一致）：
    // zensignGG/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-GGUF
    sources: ['hf', 'modelscope'],
    hfRepo: 'HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive',
    modelscopeRepo: 'zensignGG/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-GGUF',
    tierHint: 'high',
    role: '日用',
  },
  {
    id: 'LiquidAI/LFM2.5-2.6B-GGUF/LFM2.5-2.6B-Q4_K_M.gguf',
    category: 'llm',
    displayName: 'LFM2.5-2.6B',
    file: {
      name: 'LFM2.5-2.6B-Q4_K_M.gguf',
      sizeBytes: 1674454848,
      dir: 'models',
    },
    sources: ['hf', 'modelscope'],
    hfRepo: 'LiquidAI/LFM2.5-2.6B-GGUF',
    modelscopeRepo: 'LiquidAI/LFM2.5-2.6B-GGUF',
    tierHint: 'mid',
    role: '代码/玩具匠（工具调用优化，低延迟）',
  },
  {
    id: 'LiquidAI/LFM2.5-8B-A1B-GGUF/LFM2.5-8B-A1B-Q4_K_M.gguf',
    category: 'llm',
    displayName: 'LFM2.5-8B-A1B',
    file: {
      name: 'LFM2.5-8B-A1B-Q4_K_M.gguf',
      sizeBytes: 5155564768,
      dir: 'models',
    },
    sources: ['hf', 'modelscope'],
    hfRepo: 'LiquidAI/LFM2.5-8B-A1B-GGUF',
    modelscopeRepo: 'LiquidAI/LFM2.5-8B-A1B-GGUF',
    tierHint: 'flagship',
    role: 'MoE 大模型（激活~1.5B）；K90 PSS 看护硬杀不可用',
  },
  {
    id: 'unsloth/Ministral-3-3B-Instruct-2512-GGUF/Ministral-3-3B-Instruct-2512-Q4_K_M.gguf',
    category: 'llm',
    displayName: 'Ministral-3-3B',
    file: {
      name: 'Ministral-3-3B-Instruct-2512-Q4_K_M.gguf',
      sizeBytes: 2146497824,
      dir: 'models',
    },
    sources: ['hf', 'modelscope'],
    hfRepo: 'unsloth/Ministral-3-3B-Instruct-2512-GGUF',
    modelscopeRepo: 'unsloth/Ministral-3-3B-Instruct-2512-GGUF',
    tierHint: 'mid',
    role: '代码候选（均衡档）',
  },
  {
    id: 'minicpm5_1b_heretic_q4km.gguf',
    category: 'llm',
    displayName: 'MiniCPM5-1B 管家',
    file: {
      name: 'minicpm5_1b_heretic_q4km.gguf',
      sizeBytes: 688066528,
      dir: 'models',
      remotePath: 'MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic.Q4_K_M.gguf',
      // 魔搭镜像文件名 = 本地落盘名（HF 远程名不同，需按源覆盖）
      remotePathBySource: {
        modelscope: 'minicpm5_1b_heretic_q4km.gguf',
      },
    },
    // HF 源已实锤（2026-08-20，hf-mirror API + GGUF 头部元数据对比）：
    // mradermacher/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF
    // 的 Q4_K_M（general.name 家族一致、license apache-2.0、base_model
    // openbmb/MiniCPM5-1B 全同；本地为早期版本，与当前文件差 1152 字节）。
    // 注意：mradermacher/MiniCPM5-1B-heretic-GGUF 是另一仓库（K0D3IN
    // base heretic，license agpl-3.0 不符，非 Fable5）——勿用。
    // 2026-08-20 魔搭镜像（zensignGG 账号，文件名 = 本地落盘名，故
    // remotePathBySource.modelscope 覆盖 HF 远程名）：
    // zensignGG/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF
    sources: ['hf', 'modelscope'],
    hfRepo: 'mradermacher/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF',
    modelscopeRepo: 'zensignGG/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF',
    tierHint: 'low',
    role: '常驻管家（prompter）',
  },
];

/** 生图入选清单（MODEL_MATRIX §2 + DEVICE_DEPLOYMENT_SOP §1.1/§1.2 字节数） */
export const CATALOG_IMAGEGEN: CatalogModel[] = [
  {
    id: 'dreamlite/dreamlite-suite',
    category: 'imagegen',
    displayName: 'DreamLite Mobile',
    file: {
      name: 'unet_masked.onnx',
      sizeBytes: 1561735173,
      dir: 'dreamlite',
    },
    extras: [
      {name: 'vae_decoder.onnx', sizeBytes: 4912510, dir: 'dreamlite'},
      {name: 'vae_encoder.onnx', sizeBytes: 4910603, dir: 'dreamlite'},
      {name: 'te_q8.gguf', sizeBytes: 1834427328, dir: 'dreamlite'},
      {name: 'te_fp16.onnx', sizeBytes: 5069907, dir: 'dreamlite'},
      {name: 'te_fp16.onnx.data', sizeBytes: 3441164288, dir: 'dreamlite'},
    ],
    // 部署 ONNX 为自制导出（.tmp/dreamlite 本地 export_unet_masked_fp16.py 等
    // 导出 + 量化），HF 无公开 ONNX；原始权重（safetensors）来自作者官方仓库
    // carlofkl/DreamLite-mobile（2026-08-20 hf-mirror 逐字节验证：unet
    // 780074688 / vae 4903270 / te 4255140312 与本地 ckpt 全一致）。
    // 2026-08-20 自制套件已上传魔搭（zensignGG 账号，6 文件字节级一致）：
    // zensignGG/DreamLite-mobile-ONNX —— 魔搭单源在线下载，文件名 = 本地落盘名。
    sources: ['modelscope'],
    modelscopeRepo: 'zensignGG/DreamLite-mobile-ONNX',
    role: '主线主力（4 步 1024px，文生图 + 编辑）',
  },
  {
    id: 'sd35-medium-q4/sd35_medium_q4_k_m.gguf',
    category: 'imagegen',
    displayName: 'SD 3.5 Medium (Q4_K_M)',
    file: {
      name: 'sd35_medium_q4_k_m.gguf',
      sizeBytes: 1787064768,
      dir: 'models',
      remotePath: 'sd3.5_medium-Q4_K_M.gguf',
    },
    extras: [
      {
        name: 'sd35_clip_l.safetensors',
        sizeBytes: 246144152,
        dir: 'models',
        remotePath: 'text_encoders/clip_l.safetensors',
        repoBySource: {
          hf: 'Comfy-Org/stable-diffusion-3.5-fp8',
          modelscope: 'AI-ModelScope/stable-diffusion-3.5-fp8',
        },
      },
      {
        name: 'sd35_clip_g.safetensors',
        sizeBytes: 1389382176,
        dir: 'models',
        remotePath: 'text_encoders/clip_g.safetensors',
        repoBySource: {
          hf: 'Comfy-Org/stable-diffusion-3.5-fp8',
          modelscope: 'AI-ModelScope/stable-diffusion-3.5-fp8',
        },
      },
      {
        name: 'sd35_vae.safetensors',
        sizeBytes: 167666902,
        dir: 'models',
        remotePath: 'vae/diffusion_pytorch_model.safetensors',
        repoBySource: {
          hf: 'stabilityai/stable-diffusion-3.5-medium',
          modelscope: 'AI-ModelScope/stable-diffusion-3.5-medium',
        },
      },
    ],
    // 非自制：city96 官方 GGUF 量化 + Comfy-Org/AI-ModelScope fp8 编码器 + 官方 VAE
    //（.tmp/dl_sd35_zimage.py 实测源，魔搭 resolve 7/7 全 200 验证）
    sources: ['hf', 'modelscope'],
    hfRepo: 'city96/stable-diffusion-3.5-medium-gguf',
    modelscopeRepo: 'city96/stable-diffusion-3.5-medium-gguf',
    role: '画质升级',
  },
  {
    id: 'z-image-turbo-q4/z_image_turbo_q4_k.gguf',
    category: 'imagegen',
    displayName: 'Z-Image-Turbo (Q4_K)',
    file: {
      name: 'z_image_turbo_q4_k.gguf',
      sizeBytes: 3864250304,
      dir: 'models',
      remotePath: 'z_image_turbo-Q4_K.gguf',
    },
    extras: [
      {
        name: 'zimage_llm.gguf',
        sizeBytes: 2497281312,
        dir: 'models',
        remotePath: 'Qwen3-4B-Q4_K_M.gguf',
        // HF 侧 unsloth/Qwen3-4B-Instruct-2507-GGUF 文件名不同（Instruct-2507
        // 后缀）且未验证，只声明魔搭源（unsloth/Qwen3-4B-GGUF 已实测 200）
        repoBySource: {modelscope: 'unsloth/Qwen3-4B-GGUF'},
      },
      {
        name: 'ae.safetensors',
        sizeBytes: 335304388,
        dir: 'models',
        remotePath: 'split_files/vae/ae.safetensors',
        repoBySource: {
          hf: 'Comfy-Org/z_image_turbo',
          modelscope: 'Comfy-Org/z_image_turbo',
        },
      },
    ],
    // 非自制：leejet GGUF 量化 + unsloth Qwen3-4B 文本塔 + Comfy-Org VAE
    //（.tmp/dl_sd35_zimage.py 实测源，魔搭 resolve 全 200 验证）
    sources: ['hf', 'modelscope'],
    hfRepo: 'leejet/Z-Image-Turbo-GGUF',
    modelscopeRepo: 'leejet/Z-Image-Turbo-GGUF',
    role: '中文场景 + 无审查（仅高端 Adreno GPU）',
  },
];

/** 全量清单（模型页 = 本数组全量可管理） */
export const CATALOG_MODELS: CatalogModel[] = [
  ...CATALOG_LLM,
  ...CATALOG_IMAGEGEN,
];

/** 按 id 查清单条目 */
export function catalogEntryById(id: string): CatalogModel | undefined {
  return CATALOG_MODELS.find(m => m.id === id);
}

/** 按主文件名查清单条目（覆盖 source-less stub 的占位 id） */
export function catalogEntryByFilename(
  filename: string,
): CatalogModel | undefined {
  return CATALOG_MODELS.find(m => m.file.name === filename);
}

/** 条目套件总字节数（含 extras，存储守卫用） */
export function catalogEntryTotalBytes(entry: CatalogModel): number {
  const extras = entry.extras ?? [];
  return (
    entry.file.sizeBytes +
    extras.reduce((sum, f) => sum + f.sizeBytes, 0)
  );
}
