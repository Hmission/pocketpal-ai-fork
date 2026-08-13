/**
 * ImageGenScreen — 生图页（P5.4 三行布局 v2）
 *
 * 布局（用户视角，单列三区）：
 *  顶部：模型状态胶囊 → 点按展开锚定下拉面板（选模型 + 加载/卸载确认）
 *  ① 结果区（置顶主角）：最新图 + 操作条 + 参数水印；生成中进度 overlay 叠在结果区上
 *  ② 历史区（紧凑横条）：横向滑动 + [管理]多选删除
 *  ③ 创作区（底部 composer）：提示词 + 折叠高级参数 + 全宽出图按钮
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
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {observer} from 'mobx-react-lite';
import {runInAction} from 'mobx';
import Share from 'react-native-share';
import {launchImageLibrary} from 'react-native-image-picker';

import {imageGenStore} from '../../store/imageGenStore';
import {
  loadDreamLite,
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

// DreamLite 作为统一模型选项进入顶部选择栏（非独立按钮）
const DREAMLITE_MANIFEST: ImageGenManifest = {
  id: 'dreamlite',
  label: 'DreamLite Mobile (4步)',
  family: 'dreamlite',
  main: '',
  defaults: {steps: 4, cfg: 1, size: 512},
  note: '统一文生图+编辑',
};

const PROMPT_LIMIT = 120;

// 官方支持多分辨率/画幅（base 1024）
const RATIOS: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '3:4': [768, 1024],
  '4:3': [1024, 768],
  '9:16': [576, 1024],
  '16:9': [1024, 576],
};

export const ImageGenScreen: React.FC = observer(() => {
  const theme = useTheme();
  const [available, setAvailable] = React.useState<
    {manifest: ImageGenManifest; mainPath: string}[]
  >([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [negativePrompt, setNegativePrompt] = React.useState('');
  const [steps, setSteps] = React.useState('2');
  const [cfg, setCfg] = React.useState('2');
  const [size, setSize] = React.useState(512);
  const [currentImage, setCurrentImage] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showModelDrop, setShowModelDrop] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [manageMode, setManageMode] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<string[]>([]);
  const [mode, setMode] = React.useState<'gen' | 'edit'>('gen');
  const [ratio, setRatio] = React.useState('1:1');
  const dreamW = RATIOS[ratio]?.[0] ?? 1024;
  const dreamH = RATIOS[ratio]?.[1] ?? 1024;
  const [editSource, setEditSource] = React.useState<string | null>(null);
  const [editRgb, setEditRgb] = React.useState<Float32Array | null>(null);
  const [pageW, setPageW] = React.useState(0);

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
    await imageGenStore.loadModel(entry.mainPath, extras);
  };

  const handleLoad = () => {
    if (!selectedEntry) {
      return;
    }
    if (loaded) {
      // 卸载
      if (isDream) {
        runInAction(() => {
          imageGenStore.dreamliteLoaded = false;
        });
      } else {
        imageGenStore.unloadModel();
      }
      return;
    }
    loadEntry(selectedEntry);
  };

  // 下拉选中：选中 + 收起 + 自动加载（选即载，产品锋利）
  const handleSelectModel = (entry: {
    manifest: ImageGenManifest;
    mainPath: string;
  }) => {
    setSelectedId(entry.manifest.id);
    setShowModelDrop(false);
    loadEntry(entry);
  };

  // 结果轮播切换→回填该历史图的提示词/参数
  const syncFrom = (item: {
    uri: string;
    prompt: string;
    width: number;
    steps?: number;
    cfg?: number;
  }) => {
    setCurrentImage(item.uri);
    setPrompt(item.prompt);
    if (item.width) {
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
    handleGenerate(); // 同参数再次抽卡
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
    } catch (e) {
      runInAction(() => {
        imageGenStore.error = `解码图片: ${(e as any)?.message ?? e}`;
      });
    }
  };

  const handleEditRun = async () => {
    if (!editRgb) {
      return;
    }
    runInAction(() => {
      imageGenStore.generating = true;
      imageGenStore.genStartedAt = Date.now();
      imageGenStore.progress = 0;
      imageGenStore.stage = '编辑: TE 编码…';
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
      );
      setCurrentImage(uri);
      imageGenStore.pushHistory({
        uri,
        prompt: prompt.trim(),
        seed: Date.now() % 1e9,
        ts: Date.now(),
        width: size,
        height: size,
        steps: parseInt(steps, 10) || 4,
        family: 'dreamlite',
      });
    } catch (e) {
      runInAction(() => {
        imageGenStore.error = `DreamLite编辑: ${(e as any)?.message ?? e}`;
      });
    } finally {
      runInAction(() => {
        imageGenStore.generating = false;
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }
    if (isDream) {
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
        setCurrentImage(uri);
        imageGenStore.pushHistory({
          uri,
          prompt: prompt.trim(),
          seed: Date.now() % 1e9,
          ts: Date.now(),
          width: size,
          height: size,
          steps: parseInt(steps, 10) || 4,
          family: 'dreamlite',
        });
      } catch (e) {
        runInAction(() => {
          imageGenStore.error = `DreamLite: ${(e as any)?.message ?? e}`;
        });
      } finally {
        runInAction(() => {
          imageGenStore.generating = false;
        });
      }
      return;
    }
    const m = selectedEntry?.manifest;
    const uri = await imageGenStore.generate(prompt.trim(), {
      steps: parseInt(steps, 10) || 2,
      cfg: parseFloat(cfg) || 2,
      width: size,
      height: size,
      negativePrompt: negativePrompt.trim(),
      loraPath: m?.lora ? `${AIOS_MODELS_DIR}/${m.lora}` : undefined,
      loraMultiplier: m?.loraMultiplier,
    });
    if (uri) {
      setCurrentImage(uri);
    }
  };

  const currentItem = imageGenStore.history.find(h => h.uri === currentImage) ?? null;

  const handleShare = async () => {
    if (!currentImage) {
      return;
    }
    try {
      await Share.open({url: currentImage, type: 'image/png'});
    } catch {
      /* 用户取消 */
    }
  };

  const handleReuse = () => {
    if (!currentItem) {
      return;
    }
    setPrompt(currentItem.prompt);
    if (currentItem.width === currentItem.height) {
      setSize(currentItem.width);
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
    if (currentImage && toDelete.includes(currentImage)) {
      setCurrentImage(null);
    }
    setToDelete([]);
    setManageMode(false);
  };

  const s = createStyles(theme);

  const modelStatus = imageGenStore.loading
    ? '加载中…'
    : loaded
      ? '已就绪'
      : '未加载';

  // 生成进度 overlay（叠在结果区上）
  const genOverlay = imageGenStore.generating ? (
    <View style={s.genOverlay}>
      <View style={s.progressTrack}>
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
            </Text>
            <Text style={s.modelChipStatus}>{modelStatus} {showModelDrop ? '▴' : '▾'}</Text>
          </TouchableOpacity>

        </View>

        {/* ① 结果区（左右滑动切换历史图；切换自动回填提示词/参数） */}
        <View style={s.card}>
          <View
            style={s.resultWrap}
            onLayout={e => setPageW(e.nativeEvent.layout.width)}>
            {imageGenStore.history.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  if (!pageW) {
                    return;
                  }
                  const idx = Math.round(e.nativeEvent.contentOffset.x / pageW);
                  const item = imageGenStore.history[idx];
                  if (item) {
                    syncFrom(item);
                  }
                }}>
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
            ) : (
              <View style={s.emptyResult}>
                <Text style={s.hint}>生成结果将显示在这里（左右滑动切换历史）</Text>
              </View>
            )}
            {genOverlay}
          </View>
          {currentImage && (
            <>
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionSave]}
                  onPress={() => currentImage && imageGenStore.saveToAlbum(currentImage)}>
                  <Text style={s.actionTextLight}>存相册</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionShare]} onPress={handleShare}>
                  <Text style={s.actionTextLight}>分享</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionReuse]} onPress={handleReroll}>
                  <Text style={s.actionTextLight}>抽卡</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionDelete]}
                  onPress={() =>
                    currentImage && imageGenStore.deleteHistory([currentImage], true)
                  }>
                  <Text style={s.actionTextLight}>删除</Text>
                </TouchableOpacity>
              </View>
              {currentItem ? (
                <Text style={s.watermark} numberOfLines={1}>
                  seed {currentItem.seed} · {currentItem.width}×{currentItem.height}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* ② 历史区（紧凑横条） */}
        {imageGenStore.history.length > 0 && (
          <View style={s.card}>
            <View style={s.historyHeader}>
              <Text style={s.cardTitle}>历史 ({imageGenStore.history.length})</Text>
              <TouchableOpacity
                onPress={() => {
                  setManageMode(m => !m);
                  setToDelete([]);
                }}>
                <Text style={s.manageText}>{manageMode ? '完成' : '管理'}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={imageGenStore.history}
              keyExtractor={item => item.uri}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={s.historyItem}
                  onPress={() =>
                    manageMode ? toggleDelete(item.uri) : setCurrentImage(item.uri)
                  }>
                  <Image source={{uri: item.uri}} style={s.historyThumb} />
                  {manageMode && toDelete.includes(item.uri) && (
                    <View style={s.historySel}>
                      <Text style={s.historySelText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
            {manageMode && (
              <TouchableOpacity
                style={[s.button, s.buttonDanger]}
                disabled={toDelete.length === 0}
                onPress={confirmDelete}>
                <Text style={s.buttonText}>删除选中 ({toDelete.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ③ 创作区（底部 composer） */}
        <View style={s.card}>
          <TextInput
            style={s.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="描述你想生成的画面…"
            placeholderTextColor="#999"
            multiline
          />
          <Text style={prompt.length > PROMPT_LIMIT ? s.promptHintWarn : s.promptHint}>
            {prompt.length}/{PROMPT_LIMIT} · 端侧建议≤{PROMPT_LIMIT}字，过长拖慢速度
          </Text>
          <TouchableOpacity onPress={() => setShowAdvanced(a => !a)}>
            <Text style={s.advToggle}>
              高级参数（{isDream ? '尺寸/步数' : '负面/尺寸/步数/CFG'}）{showAdvanced ? '▴' : '▾'}
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
                <View style={s.paramRow}>
                  <Text style={s.paramLabel}>画幅</Text>
                  {Object.keys(RATIOS).map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[s.sizeBtn, ratio === r && s.sizeBtnSelected]}
                      onPress={() => setRatio(r)}>
                      <Text style={s.sizeBtnText}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
            <View style={s.modeRow}>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'gen' && s.modeBtnActive]}
                onPress={() => setMode('gen')}>
                <Text style={s.modeBtnText}>文生图</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'edit' && s.modeBtnActive]}
                onPress={() => setMode('edit')}>
                <Text style={s.modeBtnText}>图像编辑</Text>
              </TouchableOpacity>
            </View>
          )}
          {isDream && mode === 'edit' && (
            <>
              <TouchableOpacity
                style={[s.button, s.buttonSecondary]}
                onPress={handlePickEditImage}>
                <Text style={s.buttonText}>
                  {editSource ? '重新上传图片' : '上传图片'}
                </Text>
              </TouchableOpacity>
              {editSource ? (
                <Text style={s.promptHint}>已按较大边压缩至 {size}×{size}</Text>
              ) : null}
              <TouchableOpacity
                style={[s.button, (!editRgb || !loaded) && s.buttonDisabled]}
                disabled={!editRgb || !loaded || imageGenStore.generating}
                onPress={handleEditRun}>
                {imageGenStore.generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.buttonText}>编辑</Text>
                )}
              </TouchableOpacity>
            </>
          )}
          {(!isDream || mode === 'gen') && (
          <TouchableOpacity
            style={[s.button, !loaded && s.buttonDisabled]}
            disabled={!loaded || imageGenStore.generating}
            onPress={handleGenerate}>
            {imageGenStore.generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : loaded ? (
              <Text style={s.buttonText}>出图</Text>
            ) : (
              <Text style={s.buttonTextDisabled}>请先加载模型</Text>
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
              available.map(item => (
                <TouchableOpacity
                  key={item.manifest.id}
                  style={[
                    s.modelRow,
                    selectedId === item.manifest.id && s.modelRowSelected,
                  ]}
                  onPress={() => handleSelectModel(item)}>
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
                  </Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={[s.button, loaded && s.buttonSecondary]}
              disabled={!selectedId || imageGenStore.generating || imageGenStore.loading}
              onPress={handleLoad}>
              {imageGenStore.loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.buttonText}>{loaded ? '卸载模型' : '加载模型'}</Text>
              )}
            </TouchableOpacity>
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
              <Text style={s.readyText}>✓ 模型已就绪，可以出图</Text>
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
    },
    modelRowSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    modelName: {fontSize: 13, color: theme.colors.onSurface},
    resultWrap: {position: 'relative'},
    preview: {width: '100%', aspectRatio: 1, borderRadius: 8},
    emptyResult: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    genOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      padding: 10,
      gap: 4,
    },
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
    actionShare: {backgroundColor: '#1565c0'},
    actionReuse: {backgroundColor: '#ef6c00'},
    actionDelete: {backgroundColor: '#c62828'},
    badgeSd3: {color: '#8e24aa', fontWeight: '700'},
    badgeZ: {color: '#00838f', fontWeight: '700'},
    badgeDream: {color: '#d81b60', fontWeight: '700'},
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
    historyHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    manageText: {fontSize: 12, color: theme.colors.primary},
    historyItem: {marginRight: 8, position: 'relative'},
    historyThumb: {width: 72, height: 72, borderRadius: 8},
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
    buttonSecondary: {backgroundColor: theme.colors.surfaceVariant},
    buttonDanger: {backgroundColor: theme.colors.error},
    buttonDisabled: {backgroundColor: theme.colors.surfaceVariant},
    buttonText: {color: '#fff', fontSize: 14, fontWeight: '600'},
    buttonTextDisabled: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      fontWeight: '600',
    },
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
    modeRow: {flexDirection: 'row', gap: 8},
    modeBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    modeBtnActive: {backgroundColor: theme.colors.primary},
    modeBtnText: {fontSize: 13, color: '#fff', fontWeight: '600'},
    paramRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
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
    },
    sizeBtnSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    sizeBtnText: {fontSize: 12, color: theme.colors.onSurface},
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
