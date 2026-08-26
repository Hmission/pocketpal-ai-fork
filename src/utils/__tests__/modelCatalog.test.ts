/**
 * modelCatalog 门禁测试：清单完整性 = MODEL_MATRIX 入选清单（§1 LLM 7 件 +
 * §2 生图 3 件）。新增/变更模型必须同时更新 docs/POCKETPAL_MODEL_MATRIX.md
 * 与本文件断言（文档先行 → 代码同步 → 测试锁门禁）。
 */

import {
  CATALOG_MODELS,
  CATALOG_LLM,
  CATALOG_IMAGEGEN,
  catalogEntryById,
  catalogEntryByFilename,
  catalogEntryTotalBytes,
} from '../modelCatalog';
import {getAvailableSources, repoForSource} from '../downloadSources';
import {BUILTIN_MANIFESTS} from '../imageGenManifest';
import {DREAMLITE_MANIFEST} from '../../screens/ImageGenScreen/constants';

describe('modelCatalog — MODEL_MATRIX 门禁', () => {
  it('LLM 入选清单 = 6 主条目（MODEL_MATRIX §1 七件含伴侣：6 模型 + mmproj 伴侣）', () => {
    expect(CATALOG_LLM).toHaveLength(6);
    const names = CATALOG_LLM.map(m => m.file.name);
    expect(names).toContain(
      'Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf',
    );
    expect(names).toContain(
      'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf',
    );
    expect(names).toContain('LFM2.5-2.6B-Q4_K_M.gguf');
    expect(names).toContain('LFM2.5-8B-A1B-Q4_K_M.gguf');
    expect(names).toContain('Ministral-3-3B-Instruct-2512-Q4_K_M.gguf');
    expect(names).toContain('minicpm5_1b_heretic_q4km.gguf');
  });

  it('生图入选清单 = 5 件（MODEL_MATRIX §2：DreamLite/SD3.5/Z-Image/FLUX.2 Klein/Krea2，Klein 2026-08-25 准入 + Krea2 2026-08-26 准入）', () => {
    expect(CATALOG_IMAGEGEN).toHaveLength(5);
    const ids = CATALOG_IMAGEGEN.map(m => m.id);
    expect(ids.some(id => id.includes('dreamlite'))).toBe(true);
    expect(ids.some(id => id.includes('sd35'))).toBe(true);
    expect(ids.some(id => id.includes('z-image'))).toBe(true);
    expect(ids.some(id => id.includes('flux'))).toBe(true);
    expect(ids.some(id => id.includes('krea2'))).toBe(true);
  });

  it('Qwen 视觉伴侣 mmproj 精确文件名（MODEL_MATRIX §1 #2/#4）', () => {
    const qwen2b = CATALOG_LLM.find(m => m.file.name.includes('Qwen3.5-2B'));
    expect(qwen2b?.extras?.map(e => e.name)).toEqual([
      'mmproj-Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-f16.gguf',
    ]);
    const qwen4b = CATALOG_LLM.find(m => m.file.name.includes('Qwen3.5-4B'));
    expect(qwen4b?.extras?.map(e => e.name)).toEqual([
      'mmproj-Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-BF16.gguf',
    ]);
  });

  it('生图套件文件齐全（MODEL_MATRIX §6.1/§6.2）', () => {
    const sd35 = CATALOG_IMAGEGEN.find(m => m.id.includes('sd35'))!;
    expect(sd35.extras?.map(e => e.name).sort()).toEqual(
      [
        'sd35_clip_g.safetensors',
        'sd35_clip_l.safetensors',
        'sd35_vae.safetensors',
        // 自制 LoRA（2026-08-20 双平台分发，MODEL_MATRIX §6.1 同步）
        'lora_humanpose.safetensors',
      ].sort(),
    );
    const zimg = CATALOG_IMAGEGEN.find(m => m.id.includes('z-image'))!;
    expect(zimg.extras?.map(e => e.name).sort()).toEqual(
      ['zimage_llm.gguf', 'ae.safetensors'].sort(),
    );
    const dream = CATALOG_IMAGEGEN.find(m => m.id.includes('dreamlite'))!;
    expect(
      [dream.file.name, ...(dream.extras ?? []).map(e => e.name)].sort(),
    ).toEqual(
      [
        'unet_masked.onnx',
        'vae_decoder.onnx',
        'vae_encoder.onnx',
        'te_q8.gguf',
        'te_fp16.onnx',
        'te_fp16.onnx.data',
      ].sort(),
    );
    // Krea2 三件套（2026-08-26 准入，MASTER_LOG §96）
    const krea2 = CATALOG_IMAGEGEN.find(m => m.id.includes('krea2'))!;
    expect(krea2.extras?.map(e => e.name).sort()).toEqual(
      ['Qwen3VL-4B-Instruct-Q4_K_M.gguf', 'wan_2.1_vae.safetensors'].sort(),
    );
  });

  it('下载源显式声明：有源条目必有对应 repo；无源条目无 repo', () => {
    for (const entry of CATALOG_MODELS) {
      const sources = getAvailableSources(entry);
      for (const source of sources) {
        expect(repoForSource(entry, source)).toBeTruthy();
      }
      if (entry.sources.length === 0) {
        expect(entry.hfRepo).toBeUndefined();
        expect(entry.modelscopeRepo).toBeUndefined();
      }
    }
  });

  it('魔搭镜像实测结论（2026-08-20）：LFM×2/Ministral 双源，Qwen×2 仅 HF', () => {
    const byName = (n: string) =>
      CATALOG_LLM.find(m => m.file.name.includes(n))!;
    expect(byName('LFM2.5-2.6B').sources).toEqual(['hf', 'modelscope']);
    expect(byName('LFM2.5-2.6B').modelscopeRepo).toBe(
      'LiquidAI/LFM2.5-2.6B-GGUF',
    );
    expect(byName('LFM2.5-8B-A1B').sources).toEqual(['hf', 'modelscope']);
    expect(byName('LFM2.5-8B-A1B').modelscopeRepo).toBe(
      'LiquidAI/LFM2.5-8B-A1B-GGUF',
    );
    expect(byName('Ministral').sources).toEqual(['hf', 'modelscope']);
    expect(byName('Ministral').modelscopeRepo).toBe(
      'unsloth/Ministral-3-3B-Instruct-2512-GGUF',
    );
    // HauhauCS 魔搭 404 → 仅 HF（2026-08-20 前）；当日已由 zensignGG 账号镜像上传
    expect(byName('Qwen3.5-2B').sources).toEqual(['hf', 'modelscope']);
    expect(byName('Qwen3.5-2B').modelscopeRepo).toBe(
      'zensignGG/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-GGUF',
    );
    expect(byName('Qwen3.5-4B').sources).toEqual(['hf', 'modelscope']);
    expect(byName('Qwen3.5-4B').modelscopeRepo).toBe(
      'zensignGG/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-GGUF',
    );
    // MiniCPM 管家：HF 源已实锤（mradermacher Fable5-V2-Thinking-heretic，
    // GGUF 头部元数据对比 license/base_model 全同）；2026-08-20 魔搭镜像上传
    expect(byName('minicpm5').sources).toEqual(['hf', 'modelscope']);
    expect(byName('minicpm5').hfRepo).toBe(
      'mradermacher/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF',
    );
    expect(byName('minicpm5').modelscopeRepo).toBe(
      'zensignGG/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF',
    );
    // 远程名与本地落盘名不同（下载后改名）——remotePath 必须映射；
    // 魔搭镜像文件名 = 本地落盘名，需按源覆盖
    expect(byName('minicpm5').file.remotePath).toBe(
      'MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic.Q4_K_M.gguf',
    );
    expect(byName('minicpm5').file.remotePathBySource).toEqual({
      modelscope: 'minicpm5_1b_heretic_q4km.gguf',
    });
  });

  it('生图源：SD3.5/Z-Image 双源（跨仓套件 per-file 映射），DreamLite 无源', () => {
    const sd35 = CATALOG_IMAGEGEN.find(m => m.id.includes('sd35'))!;
    expect(sd35.sources).toEqual(['hf', 'modelscope']);
    expect(sd35.file.remotePath).toBe('sd3.5_medium-Q4_K_M.gguf');
    const clipL = sd35.extras?.find(f => f.name === 'sd35_clip_l.safetensors');
    expect(clipL?.remotePath).toBe('text_encoders/clip_l.safetensors');
    expect(clipL?.repoBySource?.modelscope).toBe(
      'AI-ModelScope/stable-diffusion-3.5-fp8',
    );
    const vae = sd35.extras?.find(f => f.name === 'sd35_vae.safetensors');
    expect(vae?.remotePath).toBe('vae/diffusion_pytorch_model.safetensors');
    // 自制 LoRA（2026-08-20 双平台分发）：manifest 的 lora 字段指向本文件；
    // baked/merged GGUF 不装机（大王钦定）——catalog 不建条目
    const lora = sd35.extras?.find(
      f => f.name === 'lora_humanpose.safetensors',
    );
    expect(lora).toBeDefined();
    expect(lora?.sizeBytes).toBe(83138888);
    expect(lora?.repoBySource).toEqual({
      hf: 'QDD110/SD35-HumanPose-LoRA',
      modelscope: 'zensignGG/SD35-HumanPose-LoRA',
    });
    expect(sd35.extras?.map(f => f.name)).not.toContain(
      'sd35_medium_humanpose_baked.gguf',
    );

    const zimg = CATALOG_IMAGEGEN.find(m => m.id.includes('z-image'))!;
    expect(zimg.sources).toEqual(['hf', 'modelscope']);
    expect(zimg.file.remotePath).toBe('z_image_turbo-Q4_K.gguf');
    const zllm = zimg.extras?.find(f => f.name === 'zimage_llm.gguf');
    // 文本塔仅魔搭源（HF 文件名不同未验证）——resolveFileSource 回退覆盖
    expect(zllm?.repoBySource).toEqual({modelscope: 'unsloth/Qwen3-4B-GGUF'});
    const ae = zimg.extras?.find(f => f.name === 'ae.safetensors');
    expect(ae?.remotePath).toBe('split_files/vae/ae.safetensors');

    const dream = CATALOG_IMAGEGEN.find(m => m.id.includes('dreamlite'))!;
    // 2026-08-20 自制 ONNX 套件双平台分发（魔搭 zensignGG + HF QDD110）→ 双源在线下载
    expect(dream.sources).toEqual(['hf', 'modelscope']);
    expect(dream.hfRepo).toBe('QDD110/DreamLite-mobile-ONNX');
    expect(dream.modelscopeRepo).toBe('zensignGG/DreamLite-mobile-ONNX');
  });

  it('id 全局唯一', () => {
    const ids = CATALOG_MODELS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('catalogEntryById / catalogEntryByFilename 命中', () => {
    const qwen = CATALOG_LLM[0];
    expect(catalogEntryById(qwen.id)?.id).toBe(qwen.id);
    expect(catalogEntryByFilename(qwen.file.name)?.id).toBe(qwen.id);
    expect(catalogEntryByFilename('nonexistent.gguf')).toBeUndefined();
  });

  it('catalogEntryTotalBytes 含 extras 总量', () => {
    const dream = CATALOG_IMAGEGEN.find(m => m.id.includes('dreamlite'))!;
    const extras = (dream.extras ?? []).reduce((s, f) => s + f.sizeBytes, 0);
    expect(catalogEntryTotalBytes(dream)).toBe(dream.file.sizeBytes + extras);
  });

  // §57 门禁补锁：生图页（manifest）与模型页（catalog）文件集一致性，防两处漂移
  it('BUILTIN_MANIFESTS 文件集 ⊆ CATALOG_IMAGEGEN 文件集（§57 防漂移锁）', () => {
    const catalogFiles = new Set(
      CATALOG_IMAGEGEN.flatMap(m => [
        m.file.name,
        ...(m.extras ?? []).map(f => f.name),
      ]),
    );
    expect(BUILTIN_MANIFESTS.length).toBeGreaterThan(0);
    for (const m of BUILTIN_MANIFESTS) {
      expect(catalogFiles.has(m.main)).toBe(true);
      for (const c of Object.values(m.companions ?? {})) {
        expect(catalogFiles.has(c)).toBe(true);
      }
    }
  });

  it('DREAMLITE_MANIFEST 与 catalog dreamlite 条目对齐（§57）', () => {
    const dream = CATALOG_IMAGEGEN.find(m => m.id.includes('dreamlite'))!;
    expect(DREAMLITE_MANIFEST.id).toBe('dreamlite');
    expect(DREAMLITE_MANIFEST.family).toBe('dreamlite');
    expect(dream.displayName).toBe(DREAMLITE_MANIFEST.label);
  });

  // §57 字节数快照锁：真机落盘文件大小 = catalog 声明（源文件逐字节验证过，
  // 防手滑改错 sizeBytes 导致存储守卫误判）
  it('LLM 主文件字节数快照（MODEL_MATRIX §6 真机逐字节验证）', () => {
    const byName = (n: string) =>
      CATALOG_LLM.find(m => m.file.name.includes(n))!;
    expect(byName('Qwen3.5-2B').file.sizeBytes).toBe(2012012000);
    expect(byName('Qwen3.5-4B').file.sizeBytes).toBe(2707513696);
    expect(byName('LFM2.5-2.6B').file.sizeBytes).toBe(1674454848);
    expect(byName('LFM2.5-8B-A1B').file.sizeBytes).toBe(5155564768);
    expect(byName('Ministral').file.sizeBytes).toBe(2146497824);
    expect(byName('minicpm5').file.sizeBytes).toBe(688066528);
  });
});
