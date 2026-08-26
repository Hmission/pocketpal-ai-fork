/**
 * imageGenManifest — 声明式生图模型注册
 *
 * 替代正则配对（反补丁）：每个模型套件一个 manifest，声明主文件 + 伴侣文件 + 默认参数。
 * - 内置 manifest 覆盖官方已知模型（SDXL Turbo / SD3.5 / Z-Image-Turbo）
 * - 设备端 AIOS_MODELS_DIR 下 *.manifest.json 可扩展（新模型零改代码）
 * - scanAvailableModels 只列出 main 文件实际存在的模型
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

export type ModelFamily =
  | 'zimage'
  | 'sd3'
  | 'flux'
  | 'classic'
  | 'dreamlite'
  | 'krea2';

/**
 * GPU 准入策略（声明式兼容矩阵，实测准入非推测）：
 * - 'high-adreno-only'：仅 Adreno 8xx/9xx（Z-Image：6.9GB 内存硬顶 + 740 级驱动 hang 实测）
 * - 'high-adreno-or-mali'：Adreno 8xx/9xx 或 Mali（Klein：5.3GB 图切段覆盖，
 *   2026-08-25 K Pad（天玑9400+/Mali-G925）实测准入）
 * 不设 = 全设备。灰置判定单点在 ImageGenScreen isIncompatible。
 */
