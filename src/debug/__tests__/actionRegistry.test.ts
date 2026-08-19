/**
 * actionRegistry 契约测试：白名单 / 未知拒绝 / zod 校验 / 单槽依赖。
 * 覆盖铁律：BT05（向前兼容，actionId 语义稳定）。
 */
import {
  executeAction,
  registerChatSender,
  registerNavSlot,
  __drcSlotsForTest,
} from '../actionRegistry';

describe('actionRegistry', () => {
  afterEach(() => {
    registerNavSlot(null);
    registerChatSender(null);
  });

  it('未知 actionId 显式拒绝', async () => {
    await expect(
      executeAction('no.such.action', {}),
    ).rejects.toThrow('未知 actionId');
  });

  it('system.ping 返回 pong', async () => {
    const data = await executeAction('system.ping', {});
    expect(data).toMatchObject({pong: true});
  });

  it('nav.go 无导航槽时显式报错（指南针提示）', async () => {
    await expect(
      executeAction('nav.go', {route: 'Chat'}),
    ).rejects.toThrow('导航槽未注册');
  });

  it('nav.go 参数过 zod 校验：非法 route 拒绝', async () => {
    registerNavSlot(() => {});
    await expect(
      executeAction('nav.go', {route: 'NotARoute'}),
    ).rejects.toThrow();
  });

  it('chat.send 无聊天槽时显式报错', async () => {
    await expect(
      executeAction('chat.send', {text: 'hi'}),
    ).rejects.toThrow('聊天发送槽未注册');
  });

  it('chat.send 参数校验：空文本拒绝', async () => {
    registerChatSender(async () => {});
    await expect(executeAction('chat.send', {text: ''})).rejects.toThrow();
  });

  it('chat.send 有槽位时执行成功', async () => {
    const sent: string[] = [];
    registerChatSender(async message => {
      sent.push(message.text);
    });
    const data = await executeAction('chat.send', {text: '你好'});
    expect(data).toMatchObject({sent: true, text: '你好'});
    expect(sent).toEqual(['你好']);
  });

  it('槽位注册状态可查询（测试辅助）', () => {
    expect(__drcSlotsForTest()).toEqual({nav: false, chat: false});
    registerNavSlot(() => {});
    expect(__drcSlotsForTest().nav).toBe(true);
  });

  it('imagegen.generate 未加载模型时显式报错', async () => {
    await expect(
      executeAction('imagegen.generate', {prompt: 'apple'}),
    ).rejects.toThrow('生图模型未加载');
  });

  it('models.load 未知 modelId 显式报错并列出可用', async () => {
    await expect(
      executeAction('models.load', {modelId: 'no-such-model'}),
    ).rejects.toThrow('未找到模型 no-such-model');
  });

  it('models.load 参数校验：空 modelId 拒绝', async () => {
    await expect(
      executeAction('models.load', {modelId: ''}),
    ).rejects.toThrow();
  });

  it('chat.newSession 创建会话成功', async () => {
    const data = await executeAction('chat.newSession', {title: 'DRC 测试'});
    expect(data).toMatchObject({created: true, title: 'DRC 测试'});
  });

  it('system.events 事件流不存在时返回空列表 + 提示', async () => {
    // mock readFile 抛错模拟事件流不存在
    const fsMock = require('@dr.pogodin/react-native-fs') as {
      readFile: jest.Mock;
    };
    fsMock.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    const data = await executeAction('system.events', {last: 5});
    expect(data).toMatchObject({events: []});
    expect((data as any).note).toContain('事件流不存在');
  });

  it('system.events 参数校验：last 越界拒绝', async () => {
    await expect(
      executeAction('system.events', {last: 1000}),
    ).rejects.toThrow();
  });

  it('imagegen.generateDreamLite 参数校验：空 prompt 拒绝', async () => {
    await expect(
      executeAction('imagegen.generateDreamLite', {prompt: ''}),
    ).rejects.toThrow();
  });
});
