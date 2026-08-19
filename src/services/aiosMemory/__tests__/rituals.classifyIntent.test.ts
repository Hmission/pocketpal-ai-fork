/**
 * classifyIntent 意图状态机词表测试（CHAT_UI_SPEC §18.1）。
 *
 * 2026-08-19 K90 血证：「做个玩具：贪吃蛇」曾因缺玩具词表落 'chat'，
 * 「轻松自然简短俏皮」引导压过玩具匠触发令，3B 角色扮演不调 render_html。
 * 玩法请求必须归 'task'（「需要工具就调用工具」引导与工具触发令同向）。
 */
import {classifyIntent} from '../rituals';

describe('classifyIntent', () => {
  it('空文本归 chat', () => {
    expect(classifyIntent('')).toBe('chat');
    expect(classifyIntent('   ')).toBe('chat');
  });

  it('倾诉词优先', () => {
    expect(classifyIntent('今天好烦啊')).toBe('vent');
  });

  it('玩具工坊请求归 task（K90 血证修复）', () => {
    expect(classifyIntent('做个玩具：贪吃蛇')).toBe('task');
    expect(classifyIntent('来个小游戏玩')).toBe('task');
    expect(classifyIntent('把贪吃蛇做出来')).toBe('task');
  });

  it('冒险请求归 task', () => {
    expect(classifyIntent('来场冒险：地牢')).toBe('task');
  });

  it('问答归 qa', () => {
    expect(classifyIntent('今天星期几？')).toBe('qa');
  });

  it('日常闲聊归 chat', () => {
    expect(classifyIntent('你好呀')).toBe('chat');
  });
});
