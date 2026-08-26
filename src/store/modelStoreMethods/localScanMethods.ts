/**
 * localScanMethods — ModelStore 本地扫描方法组（models 域拆分 · R3-P4）
 *
 * 「本地域」自 ModelStore.ts 原样迁出（行为零变化）：B15 双轨目录扫描并注册
 * 本地 GGUF（LLM 注册 + mmproj 视觉模块配对）、按全路径移除、单文件注册。
 * 启动链顺序敏感（initializeStore 调用 scanLocalModels；授权返回后
 * handleAppStateChange 也调用）。挂载方式见 projectionMethods.ts 头注。
 */
import {runInAction} from 'mobx';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {v4 as uuidv4} from 'uuid';

import type {modelStore as modelStoreInstance} from '../ModelStore';
import {getAllModelDirs} from '../../utils/modelDirs';
import {MMProjRegex} from '../../utils/multimodalPatterns';
import {IMAGE_GEN_MODEL_FILES} from '../../utils/imageGenManifest';
import {getLocalModelDefaultSettings} from '../../utils/chat';
import {Model, ModelOrigin, ModelType} from '../../utils/types';

/** ModelStore 实例类型（类未导出，从单例推导；type-only import 无运行时环） */
type ModelStore = typeof modelStoreInstance;

