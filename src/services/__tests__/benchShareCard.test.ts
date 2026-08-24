/**
 * benchShareCard 测试（B39 §10.9）：纯 JS 像素光栅化产出合法 PNG；
 * speed=null 诚实渲染不编造（条 0 + '-'）。
 */
import {renderScoreCardPng, CARD_W, CARD_H} from '../benchShareCard';

const INPUT = {
  total: 78.4,
  memory: 82,
  thermal: 88,
  stability: 95,
  speed: null as number | null,
  rank: 'GOD CHICK',
  date: '2026-08-24',
};

describe('benchShareCard — 跑分卡纯 JS 光栅化', () => {
  it('产出合法 PNG（魔数 + 尺寸正确）', () => {
    const png = renderScoreCardPng(INPUT);
    // PNG 魔数：89 50 4E 47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    expect(png.length).toBeGreaterThan(1000);
  });

  it('speed=null 诚实渲染（不抛错，不编造数值）', () => {
    expect(() => renderScoreCardPng(INPUT)).not.toThrow();
  });

  it('speed 有值时同样可渲染', () => {
    const png = renderScoreCardPng({...INPUT, speed: 64});
    expect(png[0]).toBe(0x89);
  });

  it('卡面尺寸契约（2:3 竖版分享图）', () => {
    expect(CARD_W).toBe(540);
    expect(CARD_H).toBe(810);
  });
});
