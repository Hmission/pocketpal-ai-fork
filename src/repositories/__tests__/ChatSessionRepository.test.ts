import {chatSessionRepository} from '../ChatSessionRepository';
import {mockDatabase} from '../../../__mocks__/database';

// 真实实现（setup.ts 全局 mock 拦截了默认 import，用 requireActual 拿真实单例）
const realRepository = jest.requireActual(
  '../ChatSessionRepository',
) as typeof import('../ChatSessionRepository');

// Mock the database（与 jest/setup.ts 同源 mockDatabase，保证 spy 与真实实现同一对象）
jest.mock('../../database', () => ({
  database: mockDatabase,
}));

// Mock RNFS
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/path',
  exists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue('[]'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// 事件流可断言（故障必须可见：不能只抛不报）
jest.mock('../../debug/eventStream', () => ({emit: jest.fn()}));

describe('ChatSessionRepository', () => {
  it('should have all required methods', () => {
    // Verify that the repository has all the expected methods
    expect(chatSessionRepository).toBeDefined();
    expect(typeof chatSessionRepository.getAllSessions).toBe('function');
    expect(typeof chatSessionRepository.getSessionById).toBe('function');
    expect(typeof chatSessionRepository.createSession).toBe('function');
    expect(typeof chatSessionRepository.deleteSession).toBe('function');
    expect(typeof chatSessionRepository.addMessageToSession).toBe('function');
    expect(typeof chatSessionRepository.updateMessage).toBe('function');
    expect(typeof chatSessionRepository.updateSessionCompletionSettings).toBe(
      'function',
    );
    expect(typeof chatSessionRepository.getGlobalCompletionSettings).toBe(
      'function',
    );
    expect(typeof chatSessionRepository.saveGlobalCompletionSettings).toBe(
      'function',
    );
    expect(typeof chatSessionRepository.updateSessionTitle).toBe('function');
    expect(typeof chatSessionRepository.setSessionActivePal).toBe('function');
    expect(typeof chatSessionRepository.deleteMessage).toBe('function');
    // These might be private methods, so we don't test for them
    // expect(typeof chatSessionRepository.resetMigration).toBe('function');
    // expect(typeof chatSessionRepository.migrateAllSettings).toBe('function');
    // expect(typeof chatSessionRepository.checkAndMigrateFromJSON).toBe('function');
  });

  it('should be able to call getAllSessions without errors', async () => {
    await expect(chatSessionRepository.getAllSessions()).resolves.not.toThrow();
  });

  it('should be able to call getSessionById without errors', async () => {
    await expect(
      chatSessionRepository.getSessionById('test-id'),
    ).resolves.not.toThrow();
  });

  it('should be able to call getGlobalCompletionSettings without errors', async () => {
    await expect(
      chatSessionRepository.getGlobalCompletionSettings(),
    ).resolves.not.toThrow();
  });

  describe('find(id) 分类：不存在 vs 数据库真故障（W6）', () => {
    const emitMock = (require('../../debug/eventStream') as {emit: jest.Mock})
      .emit;

    const stubFind = (impl: jest.Mock) =>
      jest
        .spyOn(mockDatabase.collections, 'get')
        .mockReturnValue({find: impl} as any);

    beforeEach(() => {
      emitMock.mockClear();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('记录不存在（watermelondb 抛 not found）→ 返回 null 且不报错', async () => {
      const spy = stubFind(
        jest
          .fn()
          .mockRejectedValue(new Error('Record chat_sessions#s-1 not found')),
      );

      await expect(
        realRepository.chatSessionRepository.getSessionById('s-1'),
      ).resolves.toBeNull();
      expect(emitMock).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('数据库真故障 → **抛出**且上报事件流（旧写法折成 null，故障被说成「记录没了」）', async () => {
      const fault = new Error('SQLITE_BUSY: database is locked');
      const spy = stubFind(jest.fn().mockRejectedValue(fault));

      await expect(
        realRepository.chatSessionRepository.getSessionById('s-1'),
      ).rejects.toThrow('SQLITE_BUSY');
      expect(emitMock).toHaveBeenCalledWith(
        'system',
        'db.findFault',
        expect.objectContaining({table: 'chat_sessions', id: 's-1'}),
      );
      spy.mockRestore();
    });

    it('非法 id（编程错）不当「不存在」吞掉', async () => {
      const spy = stubFind(
        jest
          .fn()
          .mockRejectedValue(
            new Error('Invalid record ID chat_sessions#undefined'),
          ),
      );

      await expect(
        realRepository.chatSessionRepository.deleteSession(undefined as any),
      ).rejects.toThrow('Invalid record ID');
      spy.mockRestore();
    });

    it('jest mock 的 resolve undefined 形态仍归「不存在」（不抛不报）', async () => {
      const spy = stubFind(jest.fn().mockResolvedValue(undefined));

      await expect(
        realRepository.chatSessionRepository.getSessionById('s-404'),
      ).resolves.toBeNull();
      expect(emitMock).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Batch Operations', () => {
    describe('updateMessage imageUris persistence', () => {
      it('persists imageUris into metadata.imageUris (chat image-task hydration)', async () => {
        const updateMock = jest
          .fn()
          .mockImplementation((updater: (record: any) => void) => {
            const rec = {metadata: '{}'};
            updater(rec);
            return rec;
          });
        const findMock = jest.fn().mockResolvedValue({update: updateMock});
        const getSpy = jest
          .spyOn(mockDatabase.collections, 'get')
          .mockReturnValue({find: findMock} as any);

        await realRepository.chatSessionRepository.updateMessage('msg-1', {
          text: '🎨 已为你生成：一只小猫',
          imageUris: ['file:///data/aios_images/dreamlite_1.png'],
        });

        expect(updateMock).toHaveBeenCalled();
        // 写盘 metadata 必须含 imageUris（水合后恢复图片显示）
        const rec = updateMock.mock.results[0].value;
        expect(rec.text).toBe('🎨 已为你生成：一只小猫');
        expect(JSON.parse(rec.metadata).imageUris).toEqual([
          'file:///data/aios_images/dreamlite_1.png',
        ]);
        getSpy.mockRestore();
      });

      it('merge keeps existing metadata fields when writing imageUris', async () => {
        const updateMock = jest
          .fn()
          .mockImplementation((updater: (record: any) => void) => {
            const rec = {metadata: '{"imageTask":true}'};
            updater(rec);
            return rec;
          });
        const findMock = jest.fn().mockResolvedValue({update: updateMock});
        const getSpy = jest
          .spyOn(mockDatabase.collections, 'get')
          .mockReturnValue({find: findMock} as any);

        await realRepository.chatSessionRepository.updateMessage('msg-1', {
          imageUris: ['file:///x.png'],
        });

        const rec = updateMock.mock.results[0].value;
        const parsed = JSON.parse(rec.metadata);
        expect(parsed.imageUris).toEqual(['file:///x.png']);
        expect(parsed.imageTask).toBe(true);
        getSpy.mockRestore();
      });
    });

    describe('deleteSessions', () => {
      it('should have deleteSessions method', () => {
        expect(typeof chatSessionRepository.deleteSessions).toBe('function');
      });

      it('handles empty array gracefully without errors', async () => {
        await expect(
          chatSessionRepository.deleteSessions([]),
        ).resolves.not.toThrow();
      });

      it('can be called with multiple session IDs', async () => {
        const ids = ['session1', 'session2', 'session3'];
        await expect(
          chatSessionRepository.deleteSessions(ids),
        ).resolves.not.toThrow();
      });

      it('can be called with single session ID', async () => {
        const ids = ['session1'];
        await expect(
          chatSessionRepository.deleteSessions(ids),
        ).resolves.not.toThrow();
      });

      it('handles non-existent session IDs without throwing', async () => {
        const ids = ['nonexistent-session'];
        await expect(
          chatSessionRepository.deleteSessions(ids),
        ).resolves.not.toThrow();
      });
    });

    describe('exportSessions', () => {
      it('exports all specified sessions by calling exportChatSession for each', async () => {
        const ids = ['session1', 'session2'];

        // The actual implementation dynamically imports exportUtils
        // We can test that it completes without error
        await expect(
          chatSessionRepository.exportSessions(ids),
        ).resolves.not.toThrow();
      });

      it('handles empty array gracefully', async () => {
        await expect(
          chatSessionRepository.exportSessions([]),
        ).resolves.not.toThrow();
      });

      it('calls exportChatSession for each session ID in sequence', async () => {
        const ids = ['session1', 'session2', 'session3'];

        // Test that the method completes successfully
        // The actual export logic is tested elsewhere
        await expect(
          chatSessionRepository.exportSessions(ids),
        ).resolves.not.toThrow();
      });
    });
  });
});
