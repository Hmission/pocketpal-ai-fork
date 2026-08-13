/**
 * imageGenManifest — 声明式生图模型注册
 *
 * 替代正则配对（反补丁）：每个模型套件一个 manifest，声明主文件 + 伴侣文件 + 默认参数。
 * - 内置 manifest 覆盖官方已知模型（SDXL Turbo / SD3.5 / Z-Image-Turbo）
 * - 设备端 AIOS_MODELS_DIR 下 *.manifest.json 可扩展（新模型零改代码）
 * - scanAvailableModels 只列出 main 文件实际存在的模型
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

export type ModelFamily = 'zimage' | 'sd3' | 'classic' | 'dreamlite';

export interface ImageGenManifest {
  id: string;
  label: string;
  family: ModelFamily;
  /** 主模型文件名（精确匹配） */
  main: string;
  /** 拆分式模型的伴侣文件（精确文件名） */
  companions?: {
    clipL?: string;
    clipG?: string;
    llm?: string;
    vae?: string;
  };
  defaults: {
    steps: number;
    cfg: number;
    size: number;
    /**
     * 引擎后端（sd.cpp 系可选）：'CPU' | 'Vulkan'。
     * 单后端决策唯一在 manifest（设备端 *.manifest.json 可显式覆盖，非自动回退）。
     * 不设则透传空 → 引擎默认 CPU。DreamLite 走独立 ORT/MNN 引擎不适用。
     * 当前值 'Vulkan'（6.12 长链打穿启用，NDK 原生资产补链）；异常可一行回 'CPU'（单点决策）。
     */
    backend?: string;
  };
  /** 加速 LoRA 文件名（可选，sd.cpp 原生挂载） */
  lora?: string;
  loraMultiplier?: number;
  /** 实验性标记：已知不可用/未验证的模型，下拉显示警示徽章 */
  experimental?: boolean;
  note?: string;
}

/** 内置 manifest：覆盖官方已知模型 */
export const BUILTIN_MANIFESTS: ImageGenManifest[] = [
  {
    id: 'sdxl-turbo-fp16',
    label: 'SDXL Turbo (fp16)',
    family: 'classic',
    main: 'sd_xl_turbo_1.0_fp16.safetensors',
    defaults: {steps: 2, cfg: 2, size: 512, backend: 'Vulkan'},
    note: '4 步极速，生态最成熟',
  },
  {
    id: 'sdxl-turbo-q8',
    label: 'SDXL Turbo (Q8 GGUF)',
    family: 'classic',
    main: 'sd_xl_turbo_1.0.q8_0.gguf',
    defaults: {steps: 2, cfg: 2, size: 512, backend: 'Vulkan'},
  },
  {
    id: 'sd35-medium-q4',
    label: 'SD 3.5 Medium (Q4_K_M)',
    family: 'sd3',
    main: 'sd35_medium_q4_k_m.gguf',
    companions: {
      clipL: 'sd35_clip_l.safetensors',
      clipG: 'sd35_clip_g.safetensors',
      vae: 'sd35_vae.safetensors',
    },
    // P6 提速：SD3.5 裸跑 20 步过慢（实测 375s+），默认降 10 步求速度
    // 6.6 实验性标记：真机取证长时出图必被 weak-ref 溢出崩溃杀死（tombstone_04），实质不可用
    experimental: true,
    defaults: {steps: 10, cfg: 4.5, size: 512, backend: 'Vulkan'},
    note: 'MMDiT，端侧不带 T5；CPU 后端 10 步约 3 分钟',
  },
  {
    id: 'z-image-turbo-q4',
    label: 'Z-Image-Turbo (Q4_K)',
    family: 'zimage',
    main: 'z_image_turbo_q4_k.gguf',
    companions: {
      llm: 'zimage_llm.gguf',
      vae: 'ae.safetensors',
    },
    // 6.6 实验性标记：CPU 后端分钟级 + 长时出图必被 weak-ref 溢出崩溃杀死，实质不可用
    experimental: true,
    defaults: {steps: 8, cfg: 1, size: 512, backend: 'Vulkan'},
    note: '无审查，中文优化；CPU 后端 8 步预计数分钟',
  },
  {
    // P6 DreamLite：统一生图+编辑。UNet 0.39B(MNN)+TinyVAE+TE(Qwen-VL 4bit GGUF)
    // 引擎待构建（需 ONNX→MNN 导出机），manifest 先行声明，文件就位即自动识别
    id: 'dreamlite-mobile',
    label: 'DreamLite Mobile (4步)',
    family: 'dreamlite',
    main: 'dreamlite_unet.mnn',
    companions: {
      vae: 'dreamlite_vae.mnn',
      llm: 'dreamlite_te.gguf',
    },
    defaults: {steps: 4, cfg: 1, size: 1024},
    note: '统一生图+编辑，端侧秒级',
  },
];

/** 解析设备端 *.manifest.json（扩展点） */
async function loadDeviceManifests(
  dir: string,
): Promise<ImageGenManifest[]> {
  const out: ImageGenManifest[] = [];
  try {
    const files = await RNFS.readDir(dir);
    for (const f of files) {
      if (!f.name.endsWith('.manifest.json')) {
        continue;
      }
      try {
        const raw = await RNFS.readFile(f.path, 'utf8');
        const m = JSON.parse(raw) as ImageGenManifest;
        if (m.id && m.main && m.family && m.defaults) {
          out.push(m);
        }
      } catch (e) {
        console.warn('[imageGenManifest] bad manifest', f.name, e);
      }
    }
  } catch {
    // dir not exist etc
  }
  return out;
}

/** 列出所有可用模型（main 文件实际存在）。内置 + 设备 manifest 合并，去重。 */
export async function listAvailableModels(
  dir: string,
): Promise<{manifest: ImageGenManifest; mainPath: string}[]> {
  const device = await loadDeviceManifests(dir);
  const all = [...BUILTIN_MANIFESTS, ...device];
  const seen = new Set<string>();
  const result: {manifest: ImageGenManifest; mainPath: string}[] = [];
  for (const m of all) {
    if (seen.has(m.id)) {
      continue;
    }
    seen.add(m.id);
    const mainPath = `${dir}/${m.main}`;
    try {
      if (await RNFS.exists(mainPath)) {
        result.push({manifest: m, mainPath});
      }
    } catch {
      // skip
    }
  }
  return result;
}

/** 解析拆分式模型的伴侣文件：exists 校验，返回 extras + 缺失清单 */
export async function resolveCompanions(
  manifest: ImageGenManifest,
  dir: string,
): Promise<{
  extras: {clipL?: string; clipG?: string; llm?: string; vae?: string};
  missing: string[];
}> {
  const extras: {clipL?: string; clipG?: string; llm?: string; vae?: string} = {};
  const missing: string[] = [];
  const c = manifest.companions;
  if (!c) {
    return {extras, missing};
  }
  const checks: {key: 'clipL' | 'clipG' | 'llm' | 'vae'; name?: string}[] = [
    {key: 'clipL', name: c.clipL},
    {key: 'clipG', name: c.clipG},
    {key: 'llm', name: c.llm},
    {key: 'vae', name: c.vae},
  ];
  for (const {key, name} of checks) {
    if (!name) {
      continue;
    }
    const p = `${dir}/${name}`;
    try {
      if (await RNFS.exists(p)) {
        extras[key] = p;
      } else {
        missing.push(name);
      }
    } catch {
      missing.push(name);
    }
  }
  return {extras, missing};
}
