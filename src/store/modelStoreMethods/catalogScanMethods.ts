/**
 * catalogScanMethods — ModelStore 目录清单/扫描方法组（models 域拆分 · R3-P4）
 *
 * 「目录域」自 ModelStore.ts 原样迁出（行为零变化）：catalog 固定单一事实源
 * preset 解析族（resolveCatalogPresets/条目合成/postulate 无源 stub）、生图
 * 套件条目状态/下载、preset 与持久模型的 reconcile/merge、启动链顺序敏感
 * （initializeStore 留 facade 在异步回调中调用，方法组先挂载）。
 * 挂载方式见 projectionMethods.ts 头注。
 */
import {runInAction} from 'mobx';
import * as RNFS from '@dr.pogodin/react-native-fs';
import DeviceInfo from 'react-native-device-info';

import type {modelStore as modelStoreInstance} from '../ModelStore';
import {
  CATALOG_LLM,
  CATALOG_IMAGEGEN,
  CatalogFile,
  CatalogModel,
  catalogEntryById,
} from '../../utils/modelCatalog';
import {
  DownloadSource,
  fileRemotePath,
  getAvailableSources,
  repoForSource,
  resolveDownloadUrl,
  resolveFileSource,
} from '../../utils/downloadSources';
import {AIOS_ROOT, AIOS_MODELS_DIR} from '../../utils/paths';
import {
  HuggingFaceModel,
  Model,
  ModelFile,
  ModelOrigin,
} from '../../utils/types';
import {deepMerge, hfAsModel, inferRepoFromModelId} from '../../utils';
import {ensureStorageAccess} from '../../utils/androidPermission';
import {hfStore} from '../HFStore';
import {downloadManager} from '../../services/downloads';
import {
  getHFDefaultSettings,
  getLocalModelDefaultSettings,
} from '../../utils/chat';

/** ModelStore 实例类型（类未导出，从单例推导；type-only import 无运行时环） */
type ModelStore = typeof modelStoreInstance;