export type GpuPolicy = 'high-adreno-only' | 'high-adreno-or-mali';

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
  /** GPU 准入策略（见 GpuPolicy）；替代 08-18 的 requiresHighGpu 布尔（语义过粗已废） */
  gpuPolicy?: GpuPolicy;
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
    // 8-24 A 线探针结论（负）：Vulkan 在 K Pad 加载成功但 TE 编码即崩（ggml-vulkan.cpp:7539
    // descriptor_set_idx 断言，关不关 graph-cut 都崩）——sd.cpp Runner 动态图与 ggml-vulkan
    // 描述符生命周期不兼容，非配置可解。回滚 'OpenCL'（SD_VULKAN 编译保留休眠，探针对照用）。
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
    // 6.9GB 内存硬顶 + 740 级驱动采样 hang 实测无解 → 仅高端 Adreno（GDN 内核引擎级断言另锁 Mali）
    gpuPolicy: 'high-adreno-only',
    defaults: {steps: 8, cfg: 1, size: 512, backend: 'OpenCL'},
    note: '何时选：中文提示词优化 + 无审查场景。体积：套件约 6.9GB（主模型 3.86 + Qwen3-4B TE 2.50 + ae 0.34；TE 与 FLUX.2 Klein 共享不重下）。适配：仅高端 Adreno（K90 8 步 512px ~11 分钟，08-20 XMEM 真关实测 655s；中低端 740 级驱动采样 hang，实测无解）',
  },
  {
    id: 'krea2-turbo-q4',
    label: 'Krea2 Turbo (Q4_K_M)',
    // 8-26 大王纠错：Krea AI 自研模型，非 FLUX 系（badge 不可标 FLUX.2）
    family: 'krea2',
    main: 'Krea-2-Turbo-Q4_K_M.gguf',
    companions: {
      // Qwen3-VL-4B（Krea2 官方文本编码器，与 zimage_llm 非同源文件）
      llm: 'Qwen3VL-4B-Instruct-Q4_K_M.gguf',
      vae: 'wan_2.1_vae.safetensors',
    },
    // 8-26 接入评估（本机 + K90 真机实测，16GB RAM 修正后复审）:
    // 本机：引擎 6/25 已支持，CPU 出图质量正常，Q4 sha 验证一致；桌面 CUDA DiT 全 NaN 为上游缺陷（与端侧无关）。
    // 真机（K90 Pro Max 16GB，可用 ~10GB）：加载成功但 9.9GB 预算（TE 2.8G + DiT 6.9G + VAE 0.24G）全驻留
    // 超 OpenCL 全局 7.5GB，生成三次 OOM 被杀（08-26 实测三连）。
    // 8-26 端侧定论（MASTER_LOG §99.4）：全驻留 9.9GB 超 K90 OpenCL 全局 7.5GB → OOM 三连强杀；
    // te=disk 因 Krea2 TE（Qwen3-VL-4B）值域 ±1e10 在 ARM CPU f16 溢出 SIGABRT（已回滚禁用，
    // Klein 的 zimage_llm 值域正常故可用）；Q8_0 CPU/CUDA 全 NaN 为上游缺陷（sha 完好实证）。
    // 结论：双门槛（内存+精度）均上游可解（ARM f16 精度 / ≥24GB 设备），无应用层招，维持 experimental。
    experimental: true,
    gpuPolicy: 'high-adreno-only',
    defaults: {steps: 8, cfg: 1, size: 512, backend: 'OpenCL'},
    note: '何时选：审美多样性 + 风格 LoRA（实验性）。体积：套件约 9.9GB（DiT 7.22 + Qwen3-VL TE 2.5 + Wan VAE 0.25）。适配：仅高端 Adreno（K90 16GB 实测 08-26：全驻留三连 OOM、te=disk 因 TE f16 溢出回滚——待上游修 ARM f16 精度或 ≥24GB 设备）',
  },
  {
    id: 'flux-klein-4b',
    label: 'FLUX.2 Klein (Q4_K_M)',
    family: 'flux',
    // 8-25 量化换源：leejet Q4_0（马赛克，双端定罪）→ unsloth Q4_K_M
    // （149 张量同名兼容，Q4_K+Q6_K 混合渐进量化；OID 同 leejet 即有物证）
    main: 'flux-2-klein-4b-Q4_K_M.gguf',
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
    // TE 复用不重下。门控演进（2026-08-25）：原 requiresHighGpu 复刻 Z-Image 属保守推测（「Mali 未验证」
    // ≠ 不兼容）；侦察实锤 klein 链路零 GDN（FluxRunner DiT + LLMEmbedder TE，引擎侧零 gated_delta
    // 构图），内存靠 te=disk 驻留（JNI Mali 分支）+图切段装下 → 升声明式准入 'high-adreno-or-mali'。
    // K Pad（Mali-G925）实测链路全通：全链 296.77s、采样 35.4 s/步、nan=0；
    // 但 leejet Q4_0 量化出马赛克——Mali 与 Adreno（08-24 K90）双端复现。
    // 8-26 根因终局（13 组对照实证）：马赛克=vendored ggml-opencl 通用内核对 FLUX.2 shape 的 bug，
    //   与量化无关（Q4_0/Q4_K_M/Q4_K_S 全纹理）、与内核变体无关（fp32 通用/fp16-tiled 均坏，fp16 更糟）、
    //   VAE/TE/cfg/分辨率/治理组全排除；CPU（桌面+端侧）干净、Z-Image(FLUX.1) OpenCL 干净 → FLUX.2 特有 shape 触发。
    //   桌面复现被 vendored 设备门禁（白名单/fp16/subgroups）拦截，需移动端 OpenCL 逐 op instrumentation 修内核（上游级）。
    // 结论：GPU 保持 experimental（已知纹理）不误导用户；CPU 可出正确图（慢）；内核修复专项立项。
    // 8-26 兑现「能跑」：默认后端切 CPU（正确、慢 ~5h）；仅改此字段，不回滚其它更新。
    experimental: true,
    gpuPolicy: 'high-adreno-or-mali',
    defaults: {steps: 4, cfg: 1, size: 512, backend: 'CPU'},
    // 08-24 画幅如实化：官方蒸馏契约是 1MP（4 步 1024px），但 klein 尚无端侧完整出图实测，
    // 端侧暂与 SD3.5/Z-Image 同走 512 级档位（SD_RATIOS，内存约束）。
    // 待量化源修复后，再决策是否升 1024 档（升档前必有真机出图证据，不凭官方文案预设）。
    note: '何时选：画质天花板，4 步极速，中英文原生。体积：DiT 2.6 + VAE 0.34 ≈ 2.9GB（TE 与 Z-Image 共享不重下）。适配：高端 Adreno + Mali 平板（链路已实测通；已换 unsloth Q4_K_M 量化源，验画质中）',
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
async function loadDeviceManifests(dir: string): Promise<ImageGenManifest[]> {
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
  const extras: {clipL?: string; clipG?: string; llm?: string; vae?: string} =
    {};
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
