/**
 * ImageGenScreen — 生图页（P5.4 三行布局 v2，目录化编排层）
 *
 * 布局（用户视角，单列三区）：
 *  顶部：模型状态胶囊 → 点按展开锚定下拉面板（ModelPickerPanel）
 *  ① 结果区（置顶主角）：最新图 + 操作条 + 参数水印；生成中进度 overlay 叠在结果区上（ResultPreview）
 *  ② 历史区（紧凑横条）：横向滑动 + [管理]多选删除（HistoryStrip）
 *  ③ 创作区（底部 composer）：提示词 + 折叠高级参数 + 出图/编辑按钮（ComposerPanel）
 * 键盘：外层 KeyboardAwareScrollView，聚焦输入框自动滚入可见区。
 *
 * 编排层职责：单状态机（预览区分页 previewIndex）+ 业务动作 + 子区组装。
 * 各 Panel 只读 props 渲染；store 状态经 observer 自动联动。
 */
import * as React from 'react';
import {View, FlatList, Text, TouchableOpacity, ScrollView} from 'react-native';
import {CircularActivityIndicator} from '../../components/CircularActivityIndicator';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import {observer} from 'mobx-react-lite';
import {runInAction} from 'mobx';
import {launchImageLibrary} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {imageGenStore, GeneratedImage} from '../../store/imageGenStore';
import {audioStore} from '../../store/audioStore';
import {ttsStore} from '../../store/TTSStore';
import {TtsGenEngineId} from '../../services/ttsEngine';
import {useTheme} from '../../hooks';
import {AIOS_MODELS_DIR} from '../../utils/paths';
import {L10nContext} from '../../utils';
import {t} from '../../locales';
import {
  buildErrorReport,
  copyAndSaveErrorReport,
} from '../../utils/errorReport';
import {
  listAvailableModels,
  resolveCompanions,
} from '../../utils/imageGenManifest';

import {createStyles} from './styles';
import {
  DREAM_EDIT_SIZE,
  DREAMLITE_MANIFEST,
  PROMPT_TOKEN_LIMIT,
  RATIOS,
  SD_RATIOS,
  ModelEntry,
} from './constants';
// B57：旧 useWaveDots 已 git rm；prop 接线保留 → 参数化版本（ui 域单一事实源）
import {useWaveDots} from '../../components/ui/WaveDots/useWaveDots';
import {
  ModelPickerTrigger,
  ModelPickerDropdown,
} from './components/ModelPickerPanel';
import {ResultPreview, PreviewBanner} from './components/ResultPreview';
import {BenchmarkHudBar} from '../../components/BenchmarkHudBar';
import {HistoryStrip} from './components/HistoryStrip';
import {ComposerPanel} from './components/ComposerPanel';
import {GenActionBar} from './components/GenActionBar';
import {QueuePanel} from './components/QueuePanel';
import {GenParamsSnapshot, QueueItem} from '../../store/imageGenQueueCore';
import {UpscalePanel} from './components/UpscalePanel';
import {AudioWorkshopTab} from './components/AudioWorkshopTab';
import {confirmDialog} from '../../components/ui/ConfirmDialog';
import {OverlayCard} from '../../components/ui/OverlayCard';
import {SRStyle} from '../../services/superResEngine';

/** v5.3：图片类任务判定（相册/启动定位共用）——音频内容（transcribe/tts）不属相册 */
const isImageKind = (kind?: string): boolean =>
  ['generated', 'upload', 'upscaled', 'caption'].includes(kind ?? 'generated');

/** 生成引擎三选（B35：顶栏胶囊切换；B36：屏级 overlay 下拉 + 行内下载/删除） */
const GEN_ENGINES: {
  id: TtsGenEngineId;
  label: string;
  size: string;
  note: string;
}[] = [
  {id: 'kokoro', label: 'Kokoro', size: '330MB', note: '多音色 · 默认'},
  {id: 'supertonic', label: 'Supertonic', size: '380MB', note: '31 语种'},
  {id: 'kitten', label: 'Kitten', size: '57MB', note: '轻量快速 · 配额安全'},
];

/** 引擎下载状态（与 TTSStore 三引擎状态机镜像） */
const engineState = (id: TtsGenEngineId) =>
  id === 'kokoro'
    ? ttsStore.kokoroDownloadState
    : id === 'supertonic'
      ? ttsStore.supertonicDownloadState
      : ttsStore.kittenDownloadState;

/** 底部吸底操作条固定预留（按钮 ~48 + 上下 padding 8×2 + hairline；insets 动态另加） */
const ACTION_BAR_RESERVE = 64;

