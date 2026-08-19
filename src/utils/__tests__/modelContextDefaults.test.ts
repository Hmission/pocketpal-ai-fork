/**
 * 每模型默认上下文策展表测试（2026-08-19 大王裁定）。
 */
import {defaultNCtxForModel} from '../modelContextDefaults';

describe('defaultNCtxForModel', () => {
  it('规则表命中优先于尺寸档', () => {
    expect(
      defaultNCtxForModel({
        filename: 'Ministral-3-3B-Instruct-2512-Q4_K_M.gguf',
        name: 'Ministral 3B',
        size: 2.2e9,
      }),
    ).toBe(8192);
    expect(
      defaultNCtxForModel({
        filename: 'minicpm5_1b_heretic_q4km.gguf',
        name: '管家 MiniCPM 1B',
        size: 0.8e9,
      }),
    ).toBe(8192);
  });

  it('4B 级规则命中 16384', () => {
    expect(
      defaultNCtxForModel({
        filename: 'Qwen3.5-4B-Uncensored-Q4_K_M.gguf',
        name: '通义千问 4B',
        size: 2.7e9,
      }),
    ).toBe(16384);
    expect(
      defaultNCtxForModel({
        filename: 'LFM2.5-8B-A1B-Q4_K_M.gguf',
        name: 'LFM 8B',
        size: 5e9,
      }),
    ).toBe(12288);
  });

  it('未命中规则按尺寸分档', () => {
    expect(defaultNCtxForModel({filename: 'a.gguf', name: 'A', size: 1e9})).toBe(
      8192,
    );
    expect(defaultNCtxForModel({filename: 'b.gguf', name: 'B', size: 3e9})).toBe(
      16384,
    );
    expect(defaultNCtxForModel({filename: 'c.gguf', name: 'C', size: 6e9})).toBe(
      8192,
    );
  });

  it('size 缺失保守 8192', () => {
    expect(defaultNCtxForModel({filename: 'd.gguf', name: 'D'})).toBe(8192);
  });
});
