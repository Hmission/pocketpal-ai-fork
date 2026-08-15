import * as React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  TextInput,
  ActivityIndicator,
} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {PROMPT_LIMIT, RATIOS, SIZES} from '../constants';

interface ComposerPanelProps {
  prompt: string;
  negativePrompt: string;
  steps: string;
  cfg: string;
  size: number;
  ratio: string;
  /** 选中的是 DreamLite 族（编辑槽/画幅档位模式） */
  isDream: boolean;
  /** 编辑预备态：已点「编辑」锁定当前预览图，正在输入编辑指令 */
  editArming: boolean;
  /** 编辑源图已预解码（执行编辑按钮可用条件） */
  editRgb: Float32Array | null;
  showAdvanced: boolean;
  generating: boolean;
  taskKind: 'gen' | 'edit' | null;
  /** 非 DreamLite 出图按钮的加载前置条件 */
  loaded: boolean;
  /** DreamLite 画幅宽（由 ratio 派生） */
  dreamW: number;
  dreamH: number;
  error: string | null;
  onPromptChange: (t: string) => void;
  onNegativePromptChange: (t: string) => void;
  onStepsChange: (t: string) => void;
  onCfgChange: (t: string) => void;
  onSizeChange: (sz: number) => void;
  onRatioChange: (r: string) => void;
  onToggleAdvanced: () => void;
  onEditArm: () => void;
  onGenerate: () => void;
}

/**
 * ComposerPanel — ③创作区（底部 composer）：提示词 + 折叠高级参数 + 出图/编辑按钮。
 * 提示词限长（端侧≤120 字）与高级参数按族分流（DreamLite=画幅档位，通用 SD=尺寸/负面/CFG）。
 * 只读 props 渲染，所有 setter 由编排层注入。
 */
export const ComposerPanel: React.FC<ComposerPanelProps> = ({
  prompt,
  negativePrompt,
  steps,
  cfg,
  size,
  ratio,
  isDream,
  editArming,
  editRgb,
  showAdvanced,
  generating,
  taskKind,
  loaded,
  dreamW,
  dreamH,
  error,
  onPromptChange,
  onNegativePromptChange,
  onStepsChange,
  onCfgChange,
  onSizeChange,
  onRatioChange,
  onToggleAdvanced,
  onEditArm,
  onGenerate,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  return (
    <View style={s.card}>
      <TextInput
        style={s.input}
        value={prompt}
        onChangeText={onPromptChange}
        placeholder={
          isDream && editArming
            ? '输入图像编辑指令，如：把天空换成日落、人物换上红色外套…'
            : '描述你想生成的画面…'
        }
        placeholderTextColor="#999"
        multiline
      />
      <Text
        style={prompt.length > PROMPT_LIMIT ? s.promptHintWarn : s.promptHint}>
        {prompt.length}/{PROMPT_LIMIT} · 端侧建议≤{PROMPT_LIMIT}字，过长拖慢速度
      </Text>
      <TouchableOpacity onPress={onToggleAdvanced}>
        <Text style={s.advToggle}>
          高级参数（
          {isDream && editArming
            ? '步数'
            : isDream
              ? '尺寸/步数'
              : '负面/尺寸/步数/CFG'}
          ）{showAdvanced ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>
      {showAdvanced && (
        <>
          {!isDream && (
            <TextInput
              style={[s.input, s.inputSmall]}
              value={negativePrompt}
              onChangeText={onNegativePromptChange}
              placeholder="负面提示词（可选，如 blurry, low quality）"
              placeholderTextColor="#999"
              multiline
            />
          )}
          {isDream ? (
            editArming ? (
              <Text style={s.promptHint}>
                编辑输出 {Math.min(dreamW, dreamH)}×{Math.min(dreamW, dreamH)}{' '}
                正方形（按较大边压缩）
              </Text>
            ) : (
              <View style={s.paramRow}>
                <Text style={s.paramLabel}>画幅</Text>
                {Object.keys(RATIOS).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.sizeBtn, ratio === r && s.sizeBtnSelected]}
                    onPress={() => onRatioChange(r)}>
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
                  onPress={() => onSizeChange(sz)}>
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
              onChangeText={onStepsChange}
              keyboardType="numeric"
            />
            {!isDream && (
              <>
                <Text style={s.paramLabel}>CFG</Text>
                <TextInput
                  style={s.paramInput}
                  value={cfg}
                  onChangeText={onCfgChange}
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
              已锁定当前预览图（{Math.min(dreamW, dreamH)}×
              {Math.min(dreamW, dreamH)}），编辑指令见上方输入框
            </Text>
          )}
          <View style={s.buttonRow}>
            <TouchableOpacity
              style={[
                s.button,
                s.buttonEdit,
                editArming && !editRgb && s.buttonDisabled,
              ]}
              disabled={generating || (editArming && !editRgb)}
              onPress={onEditArm}>
              {generating && taskKind === 'edit' ? (
                <ActivityIndicator size="small" color={theme.colors.onInfo} />
              ) : (
                <Text style={[s.buttonText, s.buttonTextOnInfo]}>
                  {editArming ? '执行编辑' : '编辑'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.button, s.buttonGen]}
              disabled={generating}
              onPress={onGenerate}>
              {generating && taskKind === 'gen' ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.onPrimary}
                />
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
          disabled={generating || !loaded}
          onPress={onGenerate}>
          {generating ? (
            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
          ) : (
            <Text style={s.buttonText}>出图</Text>
          )}
        </TouchableOpacity>
      )}
      {error && <Text style={s.error}>{error}</Text>}
    </View>
  );
};
