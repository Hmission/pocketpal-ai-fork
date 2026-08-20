import axios from 'axios';

import {
  fetchModelDetail,
  fetchRepoFiles,
  isValidModelScopeRepoId,
} from '../modelscope';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('modelscope API 适配层', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isValidModelScopeRepoId 校验 author/repo 形态', () => {
    expect(isValidModelScopeRepoId('Qwen/Qwen2.5-7B-Instruct-GGUF')).toBe(
      true,
    );
    expect(isValidModelScopeRepoId('  Qwen/Qwen2.5  ')).toBe(true);
    expect(isValidModelScopeRepoId('norepo')).toBe(false);
    expect(isValidModelScopeRepoId('a/b/c')).toBe(false);
    expect(isValidModelScopeRepoId('a/../b')).toBe(false);
    expect(isValidModelScopeRepoId('a/b c')).toBe(false);
    expect(isValidModelScopeRepoId('')).toBe(false);
  });

  it('fetchRepoFiles 映射 Files → ModelFile（resolve URL 直通）', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        Code: 200,
        Data: {
          Files: [
            {
              Name: 'model.Q4_K_M.gguf',
              Path: 'model.Q4_K_M.gguf',
              Size: 1024,
              IsLFS: true,
              Sha256: 'abc123',
              Type: 'blob',
            },
            {
              Name: 'README.md',
              Path: 'README.md',
              Size: 10,
              IsLFS: false,
            },
          ],
        },
      },
    });

    const files = await fetchRepoFiles('a/b');

    expect(mockAxios.get).toHaveBeenCalledWith(
      'https://modelscope.cn/api/v1/models/a/b/repo/files',
      expect.objectContaining({
        params: {Revision: 'master', Recursive: true, Root: ''},
      }),
    );
    expect(files).toEqual([
      {
        rfilename: 'model.Q4_K_M.gguf',
        size: 1024,
        url: 'https://modelscope.cn/models/a/b/resolve/master/model.Q4_K_M.gguf',
        oid: 'abc123',
        lfs: {oid: 'abc123', size: 1024, pointerSize: 0},
      },
      {
        rfilename: 'README.md',
        size: 10,
        url: 'https://modelscope.cn/models/a/b/resolve/master/README.md',
        oid: undefined,
        lfs: undefined,
      },
    ]);
  });

  it('fetchModelDetail 映射元数据 + 填充 siblings', async () => {
    mockAxios.get.mockImplementation(url => {
      if (String(url).includes('/repo/files')) {
        return Promise.resolve({
          data: {
            Code: 200,
            Data: {
              Files: [
                {
                  Name: 'model.gguf',
                  Path: 'model.gguf',
                  Size: 500,
                  IsLFS: true,
                },
              ],
            },
          },
        });
      }
      return Promise.resolve({
        data: {
          Code: 200,
          Data: {
            ChineseName: '测试模型',
            Downloads: 12345,
            LastUpdatedTime: 1700000000,
            CreatedTime: 1690000000,
            Libraries: ['gguf'],
            ModelInfos: {
              gguf: {
                architecture: 'qwen2',
                chat_template: '{{prompt}}',
                total: 7500000000,
              },
            },
          },
        },
      });
    });

    const hfModel = await fetchModelDetail('Qwen/Qwen2.5-7B-Instruct-GGUF');

    expect(hfModel.id).toBe('Qwen/Qwen2.5-7B-Instruct-GGUF');
    expect(hfModel.author).toBe('Qwen');
    expect(hfModel.specs?.gguf.architecture).toBe('qwen2');
    expect(hfModel.specs?.gguf.chat_template).toBe('{{prompt}}');
    expect(hfModel.downloads).toBe(12345);
    expect(hfModel.siblings).toHaveLength(1);
    expect(hfModel.siblings[0].url).toContain(
      'https://modelscope.cn/models/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/master/model.gguf',
    );
  });

  it('非法 repo id 直接拒绝（不发起网络请求）', async () => {
    await expect(fetchRepoFiles('bad')).rejects.toThrow(
      'Invalid ModelScope repo id',
    );
    await expect(fetchModelDetail('a/../../etc')).rejects.toThrow(
      'Invalid ModelScope repo id',
    );
    expect(mockAxios.get).not.toHaveBeenCalled();
  });
});
