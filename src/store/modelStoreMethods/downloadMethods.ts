/**
 * downloadMethods — ModelStore 下载方法组（models 域拆分 · R3-P3）
 *
 * 「下载域」自 ModelStore.ts 原样迁出（行为零变化）：投影模型联动下载、
 * 权限/双源统一入口 checkSpaceAndDownload、取消/进度、HF 浏览器接入
 * downloadHFModel、文件详情（lfs.oid）/哈希刷新、错误清空与重试。
 * 注意：constructor 里的 downloadManager.setCallbacks 留在 facade
 * （onComplete 回调调用的 fetchAndPersistGGUFMetadata 属 crud 组，
 * 运行时 lookup，不构成 import 依赖）。挂载方式见 projectionMethods.ts 头注。
 */
import {runInAction} from 'mobx';

import type {modelStore as modelStoreInstance} from '../ModelStore';
import {
  HuggingFaceModel,
  Model,
  ModelFile,
  ModelOrigin,
  ModelType,
} from '../../utils/types';
import {getMmprojFiles, getSHA256Hash} from '../../utils';
import {uiStore} from '../UIStore';
import {hfStore} from '../HFStore';
import {createErrorState} from '../../utils/errors';
import {
  downloadManager,
  DownloadCancelledError,
} from '../../services/downloads';
import {ensureStorageAccess} from '../../utils/androidPermission';
import {infoDialog} from '../../components/ui/InfoDialog';
import {t} from '../../locales';
import {fetchModelFilesDetails} from '../../api/hf';
import {catalogEntryByFilename} from '../../utils/modelCatalog';
import {
  DownloadSource,
  fileRemotePath,
  repoForSource,
  resolveDownloadUrl,
} from '../../utils/downloadSources';

/** ModelStore 实例类型（类未导出，从单例推导；type-only import 无运行时环） */
type ModelStore = typeof modelStoreInstance;

