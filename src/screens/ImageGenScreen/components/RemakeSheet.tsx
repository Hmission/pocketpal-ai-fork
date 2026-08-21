import * as React from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';

import {Sheet} from '../../../components/Sheet';
import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {FAMILY_BADGE, ModelEntry, RATIOS, SD_RATIOS} from '../constants';

interface RemakeSheetProps {
  visible: boolean;
  /** 反推提示词（复刻目标） */
  captionText: string;
  /** 生图模型候选（available 列表，与模型下拉同源） */
  available: ModelEntry[];
  /** 当前选中模型 id（Sheet 默认值） */
  selectedId: string | null;
  /** 当前参数（Sheet 默认值，用户可改） */
  defaults: {
    steps: string;
    cfg: string;
    negativePrompt: string;
    seed: string;
    ratio: string;
    size: number;
  };
  onClose: () => void;
  onConfirm: (params: {
    modelId: string;
    steps: string;
    cfg: string;
    negativePrompt: string;
    seed: string;
    ratio: string;
  }) => void;
}

/**
 * RemakeSheet — 复刻生图参数面板（v4，IMAGEGEN_UI_SPEC §7.3）。
 * 反推结果 → 全参数可控：生图模型单选（族徽章）+ 画幅档位（DreamLite/SD 分流）
 * + 步数/CFG/负面词/seed（默认取 composer 当前值，遵循「需要动的才暴露」）。
 * 确认 → 切生图 tab → 回填参数 → 直接触发出图。
 *
 * 载体：components/Sheet（DESIGN_SPEC §12.2 底部弹层唯一载体）；
 * 必须显式 snapPoints（Android 真机动态尺寸测量失败实证）。
 */
export const RemakeSheet: React.FC<RemakeSheetProps> = ({
  visible,
  captionText,
  available,
  selectedId,
  defaults,
  onClose,
  onConfirm,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  const [modelId, setModelId] = React.useState<string>(
    selectedId ?? 'dreamlite',
  );
  const [ratio, setRatio] = React.useState(defaults.ratio);
  const [steps, setSteps] = React.useState(defaults.steps);
  const [cfg, setCfg] = React.useState(defaults.cfg);
  const [negativePrompt, setNegativePrompt] = React.useState(
    defaults.negativePrompt,
  );
  const [seed, setSeed] = React.useState(defaults.seed);

  const isDream =
    available.find(a => a.manifest.id === modelId)?.manifest.family ===
    'dreamlite';
  const ratios = isDream ? RATIOS : SD_RATIOS;

  // 每次打开重置为 composer 当前值（用户从当前状态出发微调）
  React.useEffect(() => {
    if (visible) {
      setModelId(selectedId ?? 'dreamlite');
      setRatio(defaults.ratio);
      setSteps(defaults.steps);
      setCfg(defaults.cfg);
      setNegativePrompt(defaults.negativePrompt);
      setSeed(defaults.seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Sheet
      isVisible={visible}
      onClose={onClose}
      title="复刻生图"
      snapPoints={['75%']}>
      {/* 内容 gate：visible=false 时零渲染（防与 composer 文本双匹配） */}
      {visible && (
        <View style={s.remakeBody}>
        <Text style={s.promptHint} numberOfLines={3}>
          目标提示词：{captionText}
        </Text>

        <Text style={s.promptHint}>生图模型</Text>
        <View style={s.paramRowWrap}>
          {available.map(a => {
            const selected = a.manifest.id === modelId;
            return (
              <TouchableOpacity
                key={a.manifest.id}
                style={[s.remakeChip, selected && s.remakeChipSelected]}
                onPress={() => setModelId(a.manifest.id)}>
                <Text
                  style={[
                    s.remakeChipText,
                    selected && s.remakeChipTextSelected,
                  ]}>
                  {FAMILY_BADGE[a.manifest.family] ?? a.manifest.family} ·{' '}
                  {a.manifest.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.promptHint}>画幅（{isDream ? 'DreamLite 档位' : 'SD 比例'}）</Text>
        <View style={s.paramRowWrap}>
          {Object.keys(ratios).map(k => (
            <TouchableOpacity
              key={k}
              style={[s.sizeBtn, ratio === k && s.sizeBtnSelected]}
              onPress={() => setRatio(k)}>
              <Text style={s.sizeBtnText}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.paramRow}>
          <Text style={s.promptHint}>步数</Text>
          <TextInput
            style={s.remakeInput}
            value={steps}
            onChangeText={setSteps}
            keyboardType="number-pad"
          />
          <Text style={s.promptHint}>CFG</Text>
          <TextInput
            style={s.remakeInput}
            value={cfg}
            onChangeText={setCfg}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={s.promptHint}>负面词（SD 系）</Text>
        <TextInput
          style={s.remakeInputFull}
          value={negativePrompt}
          onChangeText={setNegativePrompt}
          placeholder="（留空则沿用输入框当前值）"
        />

        <Text style={s.promptHint}>种子（留空 = 随机）</Text>
        <TextInput
          style={s.remakeInputFull}
          value={seed}
          onChangeText={setSeed}
          keyboardType="number-pad"
          placeholder="留空 = 随机"
        />

        <View style={s.buttonRow}>
          <TouchableOpacity style={[s.button, s.buttonEdit]} onPress={onClose}>
            <Text style={[s.buttonText, s.buttonTextOnInfo]}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.button, s.buttonGen]}
            onPress={() =>
              onConfirm({
                modelId,
                steps,
                cfg,
                negativePrompt,
                seed,
                ratio,
              })
            }>
            <Text style={s.buttonText}>复刻生成</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}
    </Sheet>
  );
};
