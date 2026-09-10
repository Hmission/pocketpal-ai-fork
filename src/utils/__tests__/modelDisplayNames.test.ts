import {
  getModelDisplayName,
  getModelDisplayNameWithParams,
  getModelParamTag,
  isChatSelectable,
} from '../modelDisplayNames';
import {ModelOrigin, ModelType} from '../types';

const model = (name: string, extra: Partial<{filename: string}> = {}) => ({
  name,
  filename: extra.filename ?? `${name}.gguf`,
  modelType: ModelType.LLM,
});

describe('modelDisplayNames', () => {
  describe('getModelDisplayName', () => {
    it('命中注册表返回中文简称', () => {
      expect(getModelDisplayName(model('MiniCPM4-4B-Q4_K_M'))).toBe(
        '面壁 MiniCPM',
      );
      expect(getModelDisplayName(model('qwen3.5-2b'))).toBe('通义千问 2B');
    });

    it('未命中回落去量化后缀的族名', () => {
      expect(getModelDisplayName(model('SomeModel-7B-Q5_K_S'))).toBe(
        'SomeModel-7B',
      );
    });
  });

  describe('getModelParamTag', () => {
    it('提取参数量与量化档：4B + Q4 → （4B_Q4）', () => {
      expect(getModelParamTag(model('MiniCPM4-4B-Q4_K_M'))).toBe('（4B_Q4）');
    });

    it('提取小数量化：Q5 → （4B_Q5）', () => {
      expect(getModelParamTag(model('qwen3.5-4b-q5_k_m'))).toBe('（4B_Q5）');
    });

    it('小数参数量保留：2.6B', () => {
      expect(getModelParamTag(model('lfm2.5-2.6b-q4_k_m'))).toBe('（2.6B_Q4）');
    });

    it('F16 量化档：不显式带 Q 也识别', () => {
      expect(getModelParamTag(model('SomeModel-8B-F16'))).toBe('（8B_F16）');
    });

    it('无参数无量化返回空串', () => {
      expect(getModelParamTag(model('SomeModel'))).toBe('');
    });

    it('MiniCPM 家族后缀数字即参数量（无 b 后缀）', () => {
      expect(getModelParamTag(model('MiniCPM4-Q4_K_M'))).toBe('（4B_Q4）');
    });

    it('真机管家文件名下划线分隔：minicpm5_1b → 1B 而非系列号 5B', () => {
      // 回归锁定：1b 后跟 _ 时 \b 边界失配会落入 fam 兜底误显示 5B
      expect(getModelParamTag(model('minicpm5_1b_heretic_q4km'))).toBe(
        '（1B_Q4）',
      );
    });
  });

  describe('getModelDisplayNameWithParams', () => {
    it('组合简称与参数：面壁 MiniCPM（4B_Q4）', () => {
      expect(getModelDisplayNameWithParams(model('MiniCPM4-4B-Q4_K_M'))).toBe(
        '面壁 MiniCPM（4B_Q4）',
      );
    });

    it('无参数量时仅简称+量化', () => {
      expect(getModelDisplayNameWithParams(model('SomeModel'))).toBe(
        'SomeModel',
      );
      expect(getModelDisplayNameWithParams(model('MiniCPM4'))).toBe(
        '面壁 MiniCPM（4B）',
      );
    });

    it('真机管家文件名完整显示：面壁 MiniCPM（1B_Q4）', () => {
      expect(
        getModelDisplayNameWithParams(model('minicpm5_1b_heretic_q4km')),
      ).toBe('面壁 MiniCPM（1B_Q4）');
    });
  });

  describe('isChatSelectable', () => {
    it('仅 LLM 且非生图 manifest 文件可选', () => {
      expect(isChatSelectable(model('MiniCPM4-4B-Q4_K_M'))).toBe(true);
    });

    it('非 LLM（vision 嵌入）不可选', () => {
      expect(
        isChatSelectable({
          ...model('SomeVision'),
          modelType: ModelType.VISION,
        }),
      ).toBe(false);
    });

    it('非 GGUF（生图 safetensors checkpoint）不可选（B18 单规则收口）', () => {
      expect(
        isChatSelectable(
          model('sd35', {filename: 'sd35_medium_humanpose_baked.safetensors'}),
        ),
      ).toBe(false);
    });

    it('GGUF 容器但属生图工件（manifest 名单）不可选', () => {
      expect(
        isChatSelectable(
          model('sd35baked', {filename: 'sd35_medium_humanpose_baked.gguf'}),
        ),
      ).toBe(false);
    });

    // §177.7：远端模型（createRemoteModel 造）filename='' + origin=REMOTE + modelType=LLM
    // → isChatSelectable 放行（:169 REMOTE 分支：filename 空则 true）。此前 createRemoteModel
    // 漏设 modelType 使远端模型卡在 :165，本两条钉住 REMOTE 放行分支不再是死码。
    it('远端 LLM（origin=REMOTE、filename 空、modelType=LLM）可选（§177.7 REMOTE 放行）', () => {
      expect(
        isChatSelectable({
          filename: '',
          modelType: ModelType.LLM,
          origin: ModelOrigin.REMOTE,
        }),
      ).toBe(true);
    });

    it('远端但 modelType 缺失则不可选（§177.7 bug 现场反证）', () => {
      expect(
        isChatSelectable({
          filename: '',
          origin: ModelOrigin.REMOTE,
        }),
      ).toBe(false);
    });
  });
});
