/**
 * A2 任务驱动工具裁剪单测：
 * - chitchat 常驻轻工具（datetime/calculate/note_save/search_memory）；
 * - 重量工具按显式唤起词补注入；
 * - G3-3 星图定界：任务会话（write/code/play/adventure）裁剪至域相关工具子集；
 * - 保序、幂等。
 */
import {resolveGatedTalentNames, CHITCHAT_LIGHT_TOOLS} from '../taskGating';

const AIOS_11_TOOLS = [
  'web_search',
  'read_url',
  'calculate',
  'datetime',
  'render_html',
  'search_memory',
  'note_save',
  'device_control',
  'adventure_state',
  'read_html',
  'writing_doc',
];

describe('resolveGatedTalentNames（A2 任务驱动工具裁剪）', () => {
  it('chitchat 纯闲聊 → 仅常驻轻工具', () => {
    const gated = resolveGatedTalentNames(
      '今天天气不错，你觉得呢',
      AIOS_11_TOOLS,
    );
    expect(gated).toEqual([
      'calculate',
      'datetime',
      'search_memory',
      'note_save',
    ]);
    // 集合等价于常驻轻工具集（顺序不由常量定义序保证，保序以输入序为准）
    expect(new Set(gated)).toEqual(new Set(CHITCHAT_LIGHT_TOOLS));
  });

  it('chitchat 常驻工具保持输入序（顺序稳定，trigger marker 缓存友好）', () => {
    const gated = resolveGatedTalentNames('随便聊聊', [
      'note_save',
      'calculate',
      'datetime',
      'search_memory',
    ]);
    expect(gated).toEqual([
      'note_save',
      'calculate',
      'datetime',
      'search_memory',
    ]);
  });

  it('重量工具不在 pact 内则不会凭空出现（裁剪不出能力）', () => {
    const gated = resolveGatedTalentNames('帮我搜一下最近的新闻', [
      'datetime',
      'calculate',
    ]);
    expect(gated).toEqual(['datetime', 'calculate']);
  });

  it('显式唤起 web_search/read_url（搜索意图词）', () => {
    const gated = resolveGatedTalentNames(
      '帮我搜一下今天的天气',
      AIOS_11_TOOLS,
    );
    expect(gated).toContain('web_search');
    expect(gated).toContain('read_url');
    expect(gated).not.toContain('device_control');
    expect(gated).not.toContain('writing_doc');
  });

  it('显式唤起 device_control（设备控制意图词）', () => {
    const gated = resolveGatedTalentNames('帮我把音量调高一点', AIOS_11_TOOLS);
    expect(gated).toContain('device_control');
    expect(gated).not.toContain('web_search');
  });

  it('显式唤起 writing_doc（写作意图词，未命中 write 任务路由）', () => {
    const gated = resolveGatedTalentNames('我想写点东西练练手', AIOS_11_TOOLS);
    expect(gated).toContain('writing_doc');
  });

  it('显式唤起 render_html/read_html（出卡意图词）', () => {
    const gated = resolveGatedTalentNames('做一个倒计时卡片', AIOS_11_TOOLS);
    expect(gated).toContain('render_html');
    expect(gated).toContain('read_html');
  });

  it('多意图叠加：搜索 + 写作同时命中', () => {
    const gated = resolveGatedTalentNames(
      '帮我查一下天气，顺便把结论写下来',
      AIOS_11_TOOLS,
    );
    expect(gated).toContain('web_search');
    expect(gated).toContain('writing_doc');
  });

  it('write 任务会话 → G3-3 星图定界：裁剪至写作域相关工具子集', () => {
    const gated = resolveGatedTalentNames(
      '帮我写一篇关于旅行的文章',
      AIOS_11_TOOLS,
    );
    // write scope = ['writing_doc', 'read_html', 'web_search', 'search_memory', 'note_save']
    // 保留 AIOS_11_TOOLS 顺序，取交集
    expect(gated).toEqual([
      'web_search',
      'search_memory',
      'note_save',
      'read_html',
      'writing_doc',
    ]);
  });

  it('code 任务会话 → G3-3 星图定界：裁剪至代码域工具子集', () => {
    const gated = resolveGatedTalentNames(
      '帮我写一个排序算法代码',
      AIOS_11_TOOLS,
    );
    // code scope = ['render_html', 'read_html', 'calculate']
    expect(gated).toEqual(['calculate', 'render_html', 'read_html']);
  });

  it('play 任务会话 → G3-3 星图定界：裁剪至玩具域工具子集', () => {
    const gated = resolveGatedTalentNames('做个贪吃蛇游戏', AIOS_11_TOOLS);
    // play scope = ['render_html', 'read_html']
    expect(gated).toEqual(['render_html', 'read_html']);
  });

  it('adventure 任务会话 → G3-3 星图定界：裁剪至冒险域工具子集', () => {
    const gated = resolveGatedTalentNames('来场冒险，我是城主', AIOS_11_TOOLS);
    // adventure scope = ['adventure_state', 'search_memory']
    expect(gated).toEqual(['search_memory', 'adventure_state']);
  });

  it('空输入 → 空输出（无工具场景安全）', () => {
    expect(resolveGatedTalentNames('你好', [])).toEqual([]);
  });
});
