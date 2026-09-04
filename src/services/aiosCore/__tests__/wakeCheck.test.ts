/**
 * wakeCheck 单测（AIOS_CORE_SPEC Wave A/B）：三层自检 + 门禁会话锚
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  wakeCheck,
  writeSessionAnchor,
  isAnchorFresh,
  IDENTITY_ANCHOR_PHRASE,
  ensureGrowthDir,
} from '../wakeCheck';
import {
  AIOS_IDENTITY_FILE,
  AIOS_WORKSPACE_MEMORY_DIR,
  AIOS_MEMORIES_DIR,
  AIOS_DB_DIR,
  AIOS_SESSION_ANCHOR,
} from '../../../utils/paths';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  DocumentDirectoryPath: '/mock/documents',
  ExternalStorageDirectoryPath: '/mock/storage',
}));

jest.mock('../../../debug/eventStream', () => ({
  emit: jest.fn(),
}));

describe('wakeCheck（AIOS_CORE_SPEC Wave A）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('');
  });

  it('首装：IDENTITY.md 缺失 → 重建种子并留痕（identity_reborn）', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (p: string) => {
      if (p === AIOS_IDENTITY_FILE) {
        return false;
      }
      // 健康目录齐整，回溯缺失
      return (
        p === AIOS_WORKSPACE_MEMORY_DIR ||
        p === AIOS_MEMORIES_DIR ||
        p === AIOS_DB_DIR
      );
    });
    const result = await wakeCheck();
    expect(result.identity).toBe(true);
    expect(result.health).toBe(true);
    expect(result.lineage).toBe(false);
    // 种子写入含锚句
    const written = (RNFS.writeFile as jest.Mock).mock.calls.find(
      c => c[0] === AIOS_IDENTITY_FILE,
    );
    expect(written).toBeTruthy();
    expect(String(written![1])).toContain(IDENTITY_ANCHOR_PHRASE);
    // anomaly 留痕（重建事件）
    const anomaly = (RNFS.appendFile as jest.Mock).mock.calls.some(c =>
      String(c[1]).includes('identity_reborn'),
    );
    expect(anomaly).toBe(true);
  });

  it('IDENTITY.md 存在且含锚句 → identity true 且不重写', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (p: string) => {
      if (p === AIOS_IDENTITY_FILE) {
        return true;
      }
      return (
        p === AIOS_WORKSPACE_MEMORY_DIR ||
        p === AIOS_MEMORIES_DIR ||
        p === AIOS_DB_DIR
      );
    });
    (RNFS.readFile as jest.Mock).mockImplementation(async (p: string) => {
      if (p === AIOS_IDENTITY_FILE) {
        return `# 女妖 · 身份锚\n\n> ${IDENTITY_ANCHOR_PHRASE}\n`;
      }
      return '';
    });
    const result = await wakeCheck();
    expect(result.identity).toBe(true);
    const rewrote = (RNFS.writeFile as jest.Mock).mock.calls.some(
      c => c[0] === AIOS_IDENTITY_FILE,
    );
    expect(rewrote).toBe(false);
  });

  it('IDENTITY.md 存在但缺锚句 → identity false 并列入 missing', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (p: string) => {
      if (p === AIOS_IDENTITY_FILE) {
        return true;
      }
      return (
        p === AIOS_WORKSPACE_MEMORY_DIR ||
        p === AIOS_MEMORIES_DIR ||
        p === AIOS_DB_DIR
      );
    });
    (RNFS.readFile as jest.Mock).mockResolvedValue('# 被篡改的文件\n');
    const result = await wakeCheck();
    expect(result.identity).toBe(false);
    expect(result.missing.join()).toContain('锚句缺失');
  });

  it('目录缺失 → health false 且 anomaly 留痕', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (p: string) => {
      if (p === AIOS_IDENTITY_FILE) {
        return true;
      }
      return p === AIOS_WORKSPACE_MEMORY_DIR; // memories/db 缺失
    });
    (RNFS.readFile as jest.Mock).mockResolvedValue(IDENTITY_ANCHOR_PHRASE);
    const result = await wakeCheck();
    expect(result.health).toBe(false);
    expect(result.incomplete).toBe(true);
  });
});

describe('门禁会话锚（AIOS_CORE_SPEC Wave B）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writeSessionAnchor 写入合法 JSON', async () => {
    await writeSessionAnchor();
    const call = (RNFS.writeFile as jest.Mock).mock.calls.find(
      c => c[0] === AIOS_SESSION_ANCHOR,
    );
    expect(call).toBeTruthy();
    const parsed = JSON.parse(String(call![1]));
    expect(typeof parsed.epoch).toBe('number');
  });

  it('anchor 缺失/过期 → isAnchorFresh false；新鲜 → true', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    await expect(isAnchorFresh()).resolves.toBe(false);

    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({epoch: Date.now() - 60_000}),
    );
    await expect(isAnchorFresh()).resolves.toBe(true);

    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({epoch: Date.now() - 7200_000}),
    );
    await expect(isAnchorFresh()).resolves.toBe(false);
  });
});

describe('ensureGrowthDir（Wave D 地基）', () => {
  it('缺失则 mkdir', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    await ensureGrowthDir();
    expect(RNFS.mkdir).toHaveBeenCalled();
  });

  it('已在场则不 mkdir', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    await ensureGrowthDir();
    expect(RNFS.mkdir).not.toHaveBeenCalled();
  });
});