export function applyLocalScanMethods(store: ModelStore): void {
  /**
   * Scan model dirs for .gguf files (B15 双轨：默认目录 ∪ 自定义目录，去重按文件名).
   * Auto-registers models not yet in the store.
   * Called on app startup after ensureAiosDirs().
   */
  store.scanLocalModels = async () => {
    try {
      // B15（ADR-0004）：扫描范围 = 默认规范目录 ∪ 自定义目录列表；
      // 同名文件仅保留第一个（默认目录优先），后续目录视为重复。
      const dirs = await getAllModelDirs();
      const filesByDir: {dir: string; files: RNFS.ReadDirResItemT[]}[] = [];
      for (const dir of dirs) {
        try {
          if (!(await RNFS.exists(dir))) {
            continue;
          }
          const files = await RNFS.readDir(dir);
          filesByDir.push({dir, files});
        } catch (e) {
          // 单个目录读不到（权限/缺失）不阻断整体扫描
          console.warn(`[ModelStore] scan dir skipped: ${dir}`, e);
        }
      }
      const ggufFiles = filesByDir
        .flatMap(({files}) => files)
        .filter(f => (f.name as string).toLowerCase().endsWith('.gguf'));
      const seenNames = new Set<string>();
      const uniqueGgufFiles = ggufFiles.filter(f => {
        const name = f.name as string;
        if (seenNames.has(name)) {
          return false;
        }
        seenNames.add(name);
        return true;
      });
      const isRegistered = (fullPath: string) =>
        store.models.some(
          m =>
            (m.isLocal || m.origin === ModelOrigin.LOCAL) &&
            m.fullPath === fullPath,
        );

      // 已知同名模型: 不重复注册; 文件丢失则重定向到共享副本; mmproj 条目升级为 projection 类型
      const adoptExisting = async (
        filename: string,
        fullPath: string,
      ): Promise<Model | null> => {
        const existing = store.models.find(m => m.filename === filename);
        if (!existing) {
          return null;
        }
        const oldOk =
          !!existing.fullPath && (await RNFS.exists(existing.fullPath));
        runInAction(() => {
          if (!oldOk) {
            existing.fullPath = fullPath;
          }
          if (MMProjRegex.test(filename)) {
            if (existing.modelType !== ModelType.PROJECTION) {
              existing.modelType = ModelType.PROJECTION;
            }
          } else if (existing.modelType === undefined) {
            // 已有同名本地模型（WatermelonDB/预设加载）未标注类型时补 LLM，
            // 否则 isChatSelectable(modelType===LLM) 过滤后聊天列表为空
            existing.modelType = ModelType.LLM;
          }
        });
        return existing;
      };

      // Pass 1: 注册 LLM 模型（跳过 mmproj 与生图模型文件）
      for (const file of uniqueGgufFiles) {
        const filename = file.name as string;
        if (MMProjRegex.test(filename)) {
          continue;
        }
        // 生图模型（manifest 声明）不注册为 LLM，避免污染聊天模型列表
        if (IMAGE_GEN_MODEL_FILES.has(filename)) {
          continue;
        }
        const fullPath = file.path as string;
        if (await adoptExisting(filename, fullPath)) {
          continue;
        }
        if (!isRegistered(fullPath)) {
          await store.addLocalModel(fullPath);
        }
      }

      // Pass 2: 注册 mmproj 视觉模块并自动配对到同基座 LLM
      for (const file of uniqueGgufFiles) {
        const filename = file.name as string;
        if (!MMProjRegex.test(filename)) {
          continue;
        }
        const fullPath = file.path as string;
        const adopted = await adoptExisting(filename, fullPath);
        if (!adopted && !isRegistered(fullPath)) {
          await store.addLocalModel(fullPath);
        }
        // 配对: mmproj-X-base-quant.gguf 的基座名 = 去掉 mmproj 前缀和量化后缀
        const mmprojModel =
          adopted ?? store.models.find(m => m.fullPath === fullPath);
        if (!mmprojModel) {
          continue;
        }
        const base = filename
          .replace(/^[-_.]*mmproj[-_.]/i, '')
          .replace(/\.(gguf)$/i, '')
          .replace(/[-_.](f16|bf16|q\d+[a-z_]*|fp16)$/i, '');
        const target = store.models.find(
          m =>
            m.id !== mmprojModel.id &&
            m.modelType !== ModelType.PROJECTION &&
            (m.filename || '').startsWith(base),
        );
        if (target) {
          runInAction(() => {
            target.supportsMultimodal = true;
            if (!target.compatibleProjectionModels) {
              target.compatibleProjectionModels = [];
            }
            if (!target.compatibleProjectionModels.includes(mmprojModel.id)) {
              target.compatibleProjectionModels.push(mmprojModel.id);
            }
            if (!target.defaultProjectionModel) {
              target.defaultProjectionModel = mmprojModel.id;
            }
          });
          console.log(
            '[ModelStore] mmproj paired: ' +
              filename +
              ' -> ' +
              target.filename,
          );
        }
      }
      runInAction(() => {
        store.lastScanTime = Date.now();
      });
      console.log('[ModelStore] scanLocalModels completed');
    } catch (e) {
      console.warn('[ModelStore] scanLocalModels failed:', e);
    }
  };

  store.removeModelByFullPath = (fullPath: string) => {
    const index = store.models.findIndex(
      m =>
        (m.isLocal || m.origin === ModelOrigin.LOCAL) &&
        m.fullPath === fullPath,
    );
    if (index !== -1) {
      store.models.splice(index, 1);
    }
  };

  store.addLocalModel = async (localFilePath: string) => {
    const filename = localFilePath.split('/').pop(); // Extract filename from path
    if (!filename) {
      throw new Error('Invalid local file path');
    }

    // Read file size from disk
    let fileSize = 0;
    try {
      const stat = await RNFS.stat(localFilePath);
      fileSize = Number(stat.size) || 0;
    } catch (e) {
      console.warn('[ModelStore] Failed to read file size:', e);
    }

    const defaultSettings = getLocalModelDefaultSettings();

    const isMmproj = MMProjRegex.test(filename);
    const model: Model = {
      id: uuidv4(), // Generate a unique ID
      author: '',
      name: filename,
      size: fileSize,
      params: 0, // Will be updated after GGUF metadata read
      isDownloaded: true,
      downloadUrl: '',
      hfUrl: '',
      progress: 0,
      filename,
      fullPath: localFilePath,
      isLocal: true, // Kept for backward compatibility
      origin: ModelOrigin.LOCAL,
      // 本地扫描的 gguf 默认为 LLM（聊天可选用）；mmproj 为 PROJECTION。
      // 不设会 undefined → isChatSelectable(modelType===LLM) 过滤后列表空
      modelType: isMmproj ? ModelType.PROJECTION : ModelType.LLM,
      defaultChatTemplate: {...defaultSettings.chatTemplate},
      chatTemplate: {...defaultSettings.chatTemplate},
      defaultStopWords: [...(defaultSettings?.completionParams?.stop || [])],
      stopWords: [...(defaultSettings?.completionParams?.stop || [])],
      defaultCompletionSettings: defaultSettings.completionParams,
      completionSettings: {...defaultSettings.completionParams},
    };

    runInAction(() => {
      store.models.push(model);
      store.refreshDownloadStatuses();
    });

    // Get the MobX observable version — the plain `model` object was wrapped
    // in a proxy when pushed into the observable array. We must pass the proxy
    // so that mutations inside fetchAndPersistGGUFMetadata trigger reactivity.
    const observableModel = store.models.find(m => m.id === model.id);
    if (observableModel) {
      await store.fetchAndPersistGGUFMetadata(observableModel);
    }
  };
}