export const ImageGenScreen: React.FC = observer(() => {
  const theme = useTheme();
  const l10n = React.useContext(L10nContext);
  const s = createStyles(theme);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [available, setAvailable] = React.useState<ModelEntry[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [negativePrompt, setNegativePrompt] = React.useState('');
  const [steps, setSteps] = React.useState('4'); // DreamLite mobile 官方 4 步（DMD2 蒸馏）
  const [cfg, setCfg] = React.useState('2');
  const [size, setSize] = React.useState(512);
  const [seed, setSeed] = React.useState(''); // 6.18 空=随机，填数可复现/调试
  // 08-18 路线 B：运行时 LoRA 开关（默认关=纯 base；multiplier 默认 manifest 值，供强度梯度）
  const [loraEnabled, setLoraEnabled] = React.useState(false);
  const [loraMult, setLoraMult] = React.useState('2.0');
  const [scanning, setScanning] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  // 2026-08-26 提示词卡折叠（编辑预备态强制展开——派生 effectiveCollapsed）
  const [promptCollapsed, setPromptCollapsed] = React.useState(false);
  const [showModelDrop, setShowModelDrop] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [manageMode, setManageMode] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<string[]>([]);
  // 预览区分页索引（单状态机）：0=编辑槽（上传/编辑），≥1=历史第 i-1 张
  const [previewIndex, setPreviewIndex] = React.useState(0);
  // 同步镜像 ref：FlatList onLayout 回调闭包需要读到最新索引（state 异步更新会拿到旧值）
  const previewIndexRef = React.useRef(0);
  const setPreviewIndexSync = React.useCallback((v: number) => {
    previewIndexRef.current = v;
    setPreviewIndex(v);
  }, []);
  const previewRef = React.useRef<FlatList<GeneratedImage> | null>(null);
  const bootedRef = React.useRef(false);
  const [ratio, setRatio] = React.useState('1:1');
  const dreamW = RATIOS[ratio]?.[0] ?? 1024;
  const dreamH = RATIOS[ratio]?.[1] ?? 1024;
  const [editSource, setEditSource] = React.useState<string | null>(null);
  const [editRgb, setEditRgb] = React.useState<Float32Array | null>(null);
  // 编辑视觉通道条件：512² 源图 [-1,1]（TE ViT 输入，与 editRgb 双解码同源，官方 edit 语义）
  const [editVisRgb, setEditVisRgb] = React.useState<Float32Array | null>(null);
  const [pageW, setPageW] = React.useState(0);
  // 编辑预备态：已点「编辑」锁定当前预览图，正在输入编辑指令（再点「执行编辑」二创）
  const [editArming, setEditArming] = React.useState(false);
  // 进行中任务类型：'gen'=新生成（预览区空白页动效）｜'edit'=二创当前图（图上叠动效）｜'caption'=反推（图上叠动效）
  const [taskKind, setTaskKind] = React.useState<
    'gen' | 'edit' | 'caption' | null
  >(null);
  // P6-6：高清放大参数面板显隐（独立通用能力入口）
  const [upscaleVisible, setUpscaleVisible] = React.useState(false);
  // 未加载引导弹窗（2026-08-21）：非 Dream 点出图未加载 → 提示 + 展开模型下拉
  const [loadGuideVisible, setLoadGuideVisible] = React.useState(false);
  // 信息条点击：当前查看完整生图参数的任务条目（提示词/耗时/尺寸/模型/种子/步数）
  const [infoItem, setInfoItem] = React.useState<GeneratedImage | null>(null);
  // 工坊双 tab（IMAGEGEN_UI_SPEC §8）：image=生图（现状）｜audio=音频工坊
  const [workshopTab, setWorkshopTab] = React.useState<'image' | 'audio'>(
    'image',
  );
  // 任务购物车（IMAGEGEN_QUEUE_SPEC）：队列面板显隐 + 编辑目标条目
  const [queueVisible, setQueueVisible] = React.useState(false);
  const editingQueueIdRef = React.useRef<string | null>(null);
  // B35：音频顶栏引擎选择下拉显隐（模型只在顶栏）
  const [showAudioEngineDrop, setShowAudioEngineDrop] = React.useState(false);
  // 顶栏音频胶囊状态点：当前引擎就绪
  // observer 本地读（MobX 惯例）：引擎/下载态是 observable 属性，先读入 render 局部
  // 变量——任一变化触发 observer 重渲染 → 局部变量刷新 → useMemo 重算就绪派生。
  const genEngine = audioStore.genEngine;
  const kokoroDownloadState = ttsStore.kokoroDownloadState;
  const supertonicDownloadState = ttsStore.supertonicDownloadState;
  const kittenDownloadState = ttsStore.kittenDownloadState;
  const audioHeaderReady = React.useMemo(() => {
    const st =
      genEngine === 'kokoro'
        ? kokoroDownloadState
        : genEngine === 'supertonic'
          ? supertonicDownloadState
          : kittenDownloadState;
    return st === 'ready';
  }, [
    genEngine,
    kokoroDownloadState,
    supertonicDownloadState,
    kittenDownloadState,
  ]);

  // 预览卡片顶部横幅（v4.3 大王裁定：生图页轻提示弃用底部 Snackbar，统一预览卡片顶部
  // BannerBar overlay；语义色 wash 无灰底；瞬时反馈 3s 点击即消，编辑锁定常驻走 editArming 派生）
  type BannerMsg = {text: string; variant: 'info' | 'error' | 'warning'};
  const [banner, setBanner] = React.useState<BannerMsg | null>(null);
  const bannerTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = React.useCallback(
    (text: string, variant: BannerMsg['variant'] = 'info') => {
      setBanner({text, variant});
      if (bannerTimer.current) {
        clearTimeout(bannerTimer.current);
      }
      bannerTimer.current = setTimeout(() => setBanner(null), 3000);
    },
    [],
  );
  React.useEffect(
    () => () => {
      if (bannerTimer.current) {
        clearTimeout(bannerTimer.current);
      }
    },
    [],
  );
  // 生成/编辑进行中：三点波浪动效
  const waveDots = useWaveDots(imageGenStore.generating);

  // observer 本地读：依赖变化时重新执行计时器（loading/generating 期间每 2s 刷新 now）
  const generating = imageGenStore.generating;
  const loading = imageGenStore.loading;
  React.useEffect(() => {
    if (!generating && !loading) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, [generating, loading]);

  const scanModels = React.useCallback(async () => {
    setScanning(true);
    try {
      const list = await listAvailableModels(AIOS_MODELS_DIR);
      // DreamLite 固定置顶且默认选中（当前唯一完整可用）；实验性模型（SD3.5/Z-Image）排后
      const withDream = [{manifest: DREAMLITE_MANIFEST, mainPath: ''}, ...list];
      setAvailable(withDream);
      if (!selectedId) {
        setSelectedId(DREAMLITE_MANIFEST.id);
      }
    } catch (e) {
      console.warn('[ImageGenScreen] scan failed:', e);
    } finally {
      setScanning(false);
    }
  }, [selectedId]);

  React.useEffect(() => {
    imageGenStore.init();
    scanModels();
  }, [scanModels]);
  // 任务购物车（IMAGEGEN_QUEUE_SPEC §九）：队列水合（重启恢复 planning 态）
  React.useEffect(() => {
    imageGenStore.initQueue();
  }, []);

  // 启动定位：有图片历史直接显示最新一张（页 1），无历史停在 0 页编辑槽
  // v5.3：跳过音频条目（transcribe/tts）——启动定位到首个图片类条目，避免转写结果污染提示词/预览
  React.useEffect(() => {
    if (
      bootedRef.current ||
      pageW === 0 ||
      imageGenStore.history.length === 0
    ) {
      return;
    }
    const firstImage = imageGenStore.history.find(h => isImageKind(h.kind));
    if (!firstImage) {
      return;
    }
    bootedRef.current = true;
    const idx = imageGenStore.history.indexOf(firstImage);
    setPreviewIndexSync(idx + 1);
    previewRef.current?.scrollToOffset({
      offset: idx * pageW,
      animated: false,
    });
    syncFromParams(firstImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageGenStore.history.length, pageW]);

  React.useEffect(() => {
    if (imageGenStore.pendingPrompt) {
      setPrompt(imageGenStore.pendingPrompt);
      runInAction(() => {
        imageGenStore.pendingPrompt = null;
      });
    }
  }, []);

  // 聊天图片卡片「编辑图片」深链（2026-08）：消费 pendingEditSource →
  // 解码源图入编辑槽 + 进入编辑预备态（与相册上传同一入口函数）。
  React.useEffect(() => {
    if (imageGenStore.pendingEditSource) {
      const uri = imageGenStore.pendingEditSource;
      runInAction(() => {
        imageGenStore.pendingEditSource = null;
      });
      ingestEditSource(uri, '聊天图片已锁定');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!selectedId) {
      return;
    }
    const m = available.find(a => a.manifest.id === selectedId);
    if (!m) {
      return;
    }
    setSteps(String(m.manifest.defaults.steps));
    setCfg(String(m.manifest.defaults.cfg));
    setSize(m.manifest.defaults.size);
  }, [selectedId, available]);

  const selectedEntry =
    available.find(a => a.manifest.id === selectedId) ?? null;

  const isDream = selectedEntry?.manifest.family === 'dreamlite';
  const loaded = isDream
    ? imageGenStore.dreamliteLoaded
    : imageGenStore.modelLoaded;
  // 局部捕获 store 属性（observer 重渲染时刷新；exhaustive-deps 只认组件作用域量）
  const genLoading = imageGenStore.loading;
  const historyLen = imageGenStore.history.length;

  // 预览分页派生（单状态机）：0 页 = 编辑槽（上传图）；≥1 = 历史图。
  // 编辑目标 = 当前预览区显示的图（0 页=editSource，历史页=currentImage），由「编辑」按钮锁定。
  const currentImage =
    previewIndex > 0
      ? (imageGenStore.history[previewIndex - 1]?.uri ?? null)
      : null;
  const currentItem =
    previewIndex > 0 ? (imageGenStore.history[previewIndex - 1] ?? null) : null;

  const loadEntry = async (entry: ModelEntry) => {
    if (entry.manifest.family === 'dreamlite') {
      const ok = await imageGenStore.loadDreamLiteEntry();
      if (!ok) {
        await pushLoadFailedTask(entry.manifest.label);
      }
      return;
    }
    const {extras, missing} = await resolveCompanions(
      entry.manifest,
      AIOS_MODELS_DIR,
    );
    if (missing.length > 0) {
      const summary = `缺少伴侣文件：${missing.join('、')}`;
      runInAction(() => {
        imageGenStore.error = summary;
      });
      const report = await buildErrorReport({
        scope: 'imagegen',
        summary,
        extra: {模型: entry.manifest.label},
      });
      await imageGenStore.pushFailedTask(
        failedTaskBase(entry.manifest.label, entry.manifest.family),
        summary,
        report.detail,
      );
      scrollToPreview(1);
      return;
    }
    const ok = await imageGenStore.loadModel(
      entry.mainPath,
      {...extras, backend: entry.manifest.defaults.backend},
      entry.manifest.id,
    );
    if (!ok) {
      await pushLoadFailedTask(entry.manifest.label);
    }
  };

  // 失败任务条目基座（非生成类错误：加载/解码/伴侣文件）
  const failedTaskBase = (
    modelLabel: string,
    family?: string,
  ): Omit<GeneratedImage, 'taskId' | 'status'> => ({
    uri: '',
    prompt: '',
    seed: 0,
    ts: Date.now(),
    width: 0,
    height: 0,
    family,
    kind: 'generated',
    modelLabel,
  });

  // 加载失败 → failed 任务页（报错唯一出口 = 预览区）
  const pushLoadFailedTask = async (modelLabel: string) => {
    const summary = imageGenStore.error ?? '模型加载失败';
    const report = await buildErrorReport({
      scope: 'imagegen',
      summary,
      extra: {模型: modelLabel},
    });
    await imageGenStore.pushFailedTask(
      failedTaskBase(modelLabel),
      summary,
      report.detail,
    );
    scrollToPreview(1);
  };

  // 生成/编辑失败：组装完整报错报告回填任务（页面保留，可一键复制）
  const failTaskWithReport = async (
    taskId: string,
    summary: string,
    extra: Record<string, string | number | undefined>,
  ) => {
    const report = await buildErrorReport({
      scope: 'imagegen',
      summary,
      error: imageGenStore.error ?? summary,
      extra,
    });
    await imageGenStore.failTask(taskId, report.summary, report.detail);
  };

  // 失败任务页：一键复制完整报错（复制 + 落盘 AIOS/logs）
  const handleCopyError = async (item: GeneratedImage) => {
    const path = await copyAndSaveErrorReport({
      summary: item.errorSummary ?? '生图失败',
      detail: item.errorDetail ?? '',
    });
    showBanner(
      path
        ? t(l10n.errorReport.copiedSaved, {path})
        : l10n.errorReport.copiedFallback,
    );
  };

  // 失败任务页：同参数重试（回填参数后用该任务的提示词重新发起）
  const handleRetryTask = (item: GeneratedImage) => {
    if (item.kind === 'caption') {
      // 反推任务重试 = 同图重新反推（IMAGEGEN_UI_SPEC §7.2）
      if (item.uri) {
        handleCaptionFrom(item.uri);
      }
      return;
    }
    syncFromParams(item);
    handleGenerate(item.prompt);
  };

  // 反推当前预览图：0 页=编辑槽上传图，历史页=当前历史图（v4 显式按钮动作）
  const handleCaptionFrom = async (targetUri: string) => {
    if (imageGenStore.generating) {
      return;
    }
    // 2026-08-27 大王裁定：反推=生图流程——任务开始即滚入 running 任务页
    //（blank 页 + 完整 PerfPanel，与生成完全一致），不再叠图遮挡
    setTaskKind('caption');
    scrollToPreview(1);
    const text = await imageGenStore.runCaptionTask(targetUri);
    setTaskKind(null);
    scrollToPreview(1); // 结果回填 history[0] → 结果页
    if (text) {
      setPrompt(text); // 结果回填 composer（用户可见可改）
      showBanner('反推完成，可复制或复刻生图');
    } else {
      showBanner('反推失败，详见结果区', 'error');
    }
  };

  const handleCaption = () => {
    const targetUri = previewIndex === 0 ? editSource : currentImage;
    if (!targetUri) {
      showBanner('先上传或生成一张图片，再反推提示词', 'warning');
      return;
    }
    handleCaptionFrom(targetUri);
  };

  // 反推结果一键复制（clipboard 纯文本，不落盘）
  const handleCopyCaption = (item: GeneratedImage) => {
    Clipboard.setString(item.prompt || '');
    showBanner('反推提示词已复制');
  };

  // 复刻生图（v5：RemakeSheet 删除，提示词已回填 composer，直接切生图 tab 出图；
  // 参数调整走高级参数卡——模型在顶栏，IMAGEGEN_UI_SPEC §7.3）
  const handleRemake = (item: GeneratedImage) => {
    setWorkshopTab('image');
    setPrompt(item.prompt || '');
    handleGenerate(item.prompt || '');
  };

  // 失败任务页：删除该任务条目
  const handleDeleteTask = (item: GeneratedImage) => {
    imageGenStore.deleteTask(item.taskId);
    scrollToPreview(0, false);
  };

  // 卸载（行内按钮）
  const doUnload = async (entry: ModelEntry) => {
    if (entry.manifest.family === 'dreamlite') {
      await imageGenStore.unloadDreamLiteEntry();
      return;
    }
    await imageGenStore.unloadModel();
  };

  // 行内按钮：加载 / 卸载（卸载二次确认，统一弹窗设计语言）
  const handleRowAction = async (entry: ModelEntry) => {
    setSelectedId(entry.manifest.id);
    setEditArming(false); // 切模型即退出编辑预备态（同 handleSelectModel）
    setEditRgb(null);
    setEditVisRgb(null);
    if (isRowLoaded(entry)) {
      const ok = await confirmDialog({
        title: '卸载模型',
        message: `确定卸载「${entry.manifest.label}」吗？内存将被释放。`,
        confirmText: '卸载',
        destructive: true,
      });
      if (ok) {
        doUnload(entry);
      }
      return;
    }
    // 点加载才开始动作：折叠面板 + 面板内出现加载中提示
    setShowModelDrop(false);
    loadEntry(entry);
  };

  // 行内按钮状态：该行模型是否已加载
  const isRowLoaded = (entry: ModelEntry) => {
    if (entry.manifest.family === 'dreamlite') {
      return imageGenStore.dreamliteLoaded;
    }
    return (
      imageGenStore.modelLoaded &&
      imageGenStore.loadedModelId === entry.manifest.id
    );
  };

  // 胶囊快速加载：直接加载当前选中模型，不展开下拉（默认 DreamLite 一键就绪）
  // loadEntry 为渲染期普通函数（内部引用 scrollToPreview/pushLoadFailedTask 等组件
  // 级派生），经 latest-ref 桥接稳定调用——handleQuickLoad 保持引用稳定（依赖仅
  // selectedEntry），避免其每次渲染重建拖累下方 header effect 高频重跑，行为等价。
  const loadEntryRef = React.useRef(loadEntry);
  loadEntryRef.current = loadEntry;
  const handleQuickLoad = React.useCallback(() => {
    if (selectedEntry) {
      loadEntryRef.current(selectedEntry);
    }
  }, [selectedEntry]);

  // B36：音频引擎行内动作（未就绪下载 / 就绪删除；删除二次确认——与生图模型卸载同一交互）
  const handleAudioEngineAction = async (
    id: TtsGenEngineId,
    ready: boolean,
  ) => {
    if (!ready) {
      if (id === 'kokoro') {
        await ttsStore.downloadKokoro();
      } else if (id === 'supertonic') {
        await ttsStore.downloadSupertonic();
      } else {
        await ttsStore.downloadKitten();
      }
      return;
    }
    const e = GEN_ENGINES.find(x => x.id === id);
    const ok = await confirmDialog({
      title: '删除引擎',
      message: `确定删除「${e?.label ?? id}」吗？模型文件将被移除（可重新下载）。`,
    });
    if (!ok) {
      return;
    }
    if (id === 'kokoro') {
      await ttsStore.deleteKokoro();
    } else if (id === 'supertonic') {
      await ttsStore.deleteSupertonic();
    } else {
      await ttsStore.deleteKitten();
    }
  };

  // 下拉选中：只选中高亮 + 回填参数。不折叠面板、不加载、不切模式（点卡片只是“看参数”）。
  // 切换模型即退出编辑预备态（目标图/引擎语境已变，防状态残留，2026-08-21）
  const handleSelectModel = (entry: ModelEntry) => {
    setSelectedId(entry.manifest.id);
    setEditArming(false);
    setEditRgb(null);
    setEditVisRgb(null);
  };

  // 预览分页跳转：0=编辑槽，i≥1=历史第 i-1 张（任何手动导航均视为已完成启动定位）
  const scrollToPreview = (idx: number, animated = true) => {
    bootedRef.current = true;
    setEditArming(false); // 导航即退出编辑预备态（目标图已变）
    setPreviewIndexSync(idx);
    previewRef.current?.scrollToOffset({offset: idx * pageW, animated});
  };

  // 开发项3：PNG 内嵌真实生成参数——覆盖令牌（防慢文件读覆盖后翻页的回填）
  const metaSyncSeq = React.useRef(0);
  // 回填该历史图的提示词/参数（预览翻页与历史缩略图点击共用）。
  // 两段式回填：DB 字段即时打底；PNG 内嵌 aios.gen meta 异步覆盖「真实生成参数」
  // （比 DB 字段更贴近真实出图；无 meta→旧图/外部图→保留 DB 字段，不报错不占位）。
  const syncFromParams = (item: {
    uri: string;
    prompt: string;
    width: number;
    height?: number;
    steps?: number;
    cfg?: number;
    family?: string;
  }) => {
    setPrompt(item.prompt);
    if (item.family === 'dreamlite') {
      // 历史回填：按像素反查官方画幅档位
      const r = Object.entries(RATIOS).find(
        ([, wh]) => wh[0] === item.width && wh[1] === (item.height ?? wh[1]),
      );
      if (r) {
        setRatio(r[0]);
      }
    } else if (item.width) {
      // 08-18 升级：按像素反查 SD 比例档（历史图回填比例，保持参数一致）
      const r2 = Object.entries(SD_RATIOS).find(
        ([, wh]) => wh[0] === item.width && wh[1] === (item.height ?? wh[1]),
      );
      if (r2) {
        setRatio(r2[0]);
      } else {
        setSize(item.width);
      }
    }
    if (item.steps) {
      setSteps(String(item.steps));
    }
    if (item.cfg) {
      setCfg(String(item.cfg));
    }
    // 异步覆盖：PNG 内嵌真实参数（仅数值类 steps/cfg/seed；prompt 以 DB 为准，
    // meta 内 prompt 可能被 512 字节截断，覆盖会让用户看到缩水提示词）
    const seq = ++metaSyncSeq.current;
    void imageGenStore.readPngMetaFile(item.uri).then(meta => {
      if (!meta || metaSyncSeq.current !== seq) {
        return;
      }
      if (meta.steps != null) {
        setSteps(String(meta.steps));
      }
      if (meta.cfg != null) {
        setCfg(String(meta.cfg));
      }
    });
  };

  // FlatList（重新）挂载完成（onLayout，布局已就绪，scrollToOffset 必然生效）：
  //  - 未定位过（bootedRef false）：有历史则启动定位到最新图（页 1）；无历史停在编辑槽
  //  - 已定位过：恢复当前 previewIndex 页（避免切 Tab 回来回到 0 页）
  const handleListReady = React.useCallback(() => {
    const idx = previewIndexRef.current;
    if (!bootedRef.current) {
      if (historyLen > 0 && pageW > 0) {
        bootedRef.current = true;
        previewIndexRef.current = 1;
        setPreviewIndex(1);
        syncFromParams(imageGenStore.history[0]);
        previewRef.current?.scrollToOffset({offset: pageW, animated: false});
      }
      return;
    }
    if (idx >= 1 && pageW > 0) {
      previewRef.current?.scrollToOffset({
        offset: idx * pageW,
        animated: false,
      });
    }
  }, [pageW, historyLen]);

  // 再次生成 = 当前图同参数重新生成（复查 2026-08-20）：用任务自带 prompt
  // 而非当前输入框——输入框被清空/编辑预备态清 prompt 后再次生成仍有效，
  // 与失败页「重试」同一语义（handleGenerate(item.prompt)）。
  const handleReroll = () => {
    if (currentItem) {
      syncFromParams(currentItem);
      handleGenerate(currentItem.prompt);
    } else {
      handleGenerate(); // 无当前图（编辑槽）时回落当前输入框
    }
  };

  // 编辑源图入槽（单一入口：相册上传 / 聊天图片卡片「编辑图片」深链共用）：
  // 解码 RGB → 入历史横条 → 定位 0 页编辑槽 → 进入编辑预备态。
  const ingestEditSource = async (rawUri: string, toastPrefix = '已选图') => {
    const path = rawUri.replace('file://', '');
    setEditSource(path);
    // 08-24 编辑单契约：固定 1024²（官方最小方形训练桶），不再跟随画幅取 min 边
    const sq = DREAM_EDIT_SIZE;
    try {
      // 双解码：sq² → UNet cond；512² → TE 视觉通道（ViT）
      const rgb = await imageGenStore.decodeEditImage(path, sq);
      setEditRgb(rgb);
      const visRgb = await imageGenStore.decodeEditImage(path, 512);
      setEditVisRgb(visRgb);
      // 源图入历史横栏（可点选查看/编辑），并在 0 页编辑槽显示
      imageGenStore.pushHistory({
        uri: `file://${path}`,
        prompt: '',
        seed: Date.now() % 1e9,
        ts: Date.now(),
        width: sq,
        height: sq,
        family: 'dreamlite',
        kind: 'upload',
        taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        status: 'success',
      });
      setPrompt(''); // 新源图无历史提示词，清空输入区
      scrollToPreview(0);
      setEditArming(true); // 入槽即进入编辑预备：目标=刚入槽的图
      showBanner(
        `${toastPrefix}（压缩至 ${sq}×${sq}），输入编辑指令后点「执行编辑」`,
      );
    } catch (e) {
      runInAction(() => {
        imageGenStore.error = `解码图片: ${(e as any)?.message ?? e}`;
      });
      const summary = `解码图片失败：${(e as any)?.message ?? e}`;
      const report = await buildErrorReport({
        scope: 'imagegen',
        summary,
        error: e,
        extra: {源图: path},
      });
      await imageGenStore.pushFailedTask(
        failedTaskBase('DreamLite', 'dreamlite'),
        summary,
        report.detail,
      );
      scrollToPreview(1);
    }
  };

  const handlePickEditImage = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: false,
    });
    const p = res.assets?.[0]?.uri;
    if (!p) {
      return;
    }
    await ingestEditSource(p);
  };

  // 编辑按钮（预备→执行单按钮）：浏览态点按=锁定当前预览图进入编辑预备；
  // 预备态点按（「执行编辑」）=对锁定图执行二创。
  const handleEditArm = async () => {
    if (imageGenStore.generating) {
      return;
    }
    // 非 Dream（SD3.5/Z-Image 无编辑引擎）：确认后自动切 DreamLite 并锁定当前图——
    // 一次点击完成「切模型 + 进编辑预备态」（2026-08-21，入口常驻新手友好）
    if (!isDream) {
      const ok = await confirmDialog({
        title: '编辑需要 DreamLite',
        message:
          '当前模型（SD3.5/Z-Image）不支持图像编辑，切换到 DreamLite 继续？',
        confirmText: '切换并编辑',
      });
      if (!ok) {
        return;
      }
      setSelectedId(DREAMLITE_MANIFEST.id);
      // 不 return：继续走下方锁定流程（切换后编辑预备态一次成型）
    }
    if (editArming) {
      handleEditRun();
      return;
    }
    // 编辑目标 = 当前预览区显示的图：0 页=上传图，历史页=当前历史图
    const targetUri = previewIndex === 0 ? editSource : currentImage;
    if (!targetUri) {
      showBanner('先上传一张本地图片，再输入编辑指令', 'warning');
      await handlePickEditImage();
      return;
    }
    setEditArming(true);
    setPrompt(''); // 编辑指令与生成提示词语义不同，从头输入
    const sq = DREAM_EDIT_SIZE;
    if (previewIndex === 0 && editRgb) {
      // 上传图已在上传时预解码，无需重复（锁定提示 = 顶部常驻横幅，editArming 派生）
      return;
    }
    try {
      // 双解码：sq² → UNet cond；512² → TE 视觉通道（ViT）
      const rgb = await imageGenStore.decodeEditImage(
        targetUri.replace('file://', ''),
        sq,
      );
      setEditRgb(rgb);
      const visRgb = await imageGenStore.decodeEditImage(
        targetUri.replace('file://', ''),
        512,
      );
      setEditVisRgb(visRgb);
    } catch (e) {
      setEditArming(false);
      runInAction(() => {
        imageGenStore.error = `解码图片: ${(e as any)?.message ?? e}`;
      });
      const summary = `解码图片失败：${(e as any)?.message ?? e}`;
      const report = await buildErrorReport({
        scope: 'imagegen',
        summary,
        error: e,
      });
      await imageGenStore.pushFailedTask(
        failedTaskBase('DreamLite', 'dreamlite'),
        summary,
        report.detail,
      );
      scrollToPreview(1);
    }
  };

  const handleEditRun = async () => {
    if (!editRgb || !editVisRgb) {
      return;
    }
    const sq = DREAM_EDIT_SIZE;
    const startTs = Date.now();
    const modelLabel = selectedEntry?.manifest.label ?? 'DreamLite';
    // 任务化：先建 running 条目；编辑动效仍叠当前图（taskKind=edit）
    const taskId = await imageGenStore.beginTask({
      uri: '',
      prompt: prompt.trim(),
      seed: Date.now() % 1e9,
      ts: Date.now(),
      width: sq,
      height: sq,
      steps: parseInt(steps, 10) || 4,
      family: 'dreamlite',
      kind: 'generated',
      modelLabel,
    });
    setTaskKind('edit'); // 编辑 blank 任务页（2026-08-27：与生成同一路径，不再叠图）
    scrollToPreview(1);
    const uri = await imageGenStore.editDreamLiteEntry(
      editRgb,
      sq,
      sq,
      parseInt(steps, 10) || 4,
      prompt.trim(), // 编辑指令（官方 diptych 语义文本条件 + ViT 视觉 token）
      editVisRgb,
    );
    setTaskKind(null);
    if (!uri) {
      // 失败：页面保留（failed 任务页，可一键复制报错）
      await failTaskWithReport(taskId, '编辑失败', {
        模型: modelLabel,
        尺寸: `${sq}×${sq}`,
        指令: prompt.trim(),
      });
      scrollToPreview(1);
      return;
    }
    setEditRgb(null);
    setEditVisRgb(null);
    setEditSource(null);
    await imageGenStore.finishTask(taskId, uri, {
      durationMs: Date.now() - startTs,
    });
    // 新图在 history[0] → 预览页 1
    scrollToPreview(1);
    showBanner('编辑完成');
  };

  const handleGenerate = async (promptOverride?: string) => {
    const p = (promptOverride ?? prompt).trim();
    console.info(
      `[ImageGen] handleGenerate prompt='${p.slice(0, 30)}' isDream=${isDream} selected=${selectedEntry?.manifest.id ?? 'none'} generating=${imageGenStore.generating}`,
    );
    if (!p) {
      // 复查 2026-08-20：空提示词点「出图」必须显式反馈（不静默）——
      // 此前静默早退导致「有动效无反应」，两台真机稳定复现
      showBanner('先输入提示词，再点出图', 'warning');
      return;
    }
    // 未加载引导（2026-08-21，仅非 Dream；DreamLite 点出图自动加载不变）：
    // 按钮不再灰置，点击弹提示 + 展开模型下拉让用户选模型加载（新手友好）
    if (!isDream && !loaded) {
      if (imageGenStore.loading) {
        showBanner('模型加载中，请稍候', 'warning');
        return;
      }
      setLoadGuideVisible(true);
      return;
    }
    setEditArming(false); // 出图退出编辑预备态
    const snapshot = buildSnapshot(p);
    if (!snapshot) {
      showBanner('先输入提示词，再点出图', 'warning');
      return;
    }
    const genW = snapshot.width;
    const genH = snapshot.height;
    // D2 收口（IMAGEGEN_QUEUE_SPEC §十三 S1）：出图按钮与队列共用 runGenTask
    // 单链路（任务化一体）；组件层仅保留校验/引导/动效。动效在 running 条目
    // 落库后触发（onTaskStarted），保持「空白页+进度」时序与旧版一致。
    setTaskKind('gen');
    scrollToPreview(1);
    const uri = await imageGenStore.runGenTask(snapshot, {
      onTaskStarted: () => {
        // 条目已入画廊 history[0] → 翻到 running 任务页（动效叠加）
        scrollToPreview(1);
      },
    });
    setTaskKind(null);
    if (uri) {
      // 新图在 history[0] → 预览页 1
      scrollToPreview(1);
      showBanner(`生成完成（${genW}×${genH}）`);
    } else {
      scrollToPreview(1);
    }
  };

  // ===== 任务购物车（IMAGEGEN_QUEUE_SPEC）：快照组装与队列动作 =====

  /** 当前表单 + 选中模型 → 自包含快照（mainPath/伴侣/backend/lora 按 manifest 解析）
   *  promptOverride：任务重试/复刻生图等显式提示词（优先于表单） */
  const buildSnapshot = (promptOverride?: string): GenParamsSnapshot | null => {
    const p = (promptOverride ?? prompt).trim();
    if (!p) {
      return null;
    }
    // seed=0 语义：“未指定，每次随机”（实机验收修正 2026-08-27：随机会破坏
    // 快照去重累加——同参数重复点击必须加抽而非拆条；执行时每抽随机化）
    const seedNum = seed.trim() ? parseInt(seed, 10) || 0 : 0;
    if (isDream) {
      return {
        prompt: p,
        negativePrompt: '',
        steps: parseInt(steps, 10) || 4,
        cfg: 1,
        width: dreamW,
        height: dreamH,
        ratio,
        seed: seedNum,
        family: 'dreamlite',
        modelId: DREAMLITE_MANIFEST.id,
        loraEnabled: false,
        loraMultiplier: 1,
      };
    }
    const m = selectedEntry;
    if (!m) {
      return null;
    }
    const comps = m.manifest.companions;
    return {
      prompt: p,
      negativePrompt: negativePrompt.trim(),
      steps: parseInt(steps, 10) || 2,
      cfg: parseFloat(cfg) || 2,
      width: SD_RATIOS[ratio]?.[0] ?? size,
      height: SD_RATIOS[ratio]?.[1] ?? size,
      ratio,
      seed: seedNum,
      family: m.manifest.family,
      modelId: m.manifest.id,
      loraEnabled: loraEnabled && !!m.manifest.lora,
      loraMultiplier: parseFloat(loraMult) || 1,
      mainPath: m.mainPath,
      companionPaths: comps
        ? {
            clipL: comps.clipL
              ? `${AIOS_MODELS_DIR}/${comps.clipL}`
              : undefined,
            clipG: comps.clipG
              ? `${AIOS_MODELS_DIR}/${comps.clipG}`
              : undefined,
            llm: comps.llm ? `${AIOS_MODELS_DIR}/${comps.llm}` : undefined,
            vae: comps.vae ? `${AIOS_MODELS_DIR}/${comps.vae}` : undefined,
          }
        : undefined,
      backend: m.manifest.defaults.backend,
      loraPath: m.manifest.lora
        ? `${AIOS_MODELS_DIR}/${m.manifest.lora}`
        : undefined,
    };
  };

  /** ➕ 入队（规划期）；编辑态（editingQueueIdRef）下为「更新条目」 */
  const handleEnqueue = () => {
    if (
      imageGenStore.loading ||
      imageGenStore.generating ||
      imageGenStore.queueState === 'running' ||
      imageGenStore.queueState === 'stopping'
    ) {
      return;
    }
    if (!isDream && !loaded && !imageGenStore.loading) {
      setLoadGuideVisible(true); // 未加载引导与出图同链路
      return;
    }
    const snapshot = buildSnapshot();
    if (!snapshot) {
      showBanner('先输入提示词，再加进队列', 'warning');
      return;
    }
    const editingId = editingQueueIdRef.current;
    if (editingId) {
      imageGenStore.updateQueueItem(editingId, snapshot);
      editingQueueIdRef.current = null;
      showBanner('队列条目已更新');
      return;
    }
    // 实机验收收敛（2026-08-27 平板）：➕ = 纯入队（banner 反馈）——面板一律经
    //「🛒 队列」胶囊条打开（首次弹面板会遮罩吞掉第 2 次连点，交替开合打断加抽）
    imageGenStore.enqueueQueue(snapshot);
    showBanner('已加入队列（重复点击可加抽）');
  };

  /** 面板条目点编辑：快照回填 composer（同 syncFromParams 语义）→ 修改后 ➕ 确认更新 */
  const handleQueueEdit = (item: QueueItem) => {
    setSelectedId(item.snapshot.modelId);
    setEditArming(false);
    setEditRgb(null);
    setEditVisRgb(null);
    setPrompt(item.snapshot.prompt);
    setNegativePrompt(item.snapshot.negativePrompt);
    setSteps(String(item.snapshot.steps));
    setCfg(String(item.snapshot.cfg));
    const {width: w, height: h} = item.snapshot;
    const r =
      item.snapshot.family === 'dreamlite'
        ? Object.entries(RATIOS).find(
            ([, wh]) => wh[0] === w && wh[1] === h,
          )?.[0]
        : Object.entries(SD_RATIOS).find(
            ([, wh]) => wh[0] === w && wh[1] === h,
          )?.[0];
    if (r) {
      setRatio(r);
    } else {
      setSize(w);
    }
    setSeed(String(item.snapshot.seed));
    if (item.snapshot.family !== 'dreamlite') {
      setLoraEnabled(item.snapshot.loraEnabled);
      setLoraMult(String(item.snapshot.loraMultiplier));
    }
    editingQueueIdRef.current = item.id;
    setQueueVisible(false);
    showBanner('已回填参数，修改后点 ➕ 确认更新');
  };

  const toggleDelete = (uri: string) => {
    setToDelete(prev =>
      prev.includes(uri) ? prev.filter(u => u !== uri) : [...prev, uri],
    );
  };

  const confirmDelete = async () => {
    if (toDelete.length === 0) {
      return;
    }
    await imageGenStore.deleteHistory(toDelete, true);
    // 历史缩短后回 0 页（编辑槽），避免 previewIndex 越界
    scrollToPreview(0, false);
    setToDelete([]);
    setManageMode(false);
  };

  // 预览横向翻页：手动导航视为完成启动定位，历史页回填参数
  const handleMomentumEnd = (e: {
    nativeEvent: {contentOffset: {x: number}};
  }) => {
    if (!pageW) {
      return;
    }
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageW);
    setEditArming(false); // 手动翻页退出编辑预备态（目标图已变）
    setPreviewIndexSync(idx);
    if (idx >= 1) {
      const item = imageGenStore.history[idx - 1];
      if (item) {
        syncFromParams(item);
      }
    }
  };

  const handleSave = async () => {
    if (!currentImage) {
      return;
    }
    const ok = await imageGenStore.saveToAlbum(currentImage);
    showBanner(
      ok ? '已保存 · Pictures/AIOS' : '保存失败，请重试',
      ok ? 'info' : 'error',
    );
  };

  // P6-6：高清放大确认（参数面板回调）——关闭面板后走任务化 running 页显示进度
  const handleUpscaleConfirm = async (scale: 2 | 4, style: SRStyle) => {
    if (!currentImage) {
      return;
    }
    setUpscaleVisible(false);
    const out = await imageGenStore.upscaleImageEntry(
      currentImage,
      scale,
      style,
    );
    showBanner(
      out ? `已放大 ${scale}×` : '放大失败，请重试',
      out ? 'info' : 'error',
    );
    if (out) {
      // 修复：放大结果在 history[0]（第 1 数据页）；previewIndex 0 = 编辑槽（空白上传页），
      // 此前用 0 导致放大完成后预览窗口空白（2026-08-19 真机实锤）
      scrollToPreview(1, false);
    }
  };

  const handleDeleteCurrent = () => {
    if (!currentImage) {
      return;
    }
    imageGenStore.deleteHistory([currentImage], true);
    // 历史缩短后回 0 页，避免 previewIndex 越界
    scrollToPreview(0, false);
  };

  // 预览卡片顶部横幅（v4.3 大王裁定）：弃屏级 top:458 中间浮条——移入预览卡片顶部，
  // 只压预览图、不压历史区/创作区；无灰底（语义色 wash 透出）。
  // 编辑锁定常驻优先（瞬时 banner 让位）；瞬时 banner 整卡可点关闭。
  const previewBanner: PreviewBanner | null = editArming
    ? {
        text: `已锁定当前图（${DREAM_EDIT_SIZE}×${DREAM_EDIT_SIZE}），输入编辑指令后点「执行编辑」`,
        variant: 'info',
        dismissable: false,
      }
    : banner
      ? {...banner, dismissable: true}
      : null;

  // s.* 样式键为 createStyles(theme) 每次渲染新建对象的属性，放入依赖数组将导致
  // effect 每次渲染重跑而无意义（非标准 React 语义依赖）；主题静态无运行时切换，
  // 样式恒等，故不列入依赖数组（含下方的 s.workshopSliderThumbAudio）。
  React.useEffect(() => {
    navigation.setOptions({
      // v5.3：缩小返回箭头与标题间距一个汉字（16px，titleS 字号）
      headerTitleContainerStyle: {marginLeft: -16},
      headerTitle: () => (
        <View style={s.headerTitleRow}>
          <Text style={s.headerTitleText} numberOfLines={1}>
            创造工坊
          </Text>
          <View style={s.workshopSlider}>
            {/* v5.1 高亮滑块：absolute 跟随当前段（image=0，audio='50%'），无动画 */}
            <View
              style={[
                s.workshopSliderThumb,
                workshopTab === 'audio' && s.workshopSliderThumbAudio,
              ]}
            />
            <TouchableOpacity
              style={s.workshopSliderSeg}
              onPress={() => workshopTab !== 'image' && setWorkshopTab('image')}
              testID="workshop-tab-image">
              <Text
                style={[
                  s.workshopSliderText,
                  workshopTab === 'image' && s.workshopSliderTextActive,
                ]}>
                生图
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.workshopSliderSeg}
              onPress={() => workshopTab !== 'audio' && setWorkshopTab('audio')}
              testID="workshop-tab-audio">
              <Text
                style={[
                  s.workshopSliderText,
                  workshopTab === 'audio' && s.workshopSliderTextActive,
                ]}>
                音频
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
      headerRight: () =>
        workshopTab === 'image' ? (
          <ModelPickerTrigger
            selectedEntry={selectedEntry}
            loaded={loaded}
            loading={genLoading}
            scanning={scanning}
            showModelDrop={showModelDrop}
            onToggleDrop={() => setShowModelDrop(v => !v)}
            onQuickLoad={handleQuickLoad}
          />
        ) : (
          <View style={s.triggerWrap}>
            <TouchableOpacity
              style={s.triggerPill}
              onPress={() => setShowAudioEngineDrop(v => !v)}
              testID="header-audio-model">
              <Text style={s.triggerText} numberOfLines={1}>
                {GEN_ENGINES.find(e => e.id === audioStore.genEngine)?.label ??
                  'Kokoro'}
              </Text>
              <View
                style={[
                  s.audioHeaderDot,
                  audioHeaderReady && s.audioHeaderDotReady,
                ]}
              />
              <Text style={s.triggerArrow}>
                {showAudioEngineDrop ? '▴' : '▾'}
              </Text>
            </TouchableOpacity>
          </View>
        ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- s.* 样式键为每次渲染新建对象属性，非标准 React 语义依赖（见 effect 上方注释），故不列入
  }, [
    navigation,
    selectedEntry,
    loaded,
    genLoading,
    scanning,
    showModelDrop,
    handleQuickLoad,
    workshopTab,
    audioHeaderReady,
    showAudioEngineDrop,
  ]);

  return (
    <View style={s.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          s.content,
          // 底部吸底操作条避让（2026-08-26）：固定预留 + 安全区动态补
          {paddingBottom: theme.spacing.m + ACTION_BAR_RESERVE + insets.bottom},
        ]}>
        {/* B39：套件征用本页时的基准测试 HUD（非运行态 null） */}
        <BenchmarkHudBar />
        {workshopTab === 'image' ? (
          <>
            {/* ① 结果区 */}
            <ResultPreview
              previewRef={previewRef}
              pageW={pageW}
              editSource={editSource}
              history={imageGenStore.history}
              generating={imageGenStore.generating}
              bootedRef={bootedRef}
              onListReady={handleListReady}
              taskKind={taskKind}
              progress={imageGenStore.progress}
              progressText={imageGenStore.progressText}
              stepTime={imageGenStore.stepTime}
              genStartedAt={imageGenStore.genStartedAt}
              stage={imageGenStore.stage}
              now={now}
              waveDots={waveDots}
              currentImage={currentImage}
              currentItem={currentItem}
              fullscreen={fullscreen}
              onPageW={setPageW}
              onMomentumEnd={handleMomentumEnd}
              onPickEditImage={handlePickEditImage}
              onOpenFullscreen={() => setFullscreen(true)}
              onCloseFullscreen={() => setFullscreen(false)}
              onSave={handleSave}
              onUpscale={() => setUpscaleVisible(true)}
              onCaption={handleCaption}
              onCopyCaption={handleCopyCaption}
              onRemake={handleRemake}
              onReroll={handleReroll}
              onDelete={handleDeleteCurrent}
              onInfoPress={setInfoItem}
              onCopyError={handleCopyError}
              onRetryTask={handleRetryTask}
              onDeleteTask={handleDeleteTask}
              previewBanner={previewBanner}
              onDismissBanner={() => setBanner(null)}
            />

            {/* ② 历史区（只列成功任务缩略图；保留原始索引供翻页定位）
            v5.3：相册只收图片类任务（generated/upload/upscaled/caption），音频内容（transcribe/tts）由音频 tab 历史卡承载 */}
            <HistoryStrip
              items={imageGenStore.history
                .map((item, index) => ({item, index}))
                .filter(
                  ({item}) =>
                    (item.status ?? 'success') === 'success' &&
                    isImageKind(item.kind),
                )}
              manageMode={manageMode}
              toDelete={toDelete}
              onUpload={handlePickEditImage}
              onToggleManage={() => {
                setManageMode(m => !m);
                setToDelete([]);
              }}
              onThumbPress={(item, index) => {
                // 点击缩略图 → 大图预览翻到对应页 + 回填参数
                scrollToPreview(index + 1);
                syncFromParams(item);
              }}
              onToggleDelete={toggleDelete}
              onConfirmDelete={confirmDelete}
            />

            {/* ③ 创作区 */}
            <ComposerPanel
              prompt={prompt}
              negativePrompt={negativePrompt}
              steps={steps}
              cfg={cfg}
              size={size}
              ratio={ratio}
              seed={seed}
              isDream={isDream}
              editArming={editArming}
              editRgb={editRgb}
              hasEditableImage={!!editSource || !!currentImage}
              showAdvanced={showAdvanced}
              promptCollapsed={promptCollapsed && !editArming}
              onToggleCollapse={() => setPromptCollapsed(v => !v)}
              loading={imageGenStore.loading}
              generating={imageGenStore.generating}
              taskKind={taskKind}
              loaded={loaded}
              tokenLimit={
                PROMPT_TOKEN_LIMIT[selectedEntry?.manifest.family ?? 'sd3'] ??
                256
              }
              hasLora={!!selectedEntry?.manifest.lora}
              loraEnabled={loraEnabled}
              loraMultiplier={loraMult}
              onLoraEnabledChange={setLoraEnabled}
              onLoraMultiplierChange={setLoraMult}
              onPromptChange={setPrompt}
              onNegativePromptChange={setNegativePrompt}
              onStepsChange={setSteps}
              onCfgChange={setCfg}
              onSeedChange={setSeed}
              onSizeChange={setSize}
              onRatioChange={setRatio}
              onToggleAdvanced={() => setShowAdvanced(a => !a)}
            />
          </>
        ) : (
          <AudioWorkshopTab
            onSnackbar={showBanner}
            // 音频 tab：只展示瞬时 banner（编辑锁定是生图 tab 状态，切 tab 不展示）
            banner={
              editArming || !banner ? null : {...banner, dismissable: true}
            }
            onDismissBanner={() => setBanner(null)}
          />
        )}
      </KeyboardAwareScrollView>

      {/* 底部吸底操作条（2026-08-26 大王裁定）：出图/编辑按钮常驻页面底部，
          键盘弹出随 KeyboardStickyView 上移（同聊天输入条设计语言）；
          audio tab 不吸底（AudioWorkshopTab 保持自身布局） */}
      {workshopTab === 'image' ? (
        <KeyboardStickyView offset={{closed: 0, opened: insets.bottom}}>
          {/* 底部安全区避让（2026-08-29）：KeyboardStickyView closed=0 贴窗口物理底边，
              手势导航设备上按钮被底边裁切；背景 surface 延伸到底 + 内容上移 insets
              （同聊天输入条 insets 避让设计语言） */}
          <View
            style={{
              paddingBottom: insets.bottom,
              backgroundColor: theme.colors.surface,
            }}>
            <GenActionBar
              isDream={isDream}
              editArming={editArming}
              editRgb={editRgb}
              hasEditableImage={!!editSource || !!currentImage}
              loading={imageGenStore.loading}
              generating={imageGenStore.generating}
              taskKind={taskKind}
              onEditArm={handleEditArm}
              onGenerate={handleGenerate}
              onEnqueue={handleEnqueue}
              queueItemCount={imageGenStore.queueItemsCount}
              queueRunning={
                imageGenStore.queueState === 'running' ||
                imageGenStore.queueState === 'stopping'
              }
              onOpenQueue={() => setQueueVisible(true)}
              queueSummary={`${imageGenStore.queueItemsCount} 项 · ${imageGenStore.queueTotalDraws} 抽`}
            />
          </View>
        </KeyboardStickyView>
      ) : null}

      {/* D1：屏级模型下拉 overlay（scrim 起于 AppBar 下沿，点外收起） */}
      <ModelPickerDropdown
        available={available}
        selectedId={selectedId}
        scanning={scanning}
        loading={imageGenStore.loading}
        loaded={loaded}
        isDream={isDream}
        showModelDrop={showModelDrop}
        now={now}
        loadingStartedAt={imageGenStore.loadingStartedAt}
        stage={imageGenStore.stage}
        generating={imageGenStore.generating}
        modelsDir={AIOS_MODELS_DIR}
        isIncompatible={entry => {
          // GPU 准入单点判定（声明式矩阵见 imageGenManifest.GpuPolicy，实测准入非推测）
          const policy = entry.manifest.gpuPolicy;
          if (!policy) {
            return false;
          }
          const adrenoHigh = /Adreno \(TM\) [89]\d\d/.test(
            imageGenStore.gpuRenderer,
          );
          if (policy === 'high-adreno-only') {
            return !adrenoHigh;
          }
          // high-adreno-or-mali：Mali 准入限已验证机型路径（K Pad 2026-08-25 实测）
          return !adrenoHigh && !/Mali/.test(imageGenStore.gpuRenderer);
        }}
        onToggleDrop={() => setShowModelDrop(v => !v)}
        onSelectModel={handleSelectModel}
        onRowAction={handleRowAction}
        isRowLoaded={isRowLoaded}
      />

      {/* B36：音频引擎选择下拉（复用生图 ModelPicker 屏级 overlay 交互模式，弃 Menu） */}
      {workshopTab === 'audio' && showAudioEngineDrop ? (
        <View style={s.dropOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={s.dropBackdrop}
            activeOpacity={1}
            onPress={() => setShowAudioEngineDrop(false)}
          />
          <View style={s.dropPanelAbs}>
            {GEN_ENGINES.map(e => {
              const st = engineState(e.id);
              const ready = st === 'ready';
              const downloading = st === 'downloading';
              const active = audioStore.genEngine === e.id;
              return (
                <View
                  key={e.id}
                  style={[s.modelRow, active && s.modelRowSelected]}>
                  <TouchableOpacity
                    style={s.modelRowMain}
                    onPress={() => {
                      audioStore.setGenEngine(e.id);
                      setShowAudioEngineDrop(false);
                    }}>
                    <Text style={s.modelName} numberOfLines={1}>
                      {e.label}（{e.size}）
                      {ready
                        ? ' · 已就绪'
                        : downloading
                          ? ' · 下载中'
                          : ' · 未下载'}
                    </Text>
                    <Text style={s.modelNote} numberOfLines={1}>
                      {e.note}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.rowActionBtn, ready && s.rowActionBtnUnload]}
                    disabled={downloading || audioStore.ttsGenerating}
                    onPress={() => handleAudioEngineAction(e.id, ready)}>
                    {downloading ? (
                      <CircularActivityIndicator
                        size={theme.iconSize.m}
                        color={theme.colors.onPrimary}
                      />
                    ) : (
                      <Text
                        style={[
                          s.rowActionText,
                          ready && s.rowActionTextUnload,
                        ]}>
                        {ready ? '删除' : '下载'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
            <Text style={s.readyText}>
              {audioHeaderReady
                ? `✓ ${GEN_ENGINES.find(e => e.id === audioStore.genEngine)?.label} 已就绪，可以生成音频`
                : '选择引擎后点「生成音频」；未就绪引擎请先下载'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* P6-6：高清放大参数面板（独立通用能力，确认即关；进度走任务化 running 页） */}
      <UpscalePanel
        visible={upscaleVisible}
        onClose={() => setUpscaleVisible(false)}
        onConfirm={handleUpscaleConfirm}
      />

      {/* v5：复刻生图 Sheet 删除——复刻参数走高级参数卡 + 直接出图（IMAGEGEN_UI_SPEC §7.3） */}

      {/* 未加载引导（2026-08-21）：非 Dream 点出图未加载 → 提示 + 「去加载」展开模型下拉 */}
      <OverlayCard
        visible={loadGuideVisible}
        onRequestClose={() => setLoadGuideVisible(false)}
        title="需要先加载模型"
        actions={{
          primary: {
            label: '去加载',
            onPress: () => {
              setLoadGuideVisible(false);
              setShowModelDrop(true);
            },
          },
        }}>
        <Text style={s.modalPrompt}>
          当前未加载生图模型。请先在上方下拉中选择并加载模型，再点「出图」。
        </Text>
      </OverlayCard>

      {/* 信息条点击：完整生图参数详情（模型/耗时/尺寸/种子/步数/时间/提示词）
          OverlayCard 底座（DESIGN_SPEC §12.1） */}
      <OverlayCard
        visible={!!infoItem}
        onRequestClose={() => setInfoItem(null)}
        title="图片参数"
        actions={{
          primary: {label: '关闭', onPress: () => setInfoItem(null)},
          ...(infoItem?.kind === 'caption'
            ? {
                secondary: {
                  label: '回填到输入框',
                  onPress: () => {
                    if (infoItem?.prompt) {
                      setPrompt(infoItem.prompt);
                    }
                    setInfoItem(null);
                    showBanner('反推提示词已回填输入框');
                  },
                },
              }
            : {}),
        }}>
        {infoItem && (
          <ScrollView style={s.infoScroll} testID="info-scroll">
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>模型</Text>
              <Text style={s.modalValue} numberOfLines={1}>
                {infoItem.modelLabel ?? '未知'}
              </Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>耗时</Text>
              <Text style={s.modalValue}>
                {infoItem.durationMs != null
                  ? `${(infoItem.durationMs / 1000).toFixed(1)}s`
                  : '-'}
              </Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>尺寸</Text>
              <Text style={s.modalValue}>
                {infoItem.width}×{infoItem.height}
              </Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>种子</Text>
              <Text style={s.modalValue}>{infoItem.seed}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>步数</Text>
              <Text style={s.modalValue}>{infoItem.steps ?? '-'}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>时间</Text>
              <Text style={s.modalValue}>
                {new Date(infoItem.ts).toLocaleString()}
              </Text>
            </View>
            <Text style={s.modalLabel}>提示词</Text>
            <Text style={s.modalPrompt}>{infoItem.prompt || '（无）'}</Text>
          </ScrollView>
        )}
      </OverlayCard>

      {/* 任务购物车（IMAGEGEN_QUEUE_SPEC）：队列面板（OverlayCard 唯一底座） */}
      <QueuePanel
        visible={queueVisible}
        onRequestClose={() => setQueueVisible(false)}
        items={imageGenStore.queueItems}
        state={imageGenStore.queueState}
        position={imageGenStore.queuePosition}
        totalDraws={imageGenStore.queueTotalDraws}
        drawsDone={imageGenStore.queueDrawsDone}
        drawsFailed={imageGenStore.queueDrawsFailed}
        busy={imageGenStore.loading || imageGenStore.generating}
        onStart={() => imageGenStore.startQueue()}
        onStop={() => imageGenStore.stopQueue()}
        onClear={() => imageGenStore.clearQueue()}
        onRemove={id => imageGenStore.removeQueueItem(id)}
        onEdit={handleQueueEdit}
      />
    </View>
  );
});
