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
import {View, FlatList} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {observer} from 'mobx-react-lite';
import {runInAction} from 'mobx';
import {launchImageLibrary} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';

import {imageGenStore, GeneratedImage} from '../../store/imageGenStore';
import {useTheme} from '../../hooks';
import {AIOS_MODELS_DIR} from '../../utils/paths';
import {
  listAvailableModels,
  resolveCompanions,
} from '../../utils/imageGenManifest';

import {createStyles} from './styles';
import {DREAMLITE_MANIFEST, RATIOS, ModelEntry} from './constants';
import {useToast} from './hooks/useToast';
import {useWaveDots} from './hooks/useWaveDots';
import {
  ModelPickerTrigger,
  ModelPickerDropdown,
} from './components/ModelPickerPanel';
import {ResultPreview} from './components/ResultPreview';
import {HistoryStrip} from './components/HistoryStrip';
import {ComposerPanel} from './components/ComposerPanel';
import {confirmDialog} from '../../components/ui/ConfirmDialog';

export const ImageGenScreen: React.FC = observer(() => {
  const theme = useTheme();
  const s = createStyles(theme);
  const navigation = useNavigation();

  const [available, setAvailable] = React.useState<ModelEntry[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [negativePrompt, setNegativePrompt] = React.useState('');
  const [steps, setSteps] = React.useState('4'); // DreamLite mobile 官方 4 步（DMD2 蒸馏）
  const [cfg, setCfg] = React.useState('2');
  const [size, setSize] = React.useState(512);
  const [scanning, setScanning] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [showAdvanced, setShowAdvanced] = React.useState(false);
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
  const [pageW, setPageW] = React.useState(0);
  // 编辑预备态：已点「编辑」锁定当前预览图，正在输入编辑指令（再点「执行编辑」二创）
  const [editArming, setEditArming] = React.useState(false);
  // 进行中任务类型：'gen'=新生成（预览区空白页动效）｜'edit'=二创当前图（图上叠动效）
  const [taskKind, setTaskKind] = React.useState<'gen' | 'edit' | null>(null);

  const {toast, toastOpacity, showToast} = useToast();
  // 生成/编辑进行中：三点波浪动效
  const waveDots = useWaveDots(imageGenStore.generating);

  // observer 本地读：依赖变化时重新执行计时器（loading/generating 期间每 2s 刷新 now）
  const generating = imageGenStore.generating;
  const loading = imageGenStore.loading;
  React.useEffect(() => {
    if (!generating && !loading) {
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
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

  // 启动定位：有历史直接显示最新一张（页 1），无历史停在 0 页编辑槽
  React.useEffect(() => {
    if (
      bootedRef.current ||
      pageW === 0 ||
      imageGenStore.history.length === 0
    ) {
      return;
    }
    bootedRef.current = true;
    setPreviewIndexSync(1);
    previewRef.current?.scrollToOffset({offset: pageW, animated: false});
    syncFromParams(imageGenStore.history[0]);
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
      await imageGenStore.loadDreamLiteEntry();
      return;
    }
    const {extras, missing} = await resolveCompanions(
      entry.manifest,
      AIOS_MODELS_DIR,
    );
    if (missing.length > 0) {
      runInAction(() => {
        imageGenStore.error = `缺少伴侣文件：${missing.join('、')}`;
      });
      return;
    }
    await imageGenStore.loadModel(
      entry.mainPath,
      {...extras, backend: entry.manifest.defaults.backend},
      entry.manifest.id,
    );
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
  const handleQuickLoad = React.useCallback(() => {
    if (selectedEntry) {
      loadEntry(selectedEntry);
    }
  }, [selectedEntry]);

  // 下拉选中：只选中高亮 + 回填参数。不折叠面板、不加载、不切模式（点卡片只是“看参数”）。
  const handleSelectModel = (entry: ModelEntry) => {
    setSelectedId(entry.manifest.id);
  };

  // 预览分页跳转：0=编辑槽，i≥1=历史第 i-1 张（任何手动导航均视为已完成启动定位）
  const scrollToPreview = (idx: number, animated = true) => {
    bootedRef.current = true;
    setEditArming(false); // 导航即退出编辑预备态（目标图已变）
    setPreviewIndexSync(idx);
    previewRef.current?.scrollToOffset({offset: idx * pageW, animated});
  };

  // 回填该历史图的提示词/参数（预览翻页与历史缩略图点击共用）
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
      setSize(item.width);
    }
    if (item.steps) {
      setSteps(String(item.steps));
    }
    if (item.cfg) {
      setCfg(String(item.cfg));
    }
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

  const handleReroll = () => {
    handleGenerate(); // 同参数再次生成
  };

  // 编辑源图入槽（单一入口：相册上传 / 聊天图片卡片「编辑图片」深链共用）：
  // 解码 RGB → 入历史横条 → 定位 0 页编辑槽 → 进入编辑预备态。
  const ingestEditSource = async (rawUri: string, toastPrefix = '已选图') => {
    const path = rawUri.replace('file://', '');
    setEditSource(path);
    // 按较大边压缩到支持尺寸
    const sq = Math.min(dreamW, dreamH);
    try {
      const rgb = await imageGenStore.decodeEditImage(path, sq);
      setEditRgb(rgb);
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
      });
      setPrompt(''); // 新源图无历史提示词，清空输入区
      scrollToPreview(0);
      setEditArming(true); // 入槽即进入编辑预备：目标=刚入槽的图
      showToast(
        `${toastPrefix}（压缩至 ${sq}×${sq}），输入编辑指令后点「执行编辑」`,
      );
    } catch (e) {
      runInAction(() => {
        imageGenStore.error = `解码图片: ${(e as any)?.message ?? e}`;
      });
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
    if (editArming) {
      handleEditRun();
      return;
    }
    // 编辑目标 = 当前预览区显示的图：0 页=上传图，历史页=当前历史图
    const targetUri = previewIndex === 0 ? editSource : currentImage;
    if (!targetUri) {
      showToast('先上传一张本地图片，再输入编辑指令');
      await handlePickEditImage();
      return;
    }
    setEditArming(true);
    setPrompt(''); // 编辑指令与生成提示词语义不同，从头输入
    const sq = Math.min(dreamW, dreamH);
    if (previewIndex === 0 && editRgb) {
      // 上传图已在上传时预解码，无需重复
      showToast(`已锁定当前图（${sq}×${sq}），输入编辑指令后点「执行编辑」`);
      return;
    }
    try {
      const rgb = await imageGenStore.decodeEditImage(
        targetUri.replace('file://', ''),
        sq,
      );
      setEditRgb(rgb);
      showToast(`已锁定当前图（${sq}×${sq}），输入编辑指令后点「执行编辑」`);
    } catch (e) {
      setEditArming(false);
      runInAction(() => {
        imageGenStore.error = `解码图片: ${(e as any)?.message ?? e}`;
      });
    }
  };

  const handleEditRun = async () => {
    if (!editRgb) {
      return;
    }
    setTaskKind('edit'); // 编辑动效：叠在当前图上
    const sq = Math.min(dreamW, dreamH);
    const startTs = Date.now();
    const uri = await imageGenStore.editDreamLiteEntry(
      editRgb,
      sq,
      sq,
      parseInt(steps, 10) || 4,
      prompt.trim(), // 编辑指令（官方 diptych 语义文本条件）
    );
    setTaskKind(null);
    if (!uri) {
      return;
    }
    setEditRgb(null);
    setEditSource(null);
    imageGenStore.pushHistory({
      uri,
      prompt: prompt.trim(),
      seed: Date.now() % 1e9,
      ts: Date.now(),
      width: sq,
      height: sq,
      steps: parseInt(steps, 10) || 4,
      family: 'dreamlite',
      kind: 'generated',
      durationMs: Date.now() - startTs,
      modelLabel: selectedEntry?.manifest.label ?? 'DreamLite',
    });
    // 新图在 history[0] → 预览页 1
    scrollToPreview(1);
    showToast('编辑完成');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }
    setEditArming(false); // 出图退出编辑预备态
    if (isDream) {
      setTaskKind('gen'); // 出图动效：预览区空白页
      const startTs = Date.now();
      const uri = await imageGenStore.generateDreamLiteEntry(
        dreamW,
        dreamH,
        parseInt(steps, 10) || 4,
        prompt.trim(),
      );
      setTaskKind(null);
      if (!uri) {
        return;
      }
      imageGenStore.pushHistory({
        uri,
        prompt: prompt.trim(),
        seed: Date.now() % 1e9,
        ts: Date.now(),
        width: dreamW,
        height: dreamH,
        steps: parseInt(steps, 10) || 4,
        family: 'dreamlite',
        kind: 'generated',
        durationMs: Date.now() - startTs,
        modelLabel: selectedEntry?.manifest.label ?? 'DreamLite',
      });
      // 新图在 history[0] → 预览页 1
      scrollToPreview(1);
      showToast(`生成完成（${dreamW}×${dreamH}）`);
      return;
    }
    const m = selectedEntry?.manifest;
    setTaskKind('gen'); // 出图动效：预览区空白页
    const uri = await imageGenStore.generate(prompt.trim(), {
      steps: parseInt(steps, 10) || 2,
      cfg: parseFloat(cfg) || 2,
      width: size,
      height: size,
      negativePrompt: negativePrompt.trim(),
      loraPath: m?.lora ? `${AIOS_MODELS_DIR}/${m.lora}` : undefined,
      loraMultiplier: m?.loraMultiplier,
      modelLabel: m?.label,
    });
    setTaskKind(null);
    if (uri) {
      // 新图在 history[0] → 预览页 1
      scrollToPreview(1);
    }
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
    showToast(ok ? '已保存 · Pictures/AIOS' : '保存失败，请重试');
  };

  const handleDeleteCurrent = () => {
    if (!currentImage) {
      return;
    }
    imageGenStore.deleteHistory([currentImage], true);
    // 历史缩短后回 0 页，避免 previewIndex 越界
    scrollToPreview(0, false);
  };

  // D1：模型触发胶囊挂到 AppBar headerRight（回收内容区顶部空间，预览顶到顶栏）
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <ModelPickerTrigger
          selectedEntry={selectedEntry}
          loaded={loaded}
          loading={genLoading}
          scanning={scanning}
          showModelDrop={showModelDrop}
          onToggleDrop={() => setShowModelDrop(v => !v)}
          onQuickLoad={handleQuickLoad}
        />
      ),
    });
  }, [
    navigation,
    selectedEntry,
    loaded,
    genLoading,
    scanning,
    showModelDrop,
    handleQuickLoad,
  ]);

  return (
    <View style={s.container}>
      <KeyboardAwareScrollView contentContainerStyle={s.content}>
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
          toast={toast}
          toastOpacity={toastOpacity}
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
          onReroll={handleReroll}
          onDelete={handleDeleteCurrent}
        />

        {/* ② 历史区 */}
        <HistoryStrip
          history={imageGenStore.history}
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
          isDream={isDream}
          editArming={editArming}
          editRgb={editRgb}
          showAdvanced={showAdvanced}
          generating={imageGenStore.generating}
          taskKind={taskKind}
          loaded={loaded}
          dreamW={dreamW}
          dreamH={dreamH}
          error={imageGenStore.error}
          onPromptChange={setPrompt}
          onNegativePromptChange={setNegativePrompt}
          onStepsChange={setSteps}
          onCfgChange={setCfg}
          onSizeChange={setSize}
          onRatioChange={setRatio}
          onToggleAdvanced={() => setShowAdvanced(a => !a)}
          onEditArm={handleEditArm}
          onGenerate={handleGenerate}
        />
      </KeyboardAwareScrollView>

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
        onToggleDrop={() => setShowModelDrop(v => !v)}
        onSelectModel={handleSelectModel}
        onRowAction={handleRowAction}
        isRowLoaded={isRowLoaded}
      />
    </View>
  );
});
