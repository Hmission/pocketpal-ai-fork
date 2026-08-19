/**
 * estimatePreviewHeight 单测（2026-08-19 K90 血证：250px 硬编码截断
 * 300×300 游戏画面，卡片高度按板面自适应）。
 */
import {estimatePreviewHeight} from '../previewHeight';

describe('estimatePreviewHeight', () => {
  it('300px 板面 + 说明余量 → 520（K90 狸狸水滴贪吃蛇实录）', () => {
    const html = `<style>.snake-game { width: 300px; height: 300px; }</style>
<h1>狸狸水滴贪吃蛇</h1><div class="snake-game"></div>`;
    expect(estimatePreviewHeight(html)).toBe(520);
  });

  it('canvas 高度属性同样识别（height="400"）', () => {
    const html = '<canvas width="400" height="400"></canvas>';
    expect(estimatePreviewHeight(html)).toBe(560); // 400+220 钳到上限 560
  });

  it('无板面线索回退默认 480', () => {
    expect(estimatePreviewHeight('<p>hello</p>')).toBe(480);
  });

  it('忽略小于 200px 的小元素（按钮/眼珠不参与估算）', () => {
    const html = `<style>.btn { height: 40px; } .board { height: 260px; }</style>`;
    expect(estimatePreviewHeight(html)).toBe(480); // 260+220=480
  });

  it('超大板面钳到上限 560', () => {
    expect(estimatePreviewHeight('.g { height: 700px; }')).toBe(560);
  });
});
