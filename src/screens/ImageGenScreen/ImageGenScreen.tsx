/**
 * ImageGenScreen — 生图页（P5.4 三行布局 v2）
 *
 * 布局（用户视角，单列三区）：
 *  顶部：模型状态胶囊 → 点按展开锚定下拉面板（选模型 + 加载/卸载确认）
 *  ① 结果区（置顶主角）：最新图 + 操作条 + 参数水印；生成中进度 overlay 叠在结果区上
 *  ② 历史区（紧凑横条）：横向滑动 + [管理]多选删除
 *  ③ 创作区（底部 composer）：提示词 + 折叠高级参数 + 出图/编辑按钮（模式由顶部下拉 dreamlite 条目驱动）
 * 键盘：外层 KeyboardAwareScrollView，聚焦输入框自动滚入可见区。
 */
import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {observer} from 'mobx-react-lite';
import {runInAction} from 'mobx';
import {launchImageLibrary} from 'react-native-image-picker';

import {imageGenStore} from '../../store/imageGenStore';
import {
  loadDreamLite,
  unloadDreamLite,
  generateDreamLite,
  editDreamLite,
  decodeImageToRgb,
} from '../../services/dreamLiteEngine';
import {useTheme} from '../../hooks';
import {AIOS_MODELS_DIR} from '../../utils/paths';
import {
  listAvailableModels,
  resolveCompanions,
  ImageGenManifest,
} from '../../utils/imageGenManifest';

const FAMILY_BADGE: Record<ImageGenManifest['family'], string> = {
  zimage: 'Z-Image',
  sd3: 'SD3.5',
  classic: '',
  dreamlite: 'DreamLite',
};

// DreamLite 作为统一模型选项进入顶部选择栏（同一模型不分出图/编辑；模式切换由预览区分页驱动）
const DREAMLITE_MANIFEST: ImageGenManifest = {
  id: 'dreamlite',
  label: 'DreamLite Mobile',
  family: 'dreamlite',
  main: '',
  defaults: {steps: 4, cfg: 1, size: 1024},
  note: '统一文生图 + 图像编辑，4 步 1024px 约 25s',
};

const PROMPT_LIMIT = 120;

// 官方多分辨率训练桶（~1M 像素，与 HF Space 选项一致；旧自定尺寸如 576×1024 偏离训练桶会导致非方图质量下降）
const RATIOS: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '9:7': [1152, 896],
  '7:9': [896, 1152],
  '3:2': [1216, 832],
  '2:3': [832, 1216],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
};

