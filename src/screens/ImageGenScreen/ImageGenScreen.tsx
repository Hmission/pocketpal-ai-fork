/**
 * ImageGenScreen — 生图页（P5.2）
 *
 * 布局：模型状态卡（扫描 SD 模型 + 加载/卸载）→ 提示词输入 → 出图 →
 * 结果预览 + 历史网格。全部走 imageGenStore（JNI → stable-diffusion.cpp）。
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
} from 'react-native';
import {observer} from 'mobx-react-lite';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {imageGenStore} from '../../store/imageGenStore';
import {useTheme} from '../../hooks';

const SD_MODELS_DIR = '/sdcard/Documents/AIOS/models';

// 生图模型架构族：zimage（Z-Image-Turbo）/ sd3（SD3.x/3.5）/ classic（SDXL Turbo 等一体式）
type ModelFamily = 'zimage' | 'sd3' | 'classic';

const familyOf = (name: string): ModelFamily => {
  if (/z[_-]?image/i.test(name)) {
    return 'zimage';
  }
  if (/sd[_-]?3/i.test(name)) {
    return 'sd3';
  }
  return 'classic';
};

// 伴侣/辅助文件（不作为主模型展示）
const isCompanion = (name: string) =>
  /(clip[_-]?[lg]|\bvae\b|^ae\.|llm|qwen|t5)/i.test(name);

// 每族推荐默认参数（步数/CFG）
const FAMILY_DEFAULTS: Record<ModelFamily, {steps: string; cfg: string}> = {
  zimage: {steps: '8', cfg: '1'},
  sd3: {steps: '20', cfg: '4.5'},
  classic: {steps: '2', cfg: '2'},
};

const FAMILY_LABEL: Record<ModelFamily, string> = {
  zimage: 'Z-Image',
  sd3: 'SD3.5',
  classic: '',
};

export const ImageGenScreen: React.FC = observer(() => {
  const theme = useTheme();
  const [sdModels, setSdModels] = React.useState<string[]>([]);
  const [selectedModel, setSelectedModel] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [negativePrompt, setNegativePrompt] = React.useState('');
  const [steps, setSteps] = React.useState('2');
  const [cfg, setCfg] = React.useState('2');
  const [size, setSize] = React.useState(512);
  const [currentImage, setCurrentImage] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);

  const SIZES = [384, 512, 640, 768];

  const scanModels = React.useCallback(async () => {
    setScanning(true);
    try {
      const files = await RNFS.readDir(SD_MODELS_DIR);
      const all = files.map(f => f.name);
      // 主模型识别：GGUF/safetensors，文件名含生图关键词，排除伴侣文件与聊天 LLM
      const models = all
        .filter(n => n.endsWith('.gguf') || n.endsWith('.safetensors'))
        .filter(n => !isCompanion(n))
        .filter(n =>
          /(sd|sdxl|flux|stable|turbo|pixart|z[_-]?image)/i.test(n),
        );
      setSdModels(models);
      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0]);
      }
    } catch (e) {
      console.warn('[ImageGenScreen] scan failed:', e);
    } finally {
      setScanning(false);
    }
  }, [selectedModel]);

  React.useEffect(() => {
    imageGenStore.init();
    scanModels();
  }, [scanModels]);

  // M6 豆包化：聊天路由带入的提示词预填
  React.useEffect(() => {
    if (imageGenStore.pendingPrompt) {
      setPrompt(imageGenStore.pendingPrompt);
      imageGenStore.pendingPrompt = null;
    }
  }, []);

  // 选中模型变化时同步该族推荐默认参数
  React.useEffect(() => {
    if (!selectedModel) {
      return;
    }
    const d = FAMILY_DEFAULTS[familyOf(selectedModel)];
    setSteps(d.steps);
    setCfg(d.cfg);
  }, [selectedModel]);

  // 解析拆分式模型的伴侣文件（同目录约定命名）；返回 extras + 缺失清单
  const resolveExtras = async (
    model: string,
  ): Promise<{
    extras: {clipL?: string; clipG?: string; llm?: string; vae?: string};
    missing: string[];
  }> => {
    const family = familyOf(model);
    if (family === 'classic') {
      return {extras: {}, missing: []};
    }
    const names = (await RNFS.readDir(SD_MODELS_DIR)).map(f => f.name);
    const pick = (re: RegExp) => {
      const hit = names.find(n => re.test(n));
      return hit ? `${SD_MODELS_DIR}/${hit}` : undefined;
    };
    if (family === 'zimage') {
      const llm = pick(/qwen.*4b|llm/i);
      const vae = pick(/^ae\.|vae/i);
      return {
        extras: {llm, vae},
        missing: [
          ...(!llm ? ['Qwen3-4B 文本编码器 (llm)'] : []),
          ...(!vae ? ['VAE (ae.safetensors)'] : []),
        ],
      };
    }
    // sd3 族
    const clipL = pick(/clip[_-]?l/i);
    const clipG = pick(/clip[_-]?g/i);
    const vae = pick(/sd3.*vae|vae/i);
    return {
      extras: {clipL, clipG, vae},
      missing: [
        ...(!clipL ? ['clip_l 文本编码器'] : []),
        ...(!clipG ? ['clip_g 文本编码器'] : []),
        ...(!vae ? ['VAE'] : []),
      ],
    };
  };

  const handleLoad = async () => {
    if (!selectedModel) {
      return;
    }
    const {extras, missing} = await resolveExtras(selectedModel);
    if (missing.length > 0) {
      imageGenStore.error = `缺少伴侣文件：${missing.join('、')}`;
      return;
    }
    await imageGenStore.loadModel(`${SD_MODELS_DIR}/${selectedModel}`, extras);
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

  const s = createStyles(theme);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* 模型状态卡 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>生图模型</Text>
        {scanning ? (
          <ActivityIndicator size="small" />
        ) : sdModels.length === 0 ? (
          <Text style={s.hint}>
            未找到生图模型，请将 SDXL Turbo / SD3.5 / Z-Image-Turbo 套件（GGUF）放入{' '}
            {SD_MODELS_DIR}
          </Text>
        ) : (
          <FlatList
            data={sdModels}
            keyExtractor={item => item}
            scrollEnabled={false}
            renderItem={({item}) => (
              <TouchableOpacity
                style={[
                  s.modelRow,
                  selectedModel === item && s.modelRowSelected,
                ]}
                onPress={() => setSelectedModel(item)}>
                <Text style={s.modelName} numberOfLines={1}>
                  {FAMILY_LABEL[familyOf(item)]
                    ? `[${FAMILY_LABEL[familyOf(item)]}] `
                    : ''}
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
        <TouchableOpacity
          style={[s.button, imageGenStore.modelLoaded && s.buttonSecondary]}
          disabled={!selectedModel || imageGenStore.generating}
          onPress={imageGenStore.modelLoaded ? imageGenStore.unloadModel : handleLoad}>
          <Text style={s.buttonText}>
            {imageGenStore.modelLoaded ? '卸载模型' : '加载模型'}
          </Text>
        </TouchableOpacity>
        {imageGenStore.error && <Text style={s.error}>{imageGenStore.error}</Text>}
      </View>

      {/* 提示词输入 */}
      <View style={s.card}>
        <Text style={s.cardTitle}>生成图片</Text>
        <TextInput
          style={s.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="描述你想生成的画面…"
          placeholderTextColor="#999"
          multiline
        />
        <TextInput
          style={[s.input, s.inputSmall]}
          value={negativePrompt}
          onChangeText={setNegativePrompt}
          placeholder="负面提示词（可选，如 blurry, low quality）"
          placeholderTextColor="#999"
          multiline
        />
        {/* 尺寸选择 */}
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
          <TouchableOpacity
            style={[s.button, s.buttonPrimary]}
            disabled={!imageGenStore.modelLoaded || imageGenStore.generating}
            onPress={handleGenerate}>
            {imageGenStore.generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.buttonText}>出图</Text>
            )}
          </TouchableOpacity>
        </View>
        {/* 生成进度 */}
        {imageGenStore.generating && (
          <View style={s.progressWrap}>
            <View style={[s.progressBar, {width: `${Math.max(imageGenStore.progress, 2)}%`}]} />
            <Text style={s.progressText}>
              {imageGenStore.progressText
                ? `采样 ${imageGenStore.progressText}`
                : '加载权重/准备中…'}
            </Text>
          </View>
        )}
      </View>

      {/* 结果预览 */}
      {currentImage ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>结果</Text>
          <Image source={{uri: currentImage}} style={s.preview} resizeMode="contain" />
        </View>
      ) : null}

      {/* 历史 */}
      {imageGenStore.history.length > 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>历史 ({imageGenStore.history.length})</Text>
          <FlatList
            data={imageGenStore.history}
            keyExtractor={item => item.uri}
            scrollEnabled={false}
            numColumns={2}
            renderItem={({item}) => (
              <TouchableOpacity
                style={s.historyItem}
                onPress={() => setCurrentImage(item.uri)}>
                <Image source={{uri: item.uri}} style={s.historyThumb} />
                <Text style={s.historyPrompt} numberOfLines={2}>
                  {item.prompt}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}
    </ScrollView>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.background},
    content: {padding: 16, gap: 16},
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 10,
    },
    cardTitle: {fontSize: 15, fontWeight: '600', color: theme.colors.onSurface},
    hint: {fontSize: 12, color: theme.colors.onSurfaceVariant},
    modelRow: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    modelRowSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    modelName: {fontSize: 13, color: theme.colors.onSurface},
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    buttonSecondary: {backgroundColor: theme.colors.surfaceVariant},
    buttonPrimary: {flex: 1},
    buttonText: {color: '#fff', fontSize: 14, fontWeight: '600'},
    error: {fontSize: 12, color: theme.colors.error},
    input: {
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: 8,
      padding: 12,
      minHeight: 80,
      color: theme.colors.onSurface,
      textAlignVertical: 'top',
    },
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
    inputSmall: {minHeight: 44, padding: 8},
    sizeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    sizeBtnSelected: {borderWidth: 1, borderColor: theme.colors.primary},
    sizeBtnText: {fontSize: 12, color: theme.colors.onSurface},
    progressWrap: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: 'hidden',
      marginTop: 6,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    progressText: {fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 4},
    preview: {width: '100%', aspectRatio: 1, borderRadius: 8},
    historyItem: {flex: 1, margin: 4},
    historyThumb: {width: '100%', aspectRatio: 1, borderRadius: 8},
    historyPrompt: {fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 4},
  });