export function applyCatalogScanMethods(store: ModelStore): void {
  // Resolve the preset list from the fixed catalog (MODEL_MATRIX 代码化单一事实源) —
  // no network, no upstream rules. Populates the full LLM list immediately on
  // first launch: every catalog entry materializes as a stub (source-less ones
  // render without a download button), downloaded models are kept as-is by
  // merge/reconcile keyed on model.id.
  store.resolvePresets = async (): Promise<Model[]> => {
    try {
      return store.resolveCatalogPresets();
    } catch (error) {
      console.warn('[ModelStore] catalog preset resolution failed:', error);
      return [];
    }
  };

  // Materialize the full LLM catalog as origin:HF stubs (identical to an
  // HF-browser add, mirrors the old rules path). Entries with an HF repo get
  // the deterministic download URL from the first available source; entries
  // without any online source (e.g. PC-pushed butler) get a source-less stub
  // so the model is still visible and manageable. Multimodal entries also push
  // their mmproj projector stub so the projection is resolvable for download.
  // Deduped by model.id (author/repo/filename), first wins.
  store.resolveCatalogPresets = (): Model[] => {
    const flat: Model[] = [];
    for (const entry of CATALOG_LLM) {
      const pair = store.catalogEntryToPair(entry);
      if (!pair) {
        flat.push(store.catalogSourceLessStub(entry));
        continue;
      }
      flat.push({
        ...hfAsModel(pair.hfModel, pair.modelFile),
        name: entry.displayName,
        isRulePreset: true,
      });
      for (const extra of entry.extras ?? []) {
        if (!/mmproj/i.test(extra.name)) {
          continue;
        }
        const projPair = store.catalogEntryToPair(entry, extra);
        if (projPair) {
          flat.push({
            ...hfAsModel(projPair.hfModel, projPair.modelFile),
            isRulePreset: true,
          });
        }
      }
    }
    const seen = new Set<string>();
    const presets: Model[] = [];
    for (const model of flat) {
      if (seen.has(model.id)) {
        continue;
      }
      seen.add(model.id);
      presets.push(model);
    }
    return presets;
  };

  // Synthesize the minimal {hfModel, modelFile} pair the unchanged hfAsModel
  // reads from a catalog entry, with no network. The download URL is pinned to
  // the first declared source; HF-derivable data (oid/lfs/templates) resolves at
  // download. An explicit extra file (mmproj) builds its own pair; the main
  // file + extras form the siblings for vision pairing.
  store.catalogEntryToPair = (
    entry: CatalogModel,
    extraFile?: CatalogFile,
  ): {hfModel: HuggingFaceModel; modelFile: ModelFile} | null => {
    if (!entry.hfRepo) {
      return null;
    }
    const sources = getAvailableSources(entry);
    const defaultSource: DownloadSource = sources[0] ?? 'hf';
    const repo = repoForSource(entry, defaultSource) ?? entry.hfRepo;
    const file = extraFile ?? entry.file;
    const filename = file.name;
    const sizeBytes = file.sizeBytes;
    const modelFile: ModelFile = {
      rfilename: filename,
      // 本地落盘名与远程路径解耦：远程改名/子目录由 fileRemotePath 解析
      url: resolveDownloadUrl(
        repo,
        fileRemotePath(file, defaultSource),
        defaultSource,
      ),
      size: sizeBytes,
    };
    const siblings: ModelFile[] = [
      {
        rfilename: entry.file.name,
        size: entry.file.sizeBytes,
        url: resolveDownloadUrl(
          repo,
          fileRemotePath(entry.file, defaultSource),
          defaultSource,
        ),
      },
      ...(entry.extras ?? []).map(f => ({
        rfilename: f.name,
        url: resolveDownloadUrl(
          repo,
          fileRemotePath(f, defaultSource),
          defaultSource,
        ),
        size: f.sizeBytes,
      })),
    ];
    const hfModel = {
      id: entry.hfRepo,
      author: entry.hfRepo.split('/')[0],
      url: `https://huggingface.co/${entry.hfRepo}`,
      specs: {gguf: {total: 0}},
      siblings,
    } as unknown as HuggingFaceModel;
    return {hfModel, modelFile};
  };

  // Source-less catalog entry (no online repo): a stub that is visible and
  // manageable but has no download URL (download button suppressed by guard).
  // The filename matches the shared-storage file so scanLocalModels adoptExisting
  // redirects it once the file is on device.
  store.catalogSourceLessStub = (entry: CatalogModel): Model => {
    const filename = entry.file.name;
    const hfModel = {
      id: `unknown/${filename}`,
      author: 'unknown',
      url: '',
      specs: undefined,
      siblings: [],
    } as unknown as HuggingFaceModel;
    const modelFile: ModelFile = {
      rfilename: filename,
      size: entry.file.sizeBytes,
      url: '',
    };
    return {
      ...hfAsModel(hfModel, modelFile),
      name: entry.displayName,
      isRulePreset: true,
    };
  };

  // 刷新生图条目下载状态（ModelsScreen 挂载/下载完成/下拉刷新时调用）
  // 2026-08-22 Box 清单项 4 收口1：完成态诚实——main 或任一 companion 缺失
  // 都不得显示「已下载」（原只看 main，缺 companions 的套件被误报完整）。
  // 复用 catalog 文件清单（file + extras）逐文件探测，零新逻辑。
  store.refreshCatalogImageGenStatus = async () => {
    const next: {entry: CatalogModel; isDownloaded: boolean}[] = [];
    for (const entry of CATALOG_IMAGEGEN) {
      const allFiles = [entry.file, ...(entry.extras ?? [])];
      let allExist = true;
      for (const file of allFiles) {
        const dir =
          file.dir === 'dreamlite' ? `${AIOS_ROOT}/dreamlite` : AIOS_MODELS_DIR;
        let exists = false;
        try {
          exists = await RNFS.exists(`${dir}/${file.name}`);
        } catch {
          exists = false;
        }
        if (!exists) {
          allExist = false;
          break;
        }
      }
      next.push({entry, isDownloaded: allExist});
    }
    runInAction(() => {
      store.catalogImageGenEntries = next;
    });
  };

  // 生图套件是否任一文件下载中（UI 行内按钮状态）
  store.isCatalogEntryDownloading = (entryId: string): boolean => {
    const entry = catalogEntryById(entryId);
    if (!entry) {
      return false;
    }
    return [entry.file, ...(entry.extras ?? [])].some(f =>
      downloadManager.isDownloading(`${entryId}/${f.name}`),
    );
  };

  // 生图套件下载：逐文件 startDownload（同一 catalog 源，落 AIOS 共享目录——
  // 生图页扫描源），单文件失败显式报错并停止（不静默跳过——锋利）。
  // 跨仓套件（SD3.5/Z-Image companions 分布多仓）按文件解析 repo/远程路径：
  // 文件在首选源无 repo 时自动回退其余可用源。完成回调刷新条目下载状态。
  // 权限守卫与 checkSpaceAndDownload 同点挂接（守卫 hook 指南针统一下载入口）。
  store.downloadCatalogEntry = async (
    entryId: string,
    source: DownloadSource,
  ): Promise<void> => {
    const entry = catalogEntryById(entryId);
    if (!entry) {
      throw new Error(`Catalog entry not found: ${entryId}`);
    }
    if (!(await ensureStorageAccess())) {
      throw new Error('Storage permission not granted for catalog download');
    }
    const files = [entry.file, ...(entry.extras ?? [])];
    // 单次预扫描驱动「存储守卫 + 去重」（2026-08-22 Box 清单项 4 收口2 + 项 5）：
    // 生图下载链此前只查权限、不查存储——klein ~7GB 级套件入库前必须先挂存储闸门。
    // 增量判定 = 未存在文件总和（共享文件 TE zimage_llm.gguf 被 Z-Image/klein 共用，
    // 已存在则不占新空间，避免"已装 Z-Image 再装 klein"被总量误杀）。单一路径，不双扫。
    const pending = await (async () => {
      const list: {
        file: CatalogFile;
        destinationPath: string;
        exists: boolean;
      }[] = [];
      for (const file of files) {
        const destDir =
          file.dir === 'dreamlite' ? `${AIOS_ROOT}/dreamlite` : AIOS_MODELS_DIR;
        const destinationPath = `${destDir}/${file.name}`;
        let exists = false;
        try {
          exists = await RNFS.exists(destinationPath);
        } catch {
          exists = false;
        }
        list.push({file, destinationPath, exists});
      }
      return list;
    })();
    const pendingBytes = pending
      .filter(f => !f.exists)
      .reduce((sum, f) => sum + f.file.sizeBytes, 0);
    if (pendingBytes > 0) {
      const freeBytes = await DeviceInfo.getFreeDiskStorage('important');
      if (pendingBytes > freeBytes) {
        throw new Error(
          `Insufficient storage for catalog suite: need ${Math.ceil(
            pendingBytes / 1073741824,
          )}GB, free ${Math.round(freeBytes / 1073741824)}GB`,
        );
      }
    }
    for (const {file, destinationPath, exists} of pending) {
      if (exists) {
        // 去重：共享文件已存在则跳过重下，显式日志不静默（不做哈希校验——
        // 哈希为不存在的损坏场景兜底，锋利：不预支成本）
        console.log(`[ModelStore] 复用已存在共享文件，跳过下载: ${file.name}`);
        continue;
      }
      const resolved = resolveFileSource(file, entry, source);
      if (!resolved) {
        throw new Error(
          `No download source for catalog file: ${entryId}/${file.name}`,
        );
      }
      const stub = store.catalogFileStub(entry, file, resolved);
      const authToken =
        resolved.source === 'hf' && hfStore.shouldUseToken
          ? hfStore.hfToken
          : null;
      await downloadManager.startDownload(stub, destinationPath, authToken);
    }
    await store.refreshCatalogImageGenStatus();
  };

  // 生图套件单文件 stub（id = 条目 id + 文件名，downloadManager 按此跟踪；
  // rfilename = 本地落盘名，url = 远程 URL——远程改名/子目录由
  // fileRemotePath 解析，两字段解耦）
  store.catalogFileStub = (
    entry: CatalogModel,
    file: CatalogFile,
    resolved: {source: DownloadSource; repo: string},
  ): Model => {
    const hfModel = {
      id: entry.id,
      author: resolved.repo.split('/')[0] ?? 'unknown',
      url: '',
      specs: undefined,
      siblings: [],
    } as unknown as HuggingFaceModel;
    const modelFile: ModelFile = {
      rfilename: file.name,
      size: file.sizeBytes,
      url: resolveDownloadUrl(
        resolved.repo,
        fileRemotePath(file, resolved.source),
        resolved.source,
      ),
    };
    return hfAsModel(hfModel, modelFile);
  };

  // Reconcile the freshly-resolved catalog presets into the model list. Keyed on the
  // full model id (author/repo/filename), which spans origins: a downloaded
  // legacy PRESET and a new origin:HF catalog stub share it, so the kept download
  // suppresses the stub (no duplicate card, no re-download).
  //
  // Two-sided so the list stays equal to the current catalog set:
  //  - prune non-downloaded preset-provenance stubs no longer in the fresh set
  //    (a newer catalog dropped them, or the device re-tiered). Downloaded
  //    models of any origin and user-added HF/LOCAL models are never pruned.
  //  - append the fresh presets not already represented by a kept model.
  store.reconcilePresets = (presets: Model[]) => {
    if (presets.length === 0) {
      return;
    }
    const freshIds = new Set(presets.map(p => p.id));
    const kept = store.models.filter(
      m => !(m.isRulePreset && !m.isDownloaded && !freshIds.has(m.id)),
    );
    const existing = new Set(kept.map(m => m.id));
    const toAdd = presets.filter(p => !existing.has(p.id));
    if (kept.length === store.models.length && toAdd.length === 0) {
      return;
    }
    runInAction(() => {
      store.models = [...kept, ...toAdd];
    });
  };

  store.mergeModelLists = (presets: Model[] = []) => {
    // The default list is data-driven: catalog-resolved origin:HF presets
    // replace the old static PRESET array. Keep every downloaded model
    // regardless of origin, drop non-downloaded PRESET stubs, then reconcile
    // the resolved presets in by model.id (author/repo/filename, origin-spanning)
    // so a kept legacy PRESET download suppresses its catalog stub.
    const mergedModels = [...store.models].filter(
      model => model.origin !== ModelOrigin.PRESET || model.isDownloaded,
    );

    // Handle HF and LOCAL models
    mergedModels.forEach(model => {
      if (
        model.origin === ModelOrigin.HF ||
        model.origin === ModelOrigin.LOCAL ||
        model.isLocal
      ) {
        // Reset default settings
        if (model.origin === ModelOrigin.LOCAL || model.isLocal) {
          const defaultSettings = getLocalModelDefaultSettings();
          model.defaultChatTemplate = {...defaultSettings.chatTemplate};
          model.defaultStopWords = defaultSettings.completionParams.stop;
        } else if (model.origin === ModelOrigin.HF) {
          const defaultSettings = getHFDefaultSettings(
            model.hfModel as HuggingFaceModel,
          );
          model.defaultChatTemplate = {...defaultSettings.chatTemplate};
          model.defaultStopWords = defaultSettings.completionParams.stop;
        }

        // Update current settings while preserving any customizations
        model.chatTemplate = deepMerge(
          model.chatTemplate || {},
          model.defaultChatTemplate,
        );
        model.stopWords = [
          ...(model.stopWords || []),
          ...(model.defaultStopWords || []),
        ];

        // Infer repo from model.id if missing (for existing HF models)
        if (model.origin === ModelOrigin.HF && !model.repo) {
          const inferredRepo = inferRepoFromModelId(model.id);
          if (inferredRepo) {
            model.repo = inferredRepo;
            console.log(
              `[ModelStore] Inferred repo "${inferredRepo}" from model.id: ${model.id}`,
            );
          }
        }
      }
    });

    runInAction(() => {
      store.models = mergedModels;
    });

    store.reconcilePresets(presets);

    store.initializeDownloadStatus();
  };
}