export const ImageGenScreen: React.FC = observer(() => {
  const theme = useTheme();
  const [available, setAvailable] = React.useState<
    {manifest: ImageGenManifest; mainPath: string}[]
  >([]);
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
  const previewRef = React.useRef<ScrollView>(null);
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
  // 生成/编辑动效脉冲（呼吸缩放）
  const pulse = React.useRef(new Animated.Value(0)).current;
  // 轻量滚动信息条（替代弹窗）：不打断操作，2.5s 后自动淡出
  const [toast, setToast] = React.useState<string | null>(null);
  const toastOpacity = React.useRef(new Animated.Value(0)).current;
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = React.useCallback(
    (msg: string) => {
      setToast(msg);
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        // B1 weak-ref 根治：生图页全部动效走 JS driver（useNativeDriver:false），
        // 切断 NativeAnimatedModule 高频 weak ref 来源（tombstone_04 实锤的分钟级溢出源）
        useNativeDriver: false,
      }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }).start(() => setToast(null));
      }, 2500);
    },
    [toastOpacity],
  );

  // 生成/编辑进行中：脉冲呼吸动效循环
  React.useEffect(() => {
    if (!imageGenStore.generating) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        // B1 weak-ref 根治：pulse 循环动效必须 JS driver。useNativeDriver:true 会在
        // 长时出图（分钟级）期间持续触发 TurboModule invokeJavaMethod → weak ref
        // 累积至 51200 溢出（tombstone_04：50252 全为 NativeAnimatedModule）→ SIGABRT。
        // JS driver 经 Fabric setNativeProps 更新，不产生 weak ref；
        // 生图期间 JS 线程负载低（1Hz pull + 2s 心跳），掉帧风险可接受。
        Animated.timing(pulse, {toValue: 1, duration: 900, useNativeDriver: false}),
        Animated.timing(pulse, {toValue: 0, duration: 900, useNativeDriver: false}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [imageGenStore.generating, pulse]);

  React.useEffect(() => {
    if (!imageGenStore.generating && !imageGenStore.loading) {
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [imageGenStore.generating, imageGenStore.loading]);

  const SIZES = [384, 512, 640, 768];

  const scanModels = React.useCallback(async () => {
    setScanning(true);
    try {
      const list = await listAvailableModels(AIOS_MODELS_DIR);
      const withDream = [...list, {manifest: DREAMLITE_MANIFEST, mainPath: ''}];
      setAvailable(withDream);
      if (withDream.length > 0 && !selectedId) {
        setSelectedId(withDream[0].manifest.id);
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
    if (bootedRef.current || pageW === 0 || imageGenStore.history.length === 0) {
      return;
    }
    bootedRef.current = true;
    setPreviewIndex(1);
    previewRef.current?.scrollTo({x: pageW, animated: false});
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

  const selectedEntry = available.find(a => a.manifest.id === selectedId) ?? null;

  const isDream = selectedEntry?.manifest.family === 'dreamlite';
  const loaded = isDream
    ? imageGenStore.dreamliteLoaded
    : imageGenStore.modelLoaded;

  // 预览分页派生（单状态机）：0 页 = 编辑槽（上传图）；≥1 = 历史图。
  // 编辑目标 = 当前预览区显示的图（0 页=editSource，历史页=currentImage），由「编辑」按钮锁定。
  const currentImage =
    previewIndex > 0 ? imageGenStore.history[previewIndex - 1]?.uri ?? null : null;
  const currentItem =
    previewIndex > 0 ? imageGenStore.history[previewIndex - 1] ?? null : null;

  const loadEntry = async (entry: {
    manifest: ImageGenManifest;
    mainPath: string;
  }) => {
    if (entry.manifest.family === 'dreamlite') {
      runInAction(() => {
        imageGenStore.loading = true;
        imageGenStore.error = null;
      });
      try {
        await loadDreamLite();
        runInAction(() => {
          imageGenStore.dreamliteLoaded = true;
          imageGenStore.loading = false;
        });
      } catch (e) {
        runInAction(() => {
          imageGenStore.loading = false;
          imageGenStore.error = `DreamLite: ${(e as any)?.message ?? e}`;
        });
      }
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
  const doUnload = async (entry: {manifest: ImageGenManifest; mainPath: string}) => {
    if (entry.manifest.family === 'dreamlite') {
      runInAction(() => {
        imageGenStore.dreamliteLoaded = false;
      });
      try {
        await unloadDreamLite();
      } catch (e) {
        console.warn('[DreamLite] unload failed:', e);
      }
      return;
    }
    await imageGenStore.unloadModel();
  };

  // 行内按钮：加载 / 卸载（卸载二次确认）
  const handleRowAction = (entry: {manifest: ImageGenManifest; mainPath: string}) => {
    setSelectedId(entry.manifest.id);
    if (isRowLoaded(entry)) {
      Alert.alert(
        '卸载模型',
        `确定卸载「${entry.manifest.label}」吗？内存将被释放。`,
        [
          {text: '取消', style: 'cancel'},
          {text: '卸载', style: 'destructive', onPress: () => doUnload(entry)},
        ],
      );
      return;
    }
    // 点加载才开始动作：折叠面板 + 面板内出现加载中提示
    setShowModelDrop(false);
    loadEntry(entry);
  };

  // 行内按钮状态：该行模型是否已加载
  const isRowLoaded = (entry: {manifest: ImageGenManifest; mainPath: string}) => {
    if (entry.manifest.family === 'dreamlite') {
      return imageGenStore.dreamliteLoaded;
    }
    return imageGenStore.modelLoaded && imageGenStore.loadedModelId === entry.manifest.id;
  };

  // 下拉选中：只选中高亮 + 回填参数。不折叠面板、不加载、不切模式（点卡片只是“看参数”）。
  const handleSelectModel = (entry: {
    manifest: ImageGenManifest;
    mainPath: string;
  }) => {
    setSelectedId(entry.manifest.id);
  };

  // 预览分页跳转：0=编辑槽，i≥1=历史第 i-1 张（任何手动导航均视为已完成启动定位）
  const scrollToPreview = (idx: number, animated = true) => {
    bootedRef.current = true;
    setEditArming(false); // 导航即退出编辑预备态（目标图已变）
    setPreviewIndex(idx);
    previewRef.current?.scrollTo({x: idx * pageW, animated});
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

  const handleReroll = () => {
    handleGenerate(); // 同参数再次生成
  };

  const handlePickEditImage = async () => {
    const res = await launchImageLibrary({mediaType: 'photo', includeBase64: false});
    const p = res.assets?.[0]?.uri;
    if (!p) {
      return;
    }
    const path = p.replace('file://', '');
    setEditSource(path);
    // 按较大边压缩到支持尺寸
    const sq = Math.min(dreamW, dreamH);
    try {
      const rgb = await decodeImageToRgb(path, sq);
      setEditRgb(rgb);
      // 上传图入历史横栏（可点选查看/编辑），并在 0 页编辑槽显示
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
      setPrompt(''); // 新上传图无历史提示词，清空输入区
      scrollToPreview(0);
      setEditArming(true); // 上传即进入编辑预备：目标=刚上传的图
      showToast(`已选图（压缩至 ${sq}×${sq}），输入编辑指令后点「执行编辑」`);
    } catch (e) {
      runInAction(() => {
        imageGenStore.error = `解码图片: ${(e as any)?.message ?? e}`;
      });
    }
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
      const rgb = await decodeImageToRgb(targetUri.replace('file://', ''), sq);
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
    runInAction(() => {
      imageGenStore.generating = true;
      imageGenStore.genStartedAt = Date.now();
      imageGenStore.progress = 0;
      imageGenStore.stage = '编辑: 准备…';
    });
    try {
      await loadDreamLite();
      const sq = Math.min(dreamW, dreamH);
      const uri = await editDreamLite(
        editRgb,
        sq,
        sq,
        parseInt(steps, 10) || 4,
        (st, tot) => {
          runInAction(() => {
            imageGenStore.progress = Math.round((st / tot) * 100);
            imageGenStore.stage = `编辑 采样 ${st}/${tot}`;
          });
        },
        prompt.trim(), // 编辑指令（官方 diptych 语义文本条件）
      );
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
      });
      // 新图在 history[0] → 预览页 1
      scrollToPreview(1);
      showToast('编辑完成');
    } catch (e) {
      runInAction(() => {
        imageGenStore.error = `DreamLite编辑: ${(e as any)?.message ?? e}`;
      });
    } finally {
      runInAction(() => {
        imageGenStore.generating = false;
      });
      setTaskKind(null);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }
    setEditArming(false); // 出图退出编辑预备态
    if (isDream) {
      setTaskKind('gen'); // 出图动效：预览区空白页
      runInAction(() => {
        imageGenStore.generating = true;
        imageGenStore.genStartedAt = Date.now();
        imageGenStore.progress = 0;
        imageGenStore.progressText = '';
        imageGenStore.stage = 'TE 编码/准备…';
        imageGenStore.error = null;
      });
      try {
        await loadDreamLite();
        runInAction(() => {
          imageGenStore.dreamliteLoaded = true;
        });
        const uri = await generateDreamLite(
          dreamW,
          dreamH,
          parseInt(steps, 10) || 4,
          prompt.trim(),
          (st, tot) => {
            runInAction(() => {
              imageGenStore.progress = Math.round((st / tot) * 100);
              imageGenStore.progressText = `${st}/${tot}`;
              imageGenStore.stage = `采样 ${st}/${tot}`;
            });
          },
        );
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
        });
        // 新图在 history[0] → 预览页 1
        scrollToPreview(1);
        showToast(`生成完成（${dreamW}×${dreamH}）`);
      } catch (e) {
        runInAction(() => {
          imageGenStore.error = `DreamLite: ${(e as any)?.message ?? e}`;
        });
      } finally {
        runInAction(() => {
          imageGenStore.generating = false;
        });
        setTaskKind(null);
      }
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

  const s = createStyles(theme);

  const modelStatus = imageGenStore.loading
    ? '加载中…'
    : loaded
      ? '已就绪'
      : '未加载';

  // 生成/编辑动效 overlay：出图=空白页盖住预览区（正在生成新图）；编辑=半透明叠在当前图上（正在编辑此图）
  const genOverlay = imageGenStore.generating ? (
    <View style={[s.genOverlay, taskKind === 'edit' ? s.genOverlayEdit : null]}>
      <Animated.View
        style={[
          s.genOrb,
          {
            opacity: pulse.interpolate({inputRange: [0, 1], outputRange: [0.35, 0.95]}),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1.15],
                }),
              },
            ],
          },
        ]}>
        <Text style={s.genOrbText}>✦</Text>
      </Animated.View>
      <Text style={s.genOverlayTitle}>
        {taskKind === 'edit' ? '正在编辑此图…' : '正在生成新图…'}
      </Text>
      <View style={[s.progressTrack, {width: '70%'}]}>
        <View
          style={[
            s.progressBarFill,
            {width: `${Math.max(imageGenStore.progress, 2)}%`},
          ]}
        />
      </View>
      <Text style={s.overlayText}>
        {imageGenStore.progressText
          ? `采样 ${imageGenStore.progressText}` +
            (imageGenStore.stepTime > 0
              ? `（${imageGenStore.stepTime.toFixed(1)}s/步）`
              : '')
          : '加载权重/准备中…'}
        {' · '}
        {Math.max(0, Math.round((now - imageGenStore.genStartedAt) / 1000))}s
      </Text>
      {imageGenStore.stage ? (
        <Text style={s.overlayStage} numberOfLines={2}>
          ▸ {imageGenStore.stage}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={s.container}>
      <KeyboardAwareScrollView contentContainerStyle={s.content}>
        {/* 模型状态胶囊 + 锚定下拉 */}
        <View>
          <TouchableOpacity
            style={s.modelChip}
            onPress={() => setShowModelDrop(v => !v)}>
            <Text style={s.modelChipText} numberOfLines={1}>
              {selectedEntry
                ? `${
                    FAMILY_BADGE[selectedEntry.manifest.family]
                      ? `[${FAMILY_BADGE[selectedEntry.manifest.family]}] `
                      : ''
                  }${selectedEntry.manifest.label}`
                : '选择模型'}
              {selectedEntry?.manifest.experimental ? (
                <Text style={s.badgeExp}>  [实验性]</Text>
              ) : null}
            </Text>
            <Text style={s.modelChipStatus}>{modelStatus} {showModelDrop ? '▴' : '▾'}</Text>
          </TouchableOpacity>

        </View>

        {/* ① 结果区：横向分页 = [0页编辑槽（上传/编辑）] + 历史图；翻页自动回填提示词/参数 */}
        <View style={s.card}>
          <View
            style={s.resultWrap}
            onLayout={e => setPageW(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={previewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                if (!pageW) {
                  return;
                }
                const idx = Math.round(e.nativeEvent.contentOffset.x / pageW);
                setEditArming(false); // 手动翻页退出编辑预备态（目标图已变）
                setPreviewIndex(idx);
                if (idx >= 1) {
                  const item = imageGenStore.history[idx - 1];
                  if (item) {
                    syncFromParams(item);
                  }
                }
              }}>
              {/* 0 页：编辑槽（无图=上传大按钮；有图=待编辑图预览+重新上传） */}
              <View style={[s.editSlot, pageW ? {width: pageW} : null]}>
                {editSource ? (
                  <>
                    <Image
                      source={{
                        uri: editSource.startsWith('file://')
                          ? editSource
                          : `file://${editSource}`,
                      }}
                      style={s.editSlotImg}
                      resizeMode="contain"
                    />
                    <TouchableOpacity style={s.uploadFab} onPress={handlePickEditImage}>
                      <Text style={s.uploadFabText}>重新上传</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={s.uploadBig} onPress={handlePickEditImage}>
                    <Text style={s.uploadBigIcon}>＋</Text>
                    <Text style={s.uploadBigText}>上传本地图片</Text>
                    <Text style={s.uploadBigHint}>从手机相册选图，输入指令进行 AI 编辑</Text>
                  </TouchableOpacity>
                )}
              </View>
              {imageGenStore.history.map(h => (
                <TouchableOpacity key={h.uri} onPress={() => setFullscreen(true)}>
                  <Image
                    source={{uri: h.uri}}
                    style={[s.preview, pageW ? {width: pageW} : null]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {genOverlay}
            {/* 轻量滚动信息条：保存/编辑等操作的即时反馈，不打断操作 */}
            {toast ? (
              <Animated.View
                pointerEvents="none"
                style={[s.toastBar, {opacity: toastOpacity}]}>
                <Text style={s.toastText} numberOfLines={2}>
                  {toast}
                </Text>
              </Animated.View>
            ) : null}
          </View>
          {currentImage && (
            <>
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionSave]}
                  onPress={async () => {
                    if (!currentImage) {
                      return;
                    }
                    const ok = await imageGenStore.saveToAlbum(currentImage);
                    showToast(ok ? '已保存 · Pictures/AIOS' : '保存失败，请重试');
                  }}>
                  <Text style={s.actionTextLight}>保存</Text>
                </TouchableOpacity>
                {isDream && (
                  <TouchableOpacity style={[s.actionBtn, s.actionEdit]} onPress={handleEditArm}>
                    <Text style={s.actionTextLight}>
                      {editArming ? '执行编辑' : '编辑'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.actionBtn, s.actionReuse]} onPress={handleReroll}>
                  <Text style={s.actionTextLight}>再次生成</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionDelete]}
                  onPress={() => {
                    if (!currentImage) {
                      return;
                    }
                    imageGenStore.deleteHistory([currentImage], true);
                    // 历史缩短后回 0 页，避免 previewIndex 越界
                    scrollToPreview(0, false);
                  }}>
                  <Text style={s.actionTextLight}>删除</Text>
                </TouchableOpacity>
              </View>
              {currentItem ? (
                <Text style={s.watermark} numberOfLines={1}>
                  {currentItem.kind === 'upload'
                    ? `上传 · ${currentItem.width}×${currentItem.height}`
                    : `seed ${currentItem.seed} · ${currentItem.width}×${currentItem.height}`}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* ② 历史区（紧凑横条）：上传入口 + 历史缩略图（点击联动大图预览） */}
        <View style={s.card}>
          <View style={s.historyHeader}>
            <Text style={s.cardTitle}>相册 ({imageGenStore.history.length})</Text>
            <View style={s.historyHeaderActions}>
              <TouchableOpacity onPress={handlePickEditImage}>
                <Text style={s.uploadText}>上传</Text>
              </TouchableOpacity>
              {imageGenStore.history.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setManageMode(m => !m);
                    setToDelete([]);
                  }}>
                  <Text style={s.manageText}>{manageMode ? '完成' : '管理'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {imageGenStore.history.length > 0 && (
            <FlatList
              data={imageGenStore.history}
              keyExtractor={item => item.uri}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({item, index}) => (
                <TouchableOpacity
                  style={s.historyItem}
                  onPress={() => {
                    if (manageMode) {
                      toggleDelete(item.uri);
                      return;
                    }
                    // 点击缩略图 → 大图预览翻到对应页 + 回填参数
                    scrollToPreview(index + 1);
                    syncFromParams(item);
                  }}>
                  <Image source={{uri: item.uri}} style={s.historyThumb} />
                  {item.kind === 'upload' && !manageMode && (
                    <View style={s.historyKindBadge}>
                      <Text style={s.historyKindText}>上传</Text>
                    </View>
                  )}
                  {manageMode && toDelete.includes(item.uri) && (
                    <View style={s.historySel}>
                      <Text style={s.historySelText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
            {manageMode && (
              <TouchableOpacity
                style={[s.button, s.buttonDanger]}
                disabled={toDelete.length === 0}
                onPress={confirmDelete}>
                <Text style={s.buttonText}>删除选中 ({toDelete.length})</Text>
              </TouchableOpacity>
            )}
        </View>

        {/* ③ 创作区（底部 composer） */}
        <View style={s.card}>
          <TextInput
            style={s.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={
              isDream && editArming
                ? '输入图像编辑指令，如：把天空换成日落、人物换上红色外套…'
                : '描述你想生成的画面…'
            }
            placeholderTextColor="#999"
            multiline
          />
          <Text style={prompt.length > PROMPT_LIMIT ? s.promptHintWarn : s.promptHint}>
            {prompt.length}/{PROMPT_LIMIT} · 端侧建议≤{PROMPT_LIMIT}字，过长拖慢速度
          </Text>
          <TouchableOpacity onPress={() => setShowAdvanced(a => !a)}>
            <Text style={s.advToggle}>
              高级参数（{isDream && editArming ? '步数' : isDream ? '尺寸/步数' : '负面/尺寸/步数/CFG'}）{showAdvanced ? '▴' : '▾'}
            </Text>
          </TouchableOpacity>
          {showAdvanced && (
            <>
              {!isDream && (
                <TextInput
                  style={[s.input, s.inputSmall]}
                  value={negativePrompt}
                  onChangeText={setNegativePrompt}
                  placeholder="负面提示词（可选，如 blurry, low quality）"
                  placeholderTextColor="#999"
                  multiline
                />
              )}
              {isDream ? (
                editArming ? (
                  <Text style={s.promptHint}>
                    编辑输出 {Math.min(dreamW, dreamH)}×{Math.min(dreamW, dreamH)} 正方形（按较大边压缩）
                  </Text>
                ) : (
                  <View style={s.paramRow}>
                    <Text style={s.paramLabel}>画幅</Text>
                    {Object.keys(RATIOS).map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[s.sizeBtn, ratio === r && s.sizeBtnSelected]}
                        onPress={() => setRatio(r)}>
                        <Text style={s.sizeBtnText}>{r}</Text>
                        <Text style={s.sizeBtnSub}>
                          {RATIOS[r][0]}×{RATIOS[r][1]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              ) : (
                <View style={s.paramRow}>
                  <Text style={s.paramLabel}>尺寸</Text>
                  {SIZES.map(sz => (
                    <TouchableOpacity
                      key={sz}
                      style={[s.sizeBtn, size === sz && s.sizeBtnSelected]}
                      onPress={() => setSize(sz)}>
                      <Text style={s.sizeBtnText}>{sz}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={s.paramRow}>
                <Text style={s.paramLabel}>步数</Text>
                <TextInput
                  style={s.paramInput}
                  value={steps}
                  onChangeText={setSteps}
                  keyboardType="numeric"
                />
                {!isDream && (
                  <>
                    <Text style={s.paramLabel}>CFG</Text>
                    <TextInput
                      style={s.paramInput}
                      value={cfg}
                      onChangeText={setCfg}
                      keyboardType="numeric"
                    />
                  </>
                )}
              </View>
            </>
          )}
          {isDream && (
            <>
              {editArming && (
                <Text style={s.promptHint}>
                  已锁定当前预览图（{Math.min(dreamW, dreamH)}×{Math.min(dreamW, dreamH)}），编辑指令见上方输入框
                </Text>
              )}
              <View style={s.buttonRow}>
                <TouchableOpacity
                  style={[
                    s.button,
                    s.buttonEdit,
                    editArming && !editRgb && s.buttonDisabled,
                  ]}
                  disabled={imageGenStore.generating || (editArming && !editRgb)}
                  onPress={handleEditArm}>
                  {imageGenStore.generating && taskKind === 'edit' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.buttonText}>
                      {editArming ? '执行编辑' : '编辑'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.button, s.buttonGen]}
                  disabled={imageGenStore.generating}
                  onPress={handleGenerate}>
                  {imageGenStore.generating && taskKind === 'gen' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.buttonText}>出图</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
          {!isDream && (
            <TouchableOpacity
              style={[s.button, !loaded && s.buttonDisabled]}
              disabled={imageGenStore.generating || !loaded}
              onPress={handleGenerate}>
              {imageGenStore.generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.buttonText}>出图</Text>
              )}
            </TouchableOpacity>
          )}
          {imageGenStore.error && <Text style={s.error}>{imageGenStore.error}</Text>}
        </View>
      </KeyboardAwareScrollView>

      {/* 模型锚定下拉：悬浮盖住下方 + 点外收起 */}
      {showModelDrop && (
        <View style={s.dropOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={s.dropBackdrop}
            activeOpacity={1}
            onPress={() => setShowModelDrop(false)}
          />
          <View style={s.dropPanelAbs}>
            {scanning ? (
              <ActivityIndicator size="small" />
            ) : available.length === 0 ? (
              <Text style={s.hint}>
                未找到生图模型，请将 SDXL Turbo / SD3.5 / Z-Image-Turbo 套件（GGUF）放入{' '}
                {AIOS_MODELS_DIR}
              </Text>
            ) : (
              available.map(item => {
                const rowLoaded = isRowLoaded(item);
                const rowLoading = imageGenStore.loading;
                return (
                  <TouchableOpacity
                    key={item.manifest.id}
                    style={[
                      s.modelRow,
                      selectedId === item.manifest.id && s.modelRowSelected,
                    ]}
                    onPress={() => handleSelectModel(item)}>
                    <View style={s.modelRowMain}>
                      <Text style={s.modelName} numberOfLines={1}>
                        {FAMILY_BADGE[item.manifest.family] ? (
                          <Text
                            style={
                              item.manifest.family === 'sd3'
                                ? s.badgeSd3
                                : item.manifest.family === 'dreamlite'
                                  ? s.badgeDream
                                  : s.badgeZ
                            }>
                            [{FAMILY_BADGE[item.manifest.family]}]{' '}
                          </Text>
                        ) : null}
                        {item.manifest.label}
                        {item.manifest.experimental ? (
                          <Text style={s.badgeExp}>  [实验性]</Text>
                        ) : null}
                      </Text>
                      {item.manifest.note ? (
                        <Text style={s.modelNote} numberOfLines={2}>
                          {item.manifest.note}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        s.rowActionBtn,
                        rowLoaded && s.rowActionBtnUnload,
                      ]}
                      disabled={imageGenStore.loading || imageGenStore.generating}
                      onPress={() => handleRowAction(item)}>
                      {rowLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={rowLoaded ? '#c62828' : '#ffffff'}
                        />
                      ) : (
                        <Text
                          style={[
                            s.rowActionText,
                            rowLoaded && s.rowActionTextUnload,
                          ]}>
                          {rowLoaded ? '卸载' : '加载'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
            {imageGenStore.loading && (
              <View style={s.statusPanel}>
                <Text style={s.progressText}>
                  正在加载模型…{' · 已耗时 '}
                  {Math.max(0, Math.round((now - imageGenStore.loadingStartedAt) / 1000))}
                  {'s'}
                </Text>
                {imageGenStore.stage ? (
                  <Text style={s.stageText} numberOfLines={2}>
                    ▸ {imageGenStore.stage}
                  </Text>
                ) : null}
              </View>
            )}
            {loaded && !imageGenStore.loading && (
              <Text style={s.readyText}>
                {isDream
                  ? '✓ 模型已就绪，可以出图（4 步 1024px 约 25s）'
                  : '✓ 模型已就绪（CPU 后端，512px 预计数分钟，请耐心）'}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* 全屏查看 */}
      <Modal visible={fullscreen} transparent animationType="fade">
        <View style={s.fullscreenBackdrop}>
          <TouchableOpacity
            style={s.fullscreenTouch}
            onPress={() => setFullscreen(false)}>
            {currentImage ? (
              <Image
                source={{uri: currentImage}}
                style={s.fullscreenImage}
                resizeMode="contain"
              />
            ) : null}
          </TouchableOpacity>
          <Text style={s.fullscreenHint}>点按关闭</Text>
        </View>
      </Modal>
    </View>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.background},
    content: {padding: 16, gap: 12},
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    cardTitle: {fontSize: 15, fontWeight: '600', color: theme.colors.onSurface},
    hint: {fontSize: 12, color: theme.colors.onSurfaceVariant},
    modelChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    modelChipText: {flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.onSurface},
    modelChipStatus: {fontSize: 12, color: theme.colors.primary},
    dropPanel: {
      marginTop: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      // 锚定下拉：盖在后续内容之上
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: {width: 0, height: 4},
    },
    modelRow: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      flexDirection: 'row',
      alignItems: 'center',
    },
    modelRowMain: {flex: 1, paddingRight: 8},
    modelRowSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    modelName: {fontSize: 13, color: theme.colors.onSurface},
    modelNote: {fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 2},
    // 行内加载/卸载按钮（操作就近，状态可见；卸载需二次确认）
    rowActionBtn: {
      minWidth: 56,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
    },
    rowActionBtnUnload: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#c62828',
    },
    rowActionText: {fontSize: 12, color: '#fff', fontWeight: '600'},
    rowActionTextUnload: {color: '#c62828'},
    resultWrap: {position: 'relative'},
    preview: {width: '100%', aspectRatio: 1, borderRadius: 8},
    // 0 页编辑槽：上传大按钮 / 待编辑图预览 + 重新上传
    editSlot: {
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    editSlotImg: {width: '100%', height: '100%', borderRadius: 8},
    uploadBig: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.outline,
      borderRadius: 12,
      paddingHorizontal: 32,
      paddingVertical: 28,
    },
    uploadBigIcon: {fontSize: 40, color: theme.colors.primary, fontWeight: '300'},
    uploadBigText: {fontSize: 15, color: theme.colors.onSurface, fontWeight: '600'},
    uploadBigHint: {fontSize: 11, color: theme.colors.onSurfaceVariant},
    uploadFab: {
      position: 'absolute',
      bottom: 10,
      backgroundColor: 'rgba(21,101,192,0.9)',
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    uploadFabText: {fontSize: 12, color: '#fff', fontWeight: '600'},
    genOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8,10,18,0.97)', // 出图：空白页盖住预览区（正在生成新图）
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 8,
    },
    genOverlayEdit: {
      backgroundColor: 'rgba(8,10,18,0.6)', // 编辑：半透明叠在当前图上，图可见
    },
    genOrb: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    genOrbText: {fontSize: 22, color: theme.colors.primary},
    genOverlayTitle: {fontSize: 14, color: '#fff', fontWeight: '600', marginTop: 4},
    overlayText: {fontSize: 11, color: '#fff'},
    overlayStage: {fontSize: 10, color: '#fff'},
    actionRow: {flexDirection: 'row', gap: 8},
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    actionText: {fontSize: 12, color: theme.colors.onSurface},
    actionTextLight: {fontSize: 12, color: '#fff', fontWeight: '600'},
    actionDanger: {color: theme.colors.error},
    // 语义彩色点缀
    actionSave: {backgroundColor: '#2e7d32'},
    actionEdit: {backgroundColor: '#1565c0'},
    actionReuse: {backgroundColor: '#ef6c00'},
    actionDelete: {backgroundColor: '#c62828'},
    badgeSd3: {color: '#8e24aa', fontWeight: '700'},
    badgeZ: {color: '#00838f', fontWeight: '700'},
    badgeDream: {color: '#d81b60', fontWeight: '700'},
    // 实验性徽章：琥珀警示色（模型可能不可用，与操作按钮橙区分）
    badgeExp: {color: '#f57c00', fontWeight: '700', fontSize: 11},
    dropOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 50,
      elevation: 50,
    },
    dropBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    dropPanelAbs: {
      position: 'absolute',
      top: 64,
      left: 16,
      right: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: {width: 0, height: 6},
    },
    watermark: {fontSize: 10, color: theme.colors.onSurfaceVariant},
    toastBar: {
      position: 'absolute',
      top: 8,
      left: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    toastText: {fontSize: 12, color: '#fff'},
    historyHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    historyHeaderActions: {flexDirection: 'row', alignItems: 'center', gap: 14},
    uploadText: {fontSize: 12, color: '#1565c0', fontWeight: '600'},
    manageText: {fontSize: 12, color: theme.colors.primary},
    historyItem: {marginRight: 8, position: 'relative'},
    historyThumb: {width: 72, height: 72, borderRadius: 8},
    historyKindBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: 'rgba(21,101,192,0.9)',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    historyKindText: {fontSize: 9, color: '#fff', fontWeight: '600'},
    historySel: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    historySelText: {color: '#fff', fontSize: 20, fontWeight: '700'},
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonRow: {flexDirection: 'row', gap: 10},
    buttonEdit: {flex: 1, backgroundColor: '#1565c0'},
    buttonGen: {flex: 1},
    buttonSecondary: {backgroundColor: theme.colors.surfaceVariant},
    buttonDanger: {backgroundColor: theme.colors.error},
    buttonDisabled: {backgroundColor: theme.colors.surfaceVariant},
    buttonText: {color: '#fff', fontSize: 14, fontWeight: '600'},
    error: {fontSize: 12, color: theme.colors.error},
    input: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: 8,
      padding: 12,
      minHeight: 72,
      color: theme.colors.onSurface,
      textAlignVertical: 'top',
    },
    inputSmall: {minHeight: 44, padding: 8},
    advToggle: {fontSize: 12, color: theme.colors.primary},
    promptHint: {fontSize: 10, color: theme.colors.onSurfaceVariant},
    promptHintWarn: {fontSize: 10, color: theme.colors.error},
    paramRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10},
    paramLabel: {fontSize: 13, color: theme.colors.onSurfaceVariant},
    paramInput: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      width: 60,
      color: theme.colors.onSurface,
    },
    sizeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
    },
    sizeBtnSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    sizeBtnText: {fontSize: 12, color: theme.colors.onSurface},
    sizeBtnSub: {fontSize: 10, color: theme.colors.onSurfaceVariant, marginTop: 2},
    statusPanel: {marginTop: 6, gap: 3},
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.3)',
      overflow: 'hidden',
    },
    progressBarFill: {height: 8, backgroundColor: theme.colors.primary, borderRadius: 4},
    progressText: {fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 2},
    stageText: {fontSize: 10, color: theme.colors.primary},
    readyText: {fontSize: 12, color: theme.colors.primary, marginTop: 4},
    fullscreenBackdrop: {flex: 1, backgroundColor: '#000'},
    fullscreenTouch: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    fullscreenImage: {width: '100%', height: '100%'},
    fullscreenHint: {position: 'absolute', bottom: 24, alignSelf: 'center', color: '#fff', fontSize: 12},
  });