export function applyDownloadMethods(store: ModelStore): void {
  /**
   * Private method to handle projection model download for vision models
   * @param model The vision model that needs its projection model downloaded
   */
  store._downloadProjectionModelIfNeeded = async (
    model: Model,
    source?: DownloadSource,
  ) => {
    // Only auto-download for vision models that aren't projection models themselves
    if (
      !model.supportsMultimodal ||
      !model.defaultProjectionModel ||
      model.modelType === ModelType.PROJECTION
    ) {
      return;
    }

    // Check if vision is enabled for this model (uses getModelVisionPreference for proper default handling)
    if (!store.getModelVisionPreference(model)) {
      console.log(
        'Vision disabled for model, skipping projection model download:',
        model.id,
      );
      return;
    }

    const projModelId = model.defaultProjectionModel;
    const projModel = store.models.find(m => m.id === projModelId);

    if (
      projModel &&
      !projModel.isDownloaded &&
      !downloadManager.isDownloading(projModelId)
    ) {
      console.log('Auto-downloading projection model for vision model:', {
        llm: model.id,
        projection: projModelId,
      });

      try {
        // Download the projection model
        await store.checkSpaceAndDownload(projModelId, source);
      } catch (error) {
        console.error('Failed to auto-download projection model:', error);
        // Don't re-throw - projection model download failure shouldn't fail the main model download
        // The user can manually download the projection model later if needed
      }
    }
  };

  store.checkSpaceAndDownload = async (
    modelId: string,
    source?: DownloadSource,
  ) => {
    const model = store.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model not found for download: ${modelId}`);
    }
    // 幂等：已下载/本地模型不重复下载（非错误，静默返回）
    if (
      model.isDownloaded ||
      model.isLocal ||
      model.origin === ModelOrigin.LOCAL
    ) {
      return;
    }
    if (!model.downloadUrl) {
      throw new Error(`Model has no download URL: ${modelId}`);
    }

    try {
      // 权限守卫（守卫 hook 指南针）：统一下载入口单点挂接，覆盖 ModelCard/
      // downloadHFModel/双源弹窗全入口；不可读时已弹「所有文件访问」引导。
      if (!(await ensureStorageAccess())) {
        throw new Error('Storage permission not granted for model download');
      }
      const destinationPath = await store.getModelFullPath(model);
      const authToken = hfStore.shouldUseToken ? hfStore.hfToken : null;
      // 显式源（HF/ModelScope 双源，2026-08-20）：catalog 条目按所选源重建
      // downloadUrl（远程路径走 fileRemotePath——本地落盘名≠远程名时不可用
      // 本地名拼 URL，否则 404）；token 守卫在 downloadManager（非 HF 恒不带）。
      let downloadModel = model;
      if (source) {
        const entry = catalogEntryByFilename(model.filename);
        const file =
          entry?.file.name === model.filename
            ? entry.file
            : entry?.extras?.find(f => f.name === model.filename);
        const repo = entry ? repoForSource(entry, source) : undefined;
        if (repo && file) {
          downloadModel = {
            ...model,
            downloadUrl: resolveDownloadUrl(
              repo,
              fileRemotePath(file, source),
              source,
            ),
          };
        }
      }
      await downloadManager.startDownload(
        downloadModel,
        destinationPath,
        authToken,
      );

      // For vision models, automatically download the projection model
      await store._downloadProjectionModelIfNeeded(model, source);
    } catch (err) {
      if (err instanceof DownloadCancelledError) {
        // User cancelled — not a failure. Don't surface an error and don't
        // chain the projection-model download for multimodal models.
        return;
      }

      console.error('Failed to start download:', err);

      // Create proper error state for the snackbar system
      const errorState = createErrorState(err, 'download', 'huggingface', {
        modelId,
      });

      runInAction(() => {
        store.downloadError = errorState;
      });

      // Re-throw so the caller knows the download failed
      throw err;
    }
  };

  store.cancelDownload = async (modelId: string) => {
    await downloadManager.cancelDownload(modelId);
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.isDownloaded = false;
        model.progress = 0;
      });
    }
    store.refreshDownloadStatuses();
  };

  store.getDownloadProgress = (modelId: string) => {
    return downloadManager.getDownloadProgress(modelId);
  };

  store.downloadHFModel = async (
    hfModel: HuggingFaceModel,
    modelFile: ModelFile,
    options?: {
      enableVision?: boolean;
      projectionModelId?: string; // User-selected projection model
    },
  ) => {
    try {
      const newModel = await store.addHFModel(hfModel, modelFile);
      if (!newModel) {
        throw new Error('Failed to add model to store');
      }

      // Set vision preference based on user choice
      if (newModel.supportsMultimodal && options?.enableVision !== undefined) {
        store.setModelVisionEnabled(newModel.id, options.enableVision);
        // runInAction(() => {
        //   newModel.visionEnabled = options.enableVision;
        // });
      }

      // Override default projection model with user selection if provided
      if (newModel.supportsMultimodal && options?.projectionModelId) {
        // Validate that selected projection model exists in repository
        const mmprojFiles = getMmprojFiles(hfModel.siblings || []);
        const selectedExists = mmprojFiles.some(
          file =>
            `${hfModel.id}/${file.rfilename}` === options.projectionModelId,
        );

        if (selectedExists) {
          runInAction(() => {
            newModel.defaultProjectionModel = options.projectionModelId;
          });
        } else {
          console.warn(
            'Selected projection model not found in repository, using auto-determined default',
          );
        }
      }

      // Wait a bit to ensure the projection model is added to the store
      // This is needed because addHFModel adds mmproj models asynchronously
      await new Promise(resolve => setTimeout(resolve, 200));

      // Use the centralized download method which handles mmproj automatically
      store.checkSpaceAndDownload(newModel.id);

      // The error handling is now done in the downloadManager callbacks
    } catch (error) {
      // Only handle errors related to the initial setup before the download starts
      console.error('Failed to set up HF model download:', error);
      infoDialog({
        title: uiStore.l10n.errors.downloadSetupFailedTitle,
        message: t(uiStore.l10n.errors.downloadSetupFailedMessage, {
          message: (error as Error).message,
        }),
      });
    }
  };

  /**
   * Fetches and updates model file details from HuggingFace.
   * This is used when we need to get the lfs.oid for integrity checks.
   * @param model - The model to update
   * @returns Promise<void>
   */
  store.fetchAndUpdateModelFileDetails = async (
    model: Model,
  ): Promise<void> => {
    if (!model.hfModel?.id) {
      return;
    }

    try {
      const fileDetails = await fetchModelFilesDetails(model.hfModel.id);
      const matchingFile = fileDetails.find(
        file => file.path === model.hfModelFile?.rfilename,
      );

      if (matchingFile && matchingFile.lfs) {
        runInAction(() => {
          if (model.hfModelFile) {
            model.hfModelFile.lfs = matchingFile.lfs;
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch model file details:', error);
    }
  };

  // Expensive operation.
  // It will be calculating hash if hash is not set, unless force is true.
  store.updateModelHash = async (modelId: string, force: boolean = false) => {
    const model = store.models.find(m => m.id === modelId);

    // We only update hash if the model is downloaded and not currently being downloaded.
    if (model?.isDownloaded && !downloadManager.isDownloading(modelId)) {
      // If not forced, we only update hash if it's not already set.
      if (model.hash && !force) {
        return;
      }
      const filePath = await store.getModelFullPath(model);
      const hash = await getSHA256Hash(filePath);
      runInAction(() => {
        model.hash = hash;
      });
    }
  };

  store.clearDownloadError = () => {
    store.downloadError = null;
  };

  store.retryDownload = () => {
    const modelId = store.downloadError?.metadata?.modelId;
    store.clearDownloadError();

    if (modelId) {
      // Find the model and retry download
      const model = store.models.find(m => m.id === modelId);
      if (model) {
        store.checkSpaceAndDownload(model.id);
      }
    }
  };
}
