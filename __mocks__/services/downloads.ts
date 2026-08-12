import {downloadingModel} from '../../jest/fixtures/models';

export const downloadManager = {
  isDownloading: jest.fn().mockImplementation(modelId => {
    // Return true for specific model IDs that should be "downloading"
    return modelId === downloadingModel.id;
  }),
  getDownloadProgress: jest.fn().mockImplementation(modelId => {
    return modelId === downloadingModel.id ? 50 : 0;
  }),
  startDownload: jest.fn().mockResolvedValue(undefined),
  cancelDownload: jest.fn(),
  setCallbacks: jest.fn(),
  syncWithActiveDownloads: jest.fn(),
};
