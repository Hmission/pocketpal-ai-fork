/**
 * imageGenManifest — 声明式生图模型注册
 *
 * 替代正则配对（反补丁）：每个模型套件一个 manifest，声明主文件 + 伴侣文件 + 默认参数。
 * - 内置 manifest 覆盖官方已知模型（SDXL Turbo / SD3.5 / Z-Image-Turbo）
 * - 设备端 AIOS_MODELS_DIR 下 *.manifest.json 可扩展（新模型零改代码）
 * - scanAvailableModels 只列出 main 文件实际存在的模型
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

export type ModelFamily = 'zimage' | 'sd3' | 'flux' | 'classic' | 'dreamlite';

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
     * 引擎后端（sd.cpp 系可选）：'CPU' | 'OpenCL' | 'Vulkan'。
     * 单后端决策唯一在 manifest（设备端 *.manifest.json 可显式覆盖，非自动回退）。
     * 不设则透传空 → 引擎默认 CPU。DreamLite 走独立 ORT/MNN 引擎不适用。
     * 当前值 'OpenCL'（6.16 Phase 1：CPU 实测 2h+ 不可用，切 OpenCL + xmem GEMM 验证 GPU 路径）。
     */
    backend?: string;
  };
  /** 加速 LoRA 文件名（可选，sd.cpp 原生挂载） */
  lora?: string;
  loraMultiplier?: number;
  /** 实验性标记：已知不可用/未验证的模型，下拉显示警示徽章 */
  experimental?: boolean;
  /** 08-18：仅高端 GPU 可用（Adreno 800 系）。740 级设备下拉灰置 + 加载禁用（Z-Image 驱动 hang 实测无解） */
  requiresHighGpu?: boolean;
  note?: string;
}

/** 内置 manifest：覆盖官方已知模型（MODEL_MATRIX 入选清单同步，淘汰模型不得保留） */
export const BUILTIN_MANIFESTS: ImageGenManifest[] = [
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
    // 08-16 闭环：白图根因修复 + 512px VAE tiled 降级（1.94GB→416MB）+ K90 直接分配成功
    // 08-17 大王确认去掉实验性标记：双设备正式参数完整跑通（K90 ~10 分钟/小米13 ~40 分钟，0% 白图）
    // 08-18 路线 B：独立 LoRA 运行时挂载（生图页开关控制，默认关=纯 base；multiplier=训练 scaling alpha/rank=2.0）
    // 08-20 Mali 平板（Mali-G925/天玑 9400+）支持：白名单 + fp32 通用路径，4 步 512px ~10.4 分钟；
    //   内存治理：图切段（max_vram=opencl:2.0）+ 关 mmap（PSS 峰值 7.5GB→采样后 1.65GB）
    lora: 'lora_humanpose.safetensors',
    loraMultiplier: 2.0,
    experimental: false,
    defaults: {steps: 10, cfg: 4.5, size: 512, backend: 'OpenCL'},
    note: '何时选：均衡画质，速度/内存折中，支持 LoRA 挂角色。体积：套件约 3.7GB（主模型 1.79 + clip_l 0.25 + clip_g 1.39 + vae 0.17 + LoRA 0.08）。适配：全设备（K90 10 步 512px ~10 分钟；小米 13 ~40 分钟含 tiled VAE；Mali 平板 4 步 ~10.4 分钟 fp32 路径）',
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
    // 08-16 已跑通：K90（Adreno 840）8 步 512px 全流程 39.7 分钟，LLM 编码 141s + 采样 nan/inf=0 + VAE 1664MB 直接分配
    // 08-17 大王确认：端侧三模型（DreamLite/SD3.5/Z-Image）均已跑通，去除实验性标记
    // 08-17 顺序卸载探索：Z-Image 6.9GB 对中低端（小米13 GPU~2.8G）是硬件上限，cpu residency+stream_layers 无法跑通 → 仅高端设备
    // 08-20 XMEM 定稿：xmem 存在（=0/=1）时采样 2033s（39.7 分钟）；unset（真关）后采样 512.56s、
    // 全流程 655.5s（10.9 分钟，提速 3.6 倍，nan/inf=0，VAE tiled 112s 稳定）
    experimental: false,
    requiresHighGpu: true,
    defaults: {steps: 8, cfg: 1, size: 512, backend: 'OpenCL'},
    note: '何时选：中文提示词优化 + 无审查场景。体积：套件约 6.9GB（主模型 3.86 + Qwen3-4B TE 2.50 + ae 0.34；TE 与 FLUX.2 Klein 共享不重下）。适配：仅高端 Adreno（K90 8 步 512px ~11 分钟，08-20 XMEM 真关实测 655s；中低端 740 级驱动采样 hang，实测无解）',
  },
  {
    id: 'flux-klein-4b',
    label: 'FLUX.2 Klein (Q4_0)',
    family: 'flux',
    main: 'flux_klein_4b_q4_0.gguf',
    companions: {
      // TE 复用 Z-Image 的 zimage_llm.gguf（Qwen3-4B-Q4_K_M，与 klein 官方 qwen_3_4b
      // 同源；官方是 8.05GB 全精度，端侧必须 GGUF 量化；Z-Image 已实测端侧无 nan/inf）
      llm: 'zimage_llm.gguf',
      // flux2-vae 与 Z-Image ae.safetensors 非同文件（oid 不同，08-22 HF API 实锤），独立
      vae: 'flux2_vae.safetensors',
    },
    // 08-22 Box 清单 P0 接入（FLUX.2 klein 4B Distilled，4 步 1024px，Apache 2.0 可商用）：
    // 采样契约（sd.cpp docs/flux2.md L45）cfg=1.0 / steps=4 / 引擎默认 sampling-method；
    // 与 Z-Image 同族（DiT + Qwen TE + flow matching + fp16 累积风险）→ JNI 并入 zimage
    // OpenCL 治理组（DISABLE_ADRENO_KERNELS=1 + XMEM 真关）；DiT Q4_0 2.46GB + VAE 0.34GB，
    // TE 复用不重下；requiresHighGpu 复刻 Z-Image（4B DiT + 4B TE 同常驻量级，Mali 未验证）
    experimental: false,
    requiresHighGpu: true,
    // 08-24 根因隔离实验（临时）：OpenCL 出马赛克纹理 → 切 CPU 对照，
    // 正常出图 = Adreno OpenCL Q4_0 内核定罪；仍纹理 = leejet Q4_0 量化定罪。验完回滚 'OpenCL'。
    defaults: {steps: 4, cfg: 1, size: 512, backend: 'CPU'},
    note: '何时选：画质天花板，4 步极速，中英文原生。体积：DiT 2.46 + VAE 0.34 ≈ 2.8GB（TE 与 Z-Image 共享不重下）。适配：仅高端 Adreno（速度待 K90 实测回填；4B DiT + 4B TE 同常驻，Mali 未验证）',
  },
];

/**
 * 生图模型文件集合（内置 manifest 的 main + companions 全量文件名）。
 * 用于 LLM 扫描/聊天选择时屏蔽生图文件（同为 .gguf 会被误注册为 LLM）。
 */
export const IMAGE_GEN_MODEL_FILES: ReadonlySet<string> = new Set([
  ...BUILTIN_MANIFESTS.flatMap(m => [
    m.main,
    ...Object.values(m.companions ?? {}),
  ]),
  // 已知非 LLM 的 gguf 工件（SD 权重烘焙进 GGUF 容器，架构非 LLM）：
  // 后缀单规则区分不了，声明式名单单点收口。
  'sd35_medium_humanpose_baked.gguf',
]);

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
