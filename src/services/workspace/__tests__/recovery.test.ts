/**
 * workspace 恢复协议测试（WORKSPACE_SPEC v1，2026-08-21）
 */
import {
  parseProjectName,
  isWritingResumeIntent,
  resolveWritingRecovery,
  setPendingWorkspaceContext,
  consumePendingWorkspaceContext,
} from '../recovery';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn(async (p: string) => p in mem),
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async (p: string, content: string) => {
    mem[p] = content;
  }),
  readFile: jest.fn(async (p: string) => {
    if (!(p in mem)) {
      throw new Error('not found');
    }
    return mem[p];
  }),
  appendFile: jest.fn(async () => undefined),
  DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
  ExternalStorageDirectoryPath: '/sdcard',
  ExternalDirectoryPath: '/sdcard/Android/data/com.pocketpalai/files',
}));

const mem: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k]);
  setPendingWorkspaceContext(null);
});

describe('parseProjectName', () => {
  it('《X》优先提取', () => {
    expect(parseProjectName('继续写《星海》第三章')).toBe('星海');
    expect(parseProjectName('写作项目：我的回忆录')).toBe('我的回忆录');
  });
  it('无书名号剥意图词取剩余', () => {
    expect(parseProjectName('续写我的小说')).toBe('我的小说');
    expect(parseProjectName('新建写作项目：星海')).toBe('星海');
  });
  it('无项目名返回 null', () => {
    expect(parseProjectName('你好')).toBeNull();
  });
});

describe('isWritingResumeIntent', () => {
  it('续写/建项意图判定', () => {
    expect(isWritingResumeIntent('继续写《星海》')).toBe(true);
    expect(isWritingResumeIntent('写作项目：X')).toBe(true);
    expect(isWritingResumeIntent('给我写一首诗')).toBe(false);
  });
});

describe('resolveWritingRecovery', () => {
  it('项目命中 → 框架文档组装（大纲 + 人设）', async () => {
    const base = '/data/user/0/com.pocketpalai/files/workspace/writing/星海';
    mem[`${base}/大纲.md`] = '# 《星海》大纲\n\n## 主线\n寻星之旅';
    mem[`${base}/人设.md`] = '# 《星海》人设\n\n## 主要角色\n阿星';
    mem[
      '/data/user/0/com.pocketpalai/files/workspace/writing/index.json'
    ] = JSON.stringify([
      {name: '星海', path: '星海', updatedAt: 1, progress: '已写 2 章'},
    ]);
    const recovery = await resolveWritingRecovery('继续写《星海》');
    expect(recovery).not.toBeNull();
    expect(recovery?.project).toBe('星海');
    expect(recovery?.frameworkText).toContain('寻星之旅');
    expect(recovery?.frameworkText).toContain('阿星');
    expect(recovery?.frameworkText).toContain('已写 2 章');
    expect(recovery?.frameworkText).toContain('read_section');
  });

  it('项目未命中 → null（静默放行）', async () => {
    expect(await resolveWritingRecovery('继续写《不存在》')).toBeNull();
  });
});

describe('pending 单次消费', () => {
  it('set → consume 取走并清空', () => {
    setPendingWorkspaceContext({
      domain: 'writing',
      project: 'X',
      frameworkText: 'f',
    });
    expect(consumePendingWorkspaceContext()?.project).toBe('X');
    expect(consumePendingWorkspaceContext()).toBeNull();
  });
});
