/**
 * ImageGenScreen — 生图页（P5.4 三行布局）
 *
 * 布局（用户视角，单列三区）：
 *  ① 结果区（置顶主角）：最新图 + 操作条[存相册/分享/同参数/删除] + 参数水印，点图全屏
 *  ② 历史区（紧凑横条）：横向滑动缩略图，[管理]多选删除，点图查看
 *  ③ 创作区（底部 composer）：提示词 + 折叠高级参数 + 全宽出图按钮
 * 模型选择收进顶部状态胶囊，点开弹底部面板切换/加载/卸载。
 */
import * as React from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {observer} from 'mobx-react-lite';
import {runInAction} from 'mobx';
import Share from 'react-native-share';

import {imageGenStore} from '../../store/imageGenStore';
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
  // P5.4 交互态
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showModelSheet, setShowModelSheet] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [manageMode, setManageMode] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<string[]>([]);

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
      setAvailable(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].manifest.id);
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

  const handleLoad = async () => {
    if (!selectedEntry) {
      return;
    }
    const {extras, missing} = await resolveCompanions(
      selectedEntry.manifest,
      AIOS_MODELS_DIR,
    );
    if (missing.length > 0) {
      runInAction(() => {
        imageGenStore.error = `缺少伴侣文件：${missing.join('、')}`;
      });
      return;
    }
    await imageGenStore.loadModel(selectedEntry.mainPath, extras);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }
    const uri = await imageGenStore.generate(prompt.trim(), {
      steps: parseInt(steps, 10) || 2,
      cfg: parseFloat(cfg) || 2,
      width: size,
      height: size,
      negativePrompt: negativePrompt.trim(),
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
    : imageGenStore.modelLoaded
      ? '已就绪'
      : '未加载';

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        {/* 模型状态胶囊 */}
        <TouchableOpacity
          style={s.modelChip}
          onPress={() => setShowModelSheet(true)}>
          <Text style={s.modelChipText} numberOfLines={1}>
            {selectedEntry
              ? `${
                  FAMILY_BADGE[selectedEntry.manifest.family]
                    ? `[${FAMILY_BADGE[selectedEntry.manifest.family]}] `
                    : ''
                }${selectedEntry.manifest.label}`
              : '选择模型'}
          </Text>
          <Text style={s.modelChipStatus}>
            {modelStatus} ▾
          </Text>
        </TouchableOpacity>

        {/* ① 结果区（主角，置顶） */}
        <View style={s.card}>
          {currentImage ? (
            <>
              <TouchableOpacity onPress={() => setFullscreen(true)}>
                <Image
                  source={{uri: currentImage}}
                  style={s.preview}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => currentImage && imageGenStore.saveToAlbum(currentImage)}>
                  <Text style={s.actionText}>存相册</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
                  <Text style={s.actionText}>分享</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={handleReuse}>
                  <Text style={s.actionText}>同参数</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() =>
                    currentImage && imageGenStore.deleteHistory([currentImage], true)
                  }>
                  <Text style={[s.actionText, s.actionDanger]}>删除</Text>
                </TouchableOpacity>
              </View>
              {currentItem ? (
                <Text style={s.watermark} numberOfLines={1}>
                  seed {currentItem.seed} · {currentItem.width}×{currentItem.height}
                </Text>
              ) : null}
            </>
          ) : (
            <View style={s.emptyResult}>
              <Text style={s.hint}>生成结果将显示在这里</Text>
            </View>
          )}
        </View>

        {/* ② 历史区（紧凑横条） */}
        {imageGenStore.history.length > 0 && (
          <View style={s.card}>
            <View style={s.historyHeader}>
              <Text style={s.cardTitle}>历史 ({imageGenStore.history.length})</Text>
              <TouchableOpacity onPress={() => {
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
          <TouchableOpacity onPress={() => setShowAdvanced(a => !a)}>
            <Text style={s.advToggle}>
              高级参数（负面/尺寸/步数/CFG）{showAdvanced ? '▴' : '▾'}
            </Text>
          </TouchableOpacity>
          {showAdvanced && (
            <>
              <TextInput
                style={[s.input, s.inputSmall]}
                value={negativePrompt}
                onChangeText={setNegativePrompt}
                placeholder="负面提示词（可选，如 blurry, low quality）"
                placeholderTextColor="#999"
                multiline
              />
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
              <View style={s.paramRow}>
                <Text style={s.paramLabel}>步数</Text>
                <TextInput
                  style={s.paramInput}
                  value={steps}
                  onChangeText={setSteps}
                  keyboardType="numeric"
                />
                <Text style={s.paramLabel}>CFG</Text>
                <TextInput
                  style={s.paramInput}
                  value={cfg}
                  onChangeText={setCfg}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}
          <TouchableOpacity
            style={[
              s.button,
              !imageGenStore.modelLoaded && s.buttonDisabled,
            ]}
            disabled={!imageGenStore.modelLoaded || imageGenStore.generating}
            onPress={handleGenerate}>
            {imageGenStore.generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : imageGenStore.modelLoaded ? (
              <Text style={s.buttonText}>出图</Text>
            ) : (
              <Text style={s.buttonTextDisabled}>请先加载模型</Text>
            )}
          </TouchableOpacity>
          {/* 生成进度 */}
          {imageGenStore.generating && (
            <View style={s.statusPanel}>
              <View style={s.progressTrack}>
                <View
                  style={[
                    s.progressBarFill,
                    {width: `${Math.max(imageGenStore.progress, 2)}%`},
                  ]}
                />
              </View>
              <Text style={s.progressText}>
                {imageGenStore.progressText
                  ? `采样 ${imageGenStore.progressText}` +
                    (imageGenStore.stepTime > 0
                      ? `（${imageGenStore.stepTime.toFixed(1)}s/步）`
                      : '')
                  : '加载权重/准备中…'}
                {' · 总耗时 '}
                {Math.max(0, Math.round((now - imageGenStore.genStartedAt) / 1000))}
                {'s'}
              </Text>
              {imageGenStore.stage ? (
                <Text style={s.stageText} numberOfLines={2}>
                  ▸ {imageGenStore.stage}
                </Text>
              ) : null}
            </View>
          )}
          {imageGenStore.error && <Text style={s.error}>{imageGenStore.error}</Text>}
        </View>
      </ScrollView>

      {/* 模型选择面板 */}
      <Modal visible={showModelSheet} transparent animationType="slide">
        <View style={s.sheetBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.cardTitle}>生图模型</Text>
              <TouchableOpacity onPress={() => setShowModelSheet(false)}>
                <Text style={s.manageText}>关闭</Text>
              </TouchableOpacity>
            </View>
            {scanning ? (
              <ActivityIndicator size="small" />
            ) : available.length === 0 ? (
              <Text style={s.hint}>
                未找到生图模型，请将 SDXL Turbo / SD3.5 / Z-Image-Turbo 套件（GGUF）放入{' '}
                {AIOS_MODELS_DIR}
              </Text>
            ) : (
              <FlatList
                data={available}
                keyExtractor={item => item.manifest.id}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={[
                      s.modelRow,
                      selectedId === item.manifest.id && s.modelRowSelected,
                    ]}
                    onPress={() => setSelectedId(item.manifest.id)}>
                    <Text style={s.modelName} numberOfLines={1}>
                      {FAMILY_BADGE[item.manifest.family]
                        ? `[${FAMILY_BADGE[item.manifest.family]}] `
                        : ''}
                      {item.manifest.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={[s.button, imageGenStore.modelLoaded && s.buttonSecondary]}
              disabled={!selectedId || imageGenStore.generating || imageGenStore.loading}
              onPress={imageGenStore.modelLoaded ? imageGenStore.unloadModel : handleLoad}>
              {imageGenStore.loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.buttonText}>
                  {imageGenStore.modelLoaded ? '卸载模型' : '加载模型'}
                </Text>
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
            {imageGenStore.modelLoaded && !imageGenStore.loading && (
              <Text style={s.readyText}>✓ 模型已就绪，可以出图</Text>
            )}
          </View>
        </View>
      </Modal>

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
    modelChipText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    modelChipStatus: {fontSize: 12, color: theme.colors.primary},
    preview: {width: '100%', aspectRatio: 1, borderRadius: 8},
    emptyResult: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionRow: {flexDirection: 'row', gap: 8},
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    actionText: {fontSize: 12, color: theme.colors.onSurface},
    actionDanger: {color: theme.colors.error},
    watermark: {fontSize: 10, color: theme.colors.onSurfaceVariant},
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
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
      backgroundColor: theme.colors.surfaceVariant,
      overflow: 'hidden',
    },
    progressBarFill: {height: 8, backgroundColor: theme.colors.primary, borderRadius: 4},
    progressText: {fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 2},
    stageText: {fontSize: 10, color: theme.colors.primary},
    readyText: {fontSize: 12, color: theme.colors.primary, marginTop: 4},
    modelRow: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
      marginBottom: 8,
    },
    modelRowSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    modelName: {fontSize: 13, color: theme.colors.onSurface},
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      maxHeight: '70%',
      gap: 10,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fullscreenBackdrop: {flex: 1, backgroundColor: '#000'},
    fullscreenTouch: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    fullscreenImage: {width: '100%', height: '100%'},
    fullscreenHint: {
      position: 'absolute',
      bottom: 24,
      alignSelf: 'center',
      color: '#fff',
      fontSize: 12,
    },
  });
