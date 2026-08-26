/**
 * crudMethods — ModelStore 增删改方法组（models 域拆分 · R3-P2）
 *
 * 「CRUD 域」自 ModelStore.ts 原样迁出（行为零变化）：命中/删除/GGUF 元数据
 * 拉取补全、模型卡片设置更新（模板/停止词/名称/用途标签）、重置族
 * （chatTemplate/stopWords/name/整体）。挂载方式见 projectionMethods.ts
 * 头注（constructor 在 makeAutoObservable 之前调用；private 迁出后变公开
 * 实例属性，接受，不造访问控制补丁）。
 */
import {runInAction} from 'mobx';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {loadLlamaModelInfo} from 'llama.rn';

import type {modelStore as modelStoreInstance} from '../ModelStore';
import {
  ChatTemplateConfig,
  HuggingFaceModel,
  Model,
  ModelOrigin,
  ModelType,
} from '../../utils/types';
import type {CompletionParams} from '../../utils/completionTypes';
import {parseSizeLabel} from '../../utils';
import {
  getHFDefaultSettings,
  getLocalModelDefaultSettings,
} from '../../utils/chat';
import {getOriginalModelName} from '../../utils/formatters';

/** ModelStore 实例类型（类未导出，从单例推导；type-only import 无运行时环） */
type ModelStore = typeof modelStoreInstance;

