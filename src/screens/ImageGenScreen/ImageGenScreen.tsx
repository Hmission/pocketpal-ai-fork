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
      // SD 模型识别：GGUF/safetensors 均支持，文件名含生图关键词（排除聊天 LLM）
      const models = files
        .filter(f => f.name.endsWith('.gguf') || f.name.endsWith('.safetensors'))
        .filter(f => /(sd|sdxl|flux|stable|turbo|pixart)/i.test(f.name))
        .map(f => f.name);
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

  const handleLoad = async () => {
    if (!selectedModel) {
      return;
    }
    await imageGenStore.loadModel(`${SD_MODELS_DIR}/${selectedModel}`);
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
            未找到 SD 模型，请将 SDXL Turbo GGUF 放入 {SD_MODELS_DIR}
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
