import {guardBeforeDownload} from '../downloadGuard';
import {ensureStorageAccess} from '../androidPermission';
import {hasEnoughSpace} from '../index';
import {downloadManager} from '../../services/downloads';
import {Model} from '../types';

jest.mock('../androidPermission', () => ({
  ensureStorageAccess: jest.fn(),
}));
jest.mock('../index', () => ({
  hasEnoughSpace: jest.fn(),
}));
jest.mock('../../services/downloads', () => ({
  downloadManager: {isDownloading: jest.fn()},
}));

const mockEnsureStorageAccess = ensureStorageAccess as jest.Mock;
const mockHasEnoughSpace = hasEnoughSpace as jest.Mock;
const mockIsDownloading = downloadManager.isDownloading as jest.Mock;

const model = {
  id: 'a/b/m.gguf',
  downloadUrl: 'https://huggingface.co/a/b/resolve/main/m.gguf',
  isDownloaded: false,
  size: 1000,
} as Model;

describe('downloadGuard — 下载前置守卫链', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureStorageAccess.mockResolvedValue(true);
    mockHasEnoughSpace.mockResolvedValue(true);
    mockIsDownloading.mockReturnValue(false);
  });

  it('全通过 → ok:true', async () => {
    await expect(guardBeforeDownload(model)).resolves.toEqual({ok: true});
  });

  it('权限不可读 → permission（引导后拒绝）', async () => {
    mockEnsureStorageAccess.mockResolvedValue(false);
    await expect(guardBeforeDownload(model)).resolves.toEqual({
      ok: false,
      reason: 'permission',
    });
  });

  it('无下载 URL → no-source（不给假下载）', async () => {
    await expect(
      guardBeforeDownload({...model, downloadUrl: ''}),
    ).resolves.toEqual({ok: false, reason: 'no-source'});
  });

  it('已下载 → downloaded（幂等拒绝）', async () => {
    await expect(
      guardBeforeDownload({...model, isDownloaded: true}),
    ).resolves.toEqual({ok: false, reason: 'downloaded'});
  });

  it('下载中 → downloading（幂等拒绝）', async () => {
    mockIsDownloading.mockReturnValue(true);
    await expect(guardBeforeDownload(model)).resolves.toEqual({
      ok: false,
      reason: 'downloading',
    });
  });

  it('存储不足 → storage', async () => {
    mockHasEnoughSpace.mockResolvedValue(false);
    await expect(guardBeforeDownload(model)).resolves.toEqual({
      ok: false,
      reason: 'storage',
    });
  });

  it('守卫顺序：权限失败时不再检查后续项', async () => {
    mockEnsureStorageAccess.mockResolvedValue(false);
    mockHasEnoughSpace.mockResolvedValue(false);
    await guardBeforeDownload(model);
    expect(mockHasEnoughSpace).not.toHaveBeenCalled();
  });
});
