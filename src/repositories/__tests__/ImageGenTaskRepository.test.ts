/**
 * ImageGenTaskRepository 契约测试（B28）：
 * 数据层 CRUD + 字段映射（toEntry/applyEntry）验证。
 * database 用内存 fake（支持 eq/oneOf 过滤），对齐 ChatSessionRepository
 * 测试的 mock 模式（真实往返由真机集成验证覆盖）。
 */
jest.mock('../../database', () => {
  // 内存 fake collection：query 支持 Q.where eq/oneOf 过滤
  const rows: any[] = [];
  const matches = (cond: any, row: any) => {
    if (!cond) {
      return true;
    }
    if (cond.comparison === 'oneOf') {
      return cond.values.includes(row[cond.column]);
    }
    return row[cond.column] === cond.value;
  };
  const fakeCollection = {
    __reset: () => {
      rows.length = 0;
    },
    query: (...conditions: any[]) => ({
      fetch: async () =>
        rows.filter(r => conditions.every(c => matches(c, r))),
    }),
    create: async (cb: (r: any) => void) => {
      const record: any = {
        update: async (f: (r: any) => void) => f(record),
        destroyPermanently: async () => {
          const i = rows.indexOf(record);
          if (i >= 0) {
            rows.splice(i, 1);
          }
        },
      };
      cb(record);
      rows.push(record);
      return record;
    },
  };
  return {
    database: {
      collections: {get: () => fakeCollection},
      write: async (cb: () => Promise<void>) => cb(),
    },
    ImageGenTask: class {},
  };
});

jest.mock('../../utils/paths', () => ({
  prepareSharedStorage: jest.fn().mockResolvedValue(undefined),
  scheduleDbSnapshot: jest.fn(),
}));

import {imageGenTaskRepository} from '../ImageGenTaskRepository';

describe('ImageGenTaskRepository', () => {
  beforeEach(() => {
    // 测试隔离：清空内存 fake 表
    const mocked = jest.requireMock('../../database') as any;
    mocked.database.collections.get('image_gen_tasks').__reset();
  });

  const entry = {
    uri: 'file:///data/user/0/com.pocketpalai/files/aios_images/gen_test.png',
    prompt: 'test',
    seed: 1,
    ts: 1787290000000,
    width: 512,
    height: 512,
    taskId: 'task_test_1',
    status: 'success' as const,
  };

  it('create + loadAll 往返（字段映射保真）', async () => {
    await imageGenTaskRepository.create(entry);
    const all = await imageGenTaskRepository.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      uri: entry.uri,
      taskId: 'task_test_1',
      status: 'success',
      ts: entry.ts,
      width: 512,
    });
  });

  it('patchByTaskId 更新状态（finishTask 链路）', async () => {
    await imageGenTaskRepository.create({...entry, status: 'running'});
    await imageGenTaskRepository.patchByTaskId('task_test_1', {
      status: 'success',
      durationMs: 1234,
    });
    const all = await imageGenTaskRepository.loadAll();
    expect(all[0].status).toBe('success');
    expect(all[0].durationMs).toBe(1234);
  });

  it('removeByUris 批量删除（deleteHistory 链路）', async () => {
    await imageGenTaskRepository.create(entry);
    await imageGenTaskRepository.removeByUris([entry.uri]);
    expect(await imageGenTaskRepository.loadAll()).toHaveLength(0);
  });

  it('removeByTaskId 删除（deleteTask 链路）', async () => {
    await imageGenTaskRepository.create(entry);
    await imageGenTaskRepository.removeByTaskId('task_test_1');
    expect(await imageGenTaskRepository.loadAll()).toHaveLength(0);
  });

  it('createBatch 单事务批量（recover/迁移链路）', async () => {
    const e2 = {...entry, uri: 'file:///x.png', taskId: 'task_test_2'};
    await imageGenTaskRepository.createBatch([entry, e2]);
    expect(await imageGenTaskRepository.loadAll()).toHaveLength(2);
  });

  it('loadAll ts 倒序（相册展示序）', async () => {
    const older = {...entry, uri: 'file:///old.png', taskId: 't_old', ts: 1000};
    const newer = {...entry, uri: 'file:///new.png', taskId: 't_new', ts: 2000};
    await imageGenTaskRepository.createBatch([older, newer]);
    const all = await imageGenTaskRepository.loadAll();
    expect(all[0].taskId).toBe('t_new');
  });
});