export function applyCrudMethods(store: ModelStore): void {
  /**
   * Removes a model from the models list if it is not downloaded.
   * @param modelId - The ID of the model to remove.
   * @returns boolean - Returns true if the model was removed, false otherwise.
   */
  store.removeModelFromList = (model: Model): boolean => {
    const modelIndex = store.models.findIndex(
      m => m.id === model.id && m.origin === model.origin,
    );
    if (modelIndex !== -1) {
      const _model = store.models[modelIndex];
      if (!_model.isDownloaded) {
        runInAction(() => {
          store.models.splice(modelIndex, 1);
        });
        return true;
      }
    }
    return false;
  };

  store.deleteModel = async (model: Model) => {
    // id should work as well, as long as we are differentiating between models by origin.
    const modelIndex = store.models.findIndex(
      m => m.id === model.id && m.origin === model.origin,
    );
    if (modelIndex === -1) {
      return;
    }
    const _model = store.models[modelIndex];

    // Special handling for projection models
    if (_model.modelType === ModelType.PROJECTION) {
      const canDeleteResult = store.canDeleteProjectionModel(_model.id);
      if (!canDeleteResult.canDelete) {
        throw new Error(
          canDeleteResult.reason || 'Cannot delete projection model',
        );
      }

      // Disable vision for dependent models when their projection model is deleted
      if (
        canDeleteResult.dependentModels &&
        canDeleteResult.dependentModels.length > 0
      ) {
        // Use Promise.allSettled to handle potential errors gracefully
        await Promise.allSettled(
          canDeleteResult.dependentModels.map(dependentModel =>
            store.setModelVisionEnabled(dependentModel.id, false),
          ),
        );
      }
    }

    // Store all projection model IDs that this LLM could use
    const projectionModelIds: string[] = [];
    if (_model.supportsMultimodal) {
      // Add the default projection model
      if (_model.defaultProjectionModel) {
        projectionModelIds.push(_model.defaultProjectionModel);
      }
      // Add all compatible projection models (in case user downloaded additional ones)
      if (_model.compatibleProjectionModels) {
        _model.compatibleProjectionModels.forEach(id => {
          if (!projectionModelIds.includes(id)) {
            projectionModelIds.push(id);
          }
        });
      }
    }

    const filePath = await store.getModelFullPath(_model);
    if (_model.isLocal || _model.origin === ModelOrigin.LOCAL) {
      // Local models are always removed from the list, when the file is deleted.

      // Check if we need to release context (if this model is currently active)
      const needsContextRelease = store.activeModelId === _model.id;

      // Remove model from list first
      runInAction(() => {
        store.models.splice(modelIndex, 1);
      });

      // Release context if needed - this will handle all state cleanup
      if (needsContextRelease) {
        await store.releaseContext(true); // Clear active model and all related state
      }

      // Delete the file from internal storage
      try {
        await RNFS.unlink(filePath);
      } catch (err) {
        console.error('Failed to delete local model file:', err);
      }
    } else {
      // Non-local models are not removed from the list, when the file is deleted.
      console.log('deleting: ', filePath);

      try {
        if (filePath) {
          await RNFS.unlink(filePath);

          // Check if we need to release context (if this model is currently active)
          const needsContextRelease = store.activeModelId === _model.id;

          // Update model state first
          runInAction(() => {
            _model.progress = 0;
            _model.isDownloaded = false; // Mark as not downloaded after successful deletion
          });

          // Release context if needed - this will handle all state cleanup
          if (needsContextRelease) {
            await store.releaseContext(true); // Clear active model and all related state
          }

          //console.log('models: ', this.models);
        } else {
          console.error("Failed to delete, file doesn't exist: ", filePath);
        }
        store.refreshDownloadStatuses();
      } catch (err) {
        console.error('Failed to delete:', err);
      }
    }

    // After deleting an LLM, check if any of its projection models have become orphaned
    if (
      projectionModelIds.length > 0 &&
      _model.modelType !== ModelType.PROJECTION
    ) {
      await store.cleanupOrphanedProjectionModels(projectionModelIds);
    }
  };

  /**
   * Fetch and persist GGUF metadata for a downloaded model
   * Called after download completes to enable accurate memory estimation
   */
  store.fetchAndPersistGGUFMetadata = async (model: Model) => {
    try {
      const filePath = await store.getModelFullPath(model);
      if (!filePath) {
        console.warn(
          '[ModelStore] Cannot fetch GGUF metadata: model path is undefined',
        );
        return;
      }

      const modelInfo = await loadLlamaModelInfo(filePath);
      if (!modelInfo || typeof modelInfo !== 'object') {
        console.warn('[ModelStore] Invalid model info returned');
        return;
      }

      // Default vocab sizes by architecture (matches Python memory_estimator.py)
      const ARCH_DEFAULT_VOCAB: Record<string, number> = {
        llama: 128256,
        gemma2: 256000,
        gemma3n: 262144,
        qwen2: 151936,
        qwen3: 151936,
        lfm2: 65536,
        phi3: 32064,
        mistral: 32000,
        deepseek2: 102400,
        clip: 49408, // CLIP models have smaller vocab
      };

      // Get the architecture to determine the correct key prefix
      const architecture: string =
        (modelInfo as any)['general.architecture'] || 'llama';

      // Helper to get architecture-specific value with fallback (matches Python get_arch_value)
      const getArchValue = (
        field: string,
        defaultValue?: number,
      ): number | undefined => {
        const key = `${architecture}.${field}`;
        const value = (modelInfo as any)[key];
        if (value !== undefined && value !== null) {
          // Handle string values (GGUF sometimes returns strings)
          if (typeof value === 'string') {
            const parsed = value.includes('.')
              ? parseFloat(value)
              : parseInt(value, 10);
            return isNaN(parsed) ? defaultValue : parsed;
          }
          return typeof value === 'number' ? value : defaultValue;
        }
        return defaultValue;
      };

      // Extract core fields (these are required)
      const n_layers = getArchValue('block_count');
      const n_embd = getArchValue('embedding_length');
      const n_head = getArchValue('attention.head_count');

      // Validate core fields exist - without these we can't estimate memory
      if (!n_layers || !n_embd || !n_head) {
        return;
      }

      // Extract optional fields with fallbacks (matches Python ModelInfo.__post_init__)
      const n_head_kv = getArchValue('attention.head_count_kv', n_head); // fallback to n_head
      const n_vocab =
        getArchValue('vocab_size') ||
        ARCH_DEFAULT_VOCAB[architecture] ||
        128000;

      // Derive head dimensions if not present (matches Python)
      const n_embd_head_k =
        getArchValue('attention.key_length') || Math.floor(n_embd / n_head);
      const n_embd_head_v =
        getArchValue('attention.value_length') || Math.floor(n_embd / n_head);

      // SWA (Sliding Window Attention) - optional
      const sliding_window = getArchValue('attention.sliding_window');

      // Context length from GGUF
      const context_length = getArchValue('context_length');

      const metadata = {
        architecture,
        n_layers,
        n_embd,
        n_head,
        n_head_kv: n_head_kv!,
        n_vocab,
        n_embd_head_k,
        n_embd_head_v,
        sliding_window,
        context_length,
      };

      const paramCount = parseSizeLabel(
        (modelInfo as any)['general.size_label'],
      );

      runInAction(() => {
        model.ggufMetadata = metadata;
        if (!model.params && paramCount) {
          model.params = paramCount;
        }
      });
    } catch (error) {
      console.warn('[ModelStore] Failed to fetch GGUF metadata:', error);
    }
  };

  /**
   * Load GGUF metadata for downloaded models that don't have it yet.
   * Runs in background, doesn't block startup.
   */
  store.loadMissingGGUFMetadata = () => {
    const modelsNeedingMetadata = store.models.filter(
      m =>
        m.isDownloaded &&
        !m.ggufMetadata &&
        m.modelType !== ModelType.PROJECTION,
    );

    if (modelsNeedingMetadata.length === 0) {
      return;
    }

    // Fetch in background, don't block startup
    (async () => {
      for (const model of modelsNeedingMetadata) {
        try {
          await store.fetchAndPersistGGUFMetadata(model);
        } catch (error) {
          // Log but continue - not critical for startup
          console.warn(
            '[ModelStore] Failed to fetch metadata for',
            model.name,
            error,
          );
        }
      }
    })();
  };

  store.updateModelChatTemplate = (
    modelId: string,
    newConfig: ChatTemplateConfig,
  ) => {
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.chatTemplate = newConfig;
      });
    }
  };

  store.updateModelStopWords = (
    modelId: string,
    newStopWords: CompletionParams['stop'],
  ) => {
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.stopWords = newStopWords;
      });
    }
  };

  store.updateModelName = (modelId: string, newName: string) => {
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.name = newName;
      });
    }
  };

  /**
   * §18.7 模型用途标签：capabilities 唯一写入口（ModelSettingsSheet 用途 chips）。
   * 沿用 updateModelName 同款持久化链（models 持久白名单）。
   * 选型闭环：listModelsForTask 读标签 → 弹窗多候选。
   */
  store.updateModelCapabilities = (
    modelId: string,
    newCapabilities: Model['capabilities'],
  ) => {
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.capabilities = newCapabilities;
      });
    }
  };

  store.resetModels = async () => {
    const localModels = store.models.filter(
      model => model.isLocal || model.origin === ModelOrigin.LOCAL,
    );
    localModels.forEach(model => {
      const defaultSettings = getLocalModelDefaultSettings();
      // We change the default settings as well, in case the app introduces new settings.
      model.defaultChatTemplate = {...defaultSettings.chatTemplate};
      model.defaultStopWords = [
        ...(defaultSettings?.completionParams?.stop || []),
      ];
      model.chatTemplate = {...defaultSettings.chatTemplate};
      model.stopWords = [...(defaultSettings?.completionParams?.stop || [])];

      // Clear GGUF metadata to force re-fetch with correct number types
      model.ggufMetadata = undefined;
    });

    const hfModels = store.models.filter(
      model => model.origin === ModelOrigin.HF,
    );
    hfModels.forEach(model => {
      const defaultSettings = getHFDefaultSettings(
        model.hfModel as HuggingFaceModel,
      );
      // We change the default settings as well, in case the app introduces new settings.
      model.defaultChatTemplate = {...defaultSettings.chatTemplate};
      model.defaultStopWords = [
        ...(defaultSettings?.completionParams?.stop || []),
      ];
      model.chatTemplate = {...defaultSettings.chatTemplate};
      model.stopWords = [...(defaultSettings?.completionParams?.stop || [])];

      // Clear GGUF metadata to force re-fetch with correct number types
      model.ggufMetadata = undefined;
    });

    // Re-resolve the device-appropriate presets so reset repopulates the
    // default rule list synchronously, mirroring initializeStore (rather than
    // leaving it empty until the next launch re-migrates).
    const presets = await store.resolvePresets();

    runInAction(() => {
      // Seed with the kept local/HF models so the preset reconcile dedups
      // against them (a downloaded HF model matching a rule preset is not
      // duplicated).
      store.models = [...localModels, ...hfModels];
      store.version = 0;
      store.mergeModelLists(presets);

      // mergeModelLists appends defaultStopWords onto existing stopWords to
      // preserve user customizations; on the just-reset kept models that
      // duplicates the seeded defaults. Dedup the affected models (distinct
      // entries are preserved).
      [...localModels, ...hfModels].forEach(model => {
        model.stopWords = [...new Set(model.stopWords)];
      });
    });

    // Re-fetch GGUF metadata with correct number types
    store.loadMissingGGUFMetadata();
  };

  store.resetModelChatTemplate = (modelId: string) => {
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.chatTemplate = {...model.defaultChatTemplate};
      });
    }
  };

  store.resetModelStopWords = (modelId: string) => {
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.stopWords = [...(model.defaultStopWords || [])];
      });
    }
  };

  store.resetModelName = (modelId: string) => {
    const model = store.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.name = getOriginalModelName(model);
      });
    }
  };
}
