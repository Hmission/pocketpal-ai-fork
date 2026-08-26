import {isParrotingExample} from '../promptWriter';

// 鹦鹉学舌检测闸（08-27 修复）：1B 管家短输入时复述 system 示例（海边美女）
// 而非扩写真实主题 → 检测闸拦截复读，显式失败回退原文（不静默污染出图）。
describe('isParrotingExample', () => {
  const EXAMPLE =
    'a young woman walking along a sunlit beach at sunset, long flowing dress ' +
    'moving in the breeze, gentle waves washing the shore, warm golden light, ' +
    'soft bokeh, cinematic wide shot, photorealistic, masterpiece, best quality, ' +
    'highly detailed';

  it('原样复述示例 → 判定复读', () => {
    expect(isParrotingExample(EXAMPLE)).toBe(true);
  });

  it('复读带少量前后缀噪声 → 判定复读', () => {
    expect(isParrotingExample(`Sure! Here is the prompt: ${EXAMPLE}`)).toBe(
      true,
    );
  });

  it('正常扩写「一个苹果」→ 不误伤', () => {
    expect(
      isParrotingExample(
        'a shiny red apple resting on a rustic wooden table, morning sunlight ' +
          'streaming through a window, dew drops on the skin, macro close-up ' +
          'shot, shallow depth of field, photorealistic, masterpiece, best quality',
      ),
    ).toBe(false);
  });

  it('同主题（海边）但独立改写 → 不误伤（词重合低于阈值）', () => {
    expect(
      isParrotingExample(
        'a beautiful girl standing by the sea at dawn, white skirt flowing, ' +
          'seagulls in the sky, turquoise water, soft morning glow, wide angle, ' +
          'photorealistic, masterpiece, best quality, highly detailed',
      ),
    ).toBe(false);
  });

  it('过短输出不判定（短输出由空值路径处理）', () => {
    expect(isParrotingExample('apple')).toBe(false);
    expect(isParrotingExample('')).toBe(false);
  });
});
