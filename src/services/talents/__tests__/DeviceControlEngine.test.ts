import {DeviceControlEngine} from '../DeviceControlEngine';
import {readScreen, SCREEN_READER_DISABLED} from '../../../utils/screenReader';

jest.mock('../../../utils/screenReader', () => ({
  readScreen: jest.fn(),
  SCREEN_READER_DISABLED: 'SCREEN_READER_DISABLED',
  isScreenReaderEnabled: jest.fn(),
  openAccessibilitySettings: jest.fn(),
}));

describe('DeviceControlEngine（P11 读屏围观，SCREENWATCH_SPEC v1）', () => {
  const engine = new DeviceControlEngine();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('read_screen 成功：返回精简树并引导围观点评', async () => {
    (readScreen as jest.Mock).mockResolvedValue(
      '[window] com.tencent.mm\n[TextView] 张三大哥\n[Button] 发送',
    );
    const result = await engine.execute({action: 'read_screen'});
    expect(result.type).toBe('text');
    expect(result.summary).toContain('com.tencent.mm');
    expect(result.summary).toContain('点评');
    expect(result.summary).not.toContain('点击'); // 不指挥操作
  });

  it('find_app 命中：返回匹配元素', async () => {
    (readScreen as jest.Mock).mockResolvedValue(
      '[window] com.taobao.taobao\n[TextView] 搜索\n[Button] 购物车',
    );
    const result = await engine.execute({
      action: 'find_app',
      target: '购物车',
    });
    expect(result.type).toBe('text');
    expect(result.summary).toContain('找到匹配「购物车」');
  });

  it('find_app 未命中：返回屏幕内容', async () => {
    (readScreen as jest.Mock).mockResolvedValue(
      '[window] com.taobao.taobao\n[TextView] 搜索',
    );
    const result = await engine.execute({
      action: 'find_app',
      target: '不存在的东西',
    });
    expect(result.type).toBe('text');
    expect(result.summary).toContain('未找到');
  });

  it('读屏服务未开启：显式返回授权引导（不静默）', async () => {
    (readScreen as jest.Mock).mockRejectedValue({
      code: SCREEN_READER_DISABLED,
    });
    const result = await engine.execute({action: 'read_screen'});
    expect(result.type).toBe('error');
    expect(result.summary).toContain('无障碍');
  });

  it('未知动作：显式错误（tap/scroll 已从枚举移除，执行层也拒绝）', async () => {
    const result = await engine.execute({action: 'tap', x: 100, y: 200});
    if (result.type !== 'error') {
      throw new Error('expected error result');
    }
    expect(result.errorMessage).toContain('Unknown action');
    expect(readScreen).not.toHaveBeenCalled();
  });

  it('ToolDefinition 只暴露 read_screen / find_app（无任何写操作枚举）', () => {
    const def = engine.toToolDefinition();
    const enums = (def.function.parameters.properties.action as any).enum;
    expect(enums).toEqual(['read_screen', 'find_app']);
    expect(enums).not.toContain('tap');
    expect(enums).not.toContain('input_text');
    expect(enums).not.toContain('scroll');
    expect(def.function.description).toContain('只读');
  });

  it('systemPromptFragment 注入围观人设（onlooker，禁止指挥操作）', () => {
    const frag = engine.systemPromptFragment!({
      now: new Date(),
      maxToolTurns: 5,
      activeTalents: new Set(['device_control']),
    });
    expect(frag).toContain('ONLOOKER');
    expect(frag).toContain('NEVER instruct');
  });
});
