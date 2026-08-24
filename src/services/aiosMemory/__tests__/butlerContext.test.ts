/**
 * buildButlerContext 单测（L1 记忆读侧闭环，2026-08-21）：
 * 组装顺序 = 今日状态 → 记忆碎片 → 召回片段 → 意图语气；
 * 来源为空 → 自然跳过（文件即过期公理，不加兜底）。
 */
import {buildButlerContext} from '../butlerContext';
import {buildTodayState, intentGuidance} from '../rituals';
import {buildMemoryFragment} from '../index';
import {searchMemory} from '../searchEngine';

jest.mock('../rituals', () => ({
  buildTodayState: jest.fn(),
  intentGuidance: jest.fn(),
}));
jest.mock('../index', () => ({
  buildMemoryFragment: jest.fn(),
}));
jest.mock('../searchEngine', () => ({
  searchMemory: jest.fn(),
  // 三闸·闸2（2026-08-23）：召回免责前缀真实值，验证消费方拼接语义
  RECALL_DISCLAIMER:
    '【召回的历史片段】(以下是历史记录，可能已过时，仅作背景参考，不得当作当前事实):',
}));

const mockToday = buildTodayState as jest.Mock;
const mockFragment = buildMemoryFragment as jest.Mock;
const mockSearch = searchMemory as jest.Mock;
const mockGuidance = intentGuidance as jest.Mock;

describe('buildButlerContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToday.mockResolvedValue('【今日状态】2026-08-21 星期五');
    mockFragment.mockResolvedValue('【你对大王的记忆】\n- [fact] 大王喜欢青色');
    mockSearch.mockResolvedValue(['[conversation:2026-08-20] 大王: 项目进度…']);
    mockGuidance.mockReturnValue('【当前状态：闲聊】轻松自然');
  });

  it('四来源齐备：按 今日状态→记忆→召回→意图语气 顺序组装', async () => {
    const ctx = await buildButlerContext('还记得我上次说的吗', 'chat');
    expect(ctx).toContain('【今日状态】2026-08-21 星期五');
    expect(ctx).toContain('【你对大王的记忆】');
    expect(ctx).toContain('【召回的历史片段】');
    // 三闸·闸2：召回前缀含时效免责语义（历史可能已过时，不得当作当前事实）
    expect(ctx).toContain('可能已过时');
    expect(ctx).toContain('不得当作当前事实');
    expect(ctx).toContain('【当前状态：闲聊】');
    expect(ctx.indexOf('今日状态')).toBeLessThan(ctx.indexOf('你对大王的记忆'));
    expect(ctx.indexOf('你对大王的记忆')).toBeLessThan(
      ctx.indexOf('召回的历史片段'),
    );
    expect(ctx.indexOf('召回的历史片段')).toBeLessThan(ctx.indexOf('当前状态'));
    expect(mockFragment).toHaveBeenCalledWith('还记得我上次说的吗', 'chat');
    expect(mockSearch).toHaveBeenCalledWith('还记得我上次说的吗', 3);
  });

  it('来源为空：自然跳过对应片段，不产生空段', async () => {
    mockToday.mockResolvedValue('');
    mockFragment.mockResolvedValue('');
    mockSearch.mockResolvedValue([]);
    const ctx = await buildButlerContext('随便聊聊', 'chat');
    expect(ctx).toBe('【当前状态：闲聊】轻松自然');
  });

  it('全部为空：返回空串（记忆系统无数据时不注入）', async () => {
    mockToday.mockResolvedValue('');
    mockFragment.mockResolvedValue('');
    mockSearch.mockResolvedValue([]);
    mockGuidance.mockReturnValue('');
    const ctx = await buildButlerContext('随便聊聊', 'chat');
    expect(ctx).toBe('');
  });
});
