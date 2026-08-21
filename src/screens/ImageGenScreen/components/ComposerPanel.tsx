import * as React from 'react';
import {
  ActivityIndicator,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {estimateTokens, RATIOS, SD_RATIOS} from '../constants';

interface ComposerPanelProps {
  prompt: string;
  negativePrompt: string;
  steps: string;
  cfg: string;
  size: number;
  ratio: string;
  /** 6.18 种子：空=随机，填数可复现/调试 */
  seed: string;
  /** 选中的是 DreamLite 族（编辑槽/画幅档位模式） */
  isDream: boolean;
  /** 编辑预备态：已点「编辑」锁定当前预览图，正在输入编辑指令 */
  editArming: boolean;
  /** 编辑源图已预解码（执行编辑按钮可用条件） */
  editRgb: Float32Array | null;
  /** 预览区有可编辑图（0 页编辑槽有图或历史页有图）——非 Dream 下编辑按钮显示条件 */
  hasEditableImage: boolean;
  showAdvanced: boolean;
  generating: boolean;
  taskKind: 'gen' | 'edit' | 'caption' | null;
  /** 非 DreamLite 出图按钮的加载前置条件 */
  loaded: boolean;
  /** DreamLite 画幅宽（由 ratio 派生） */
  dreamW: number;
  dreamH: number;
  /** 08-18 修复：当前模型提示词 token 上限（编码器硬限，超出将被截断） */
  tokenLimit: number;
  /** 08-18 路线 B：当前模型是否声明了独立 LoRA（manifest.lora 非空） */
  hasLora: boolean;
  loraEnabled: boolean;
  loraMultiplier: string;
  onLoraEnabledChange: (v: boolean) => void;
  onLoraMultiplierChange: (t: string) => void;
  onPromptChange: (t: string) => void;
  onNegativePromptChange: (t: string) => void;
  onStepsChange: (t: string) => void;
  onCfgChange: (t: string) => void;
  onSeedChange: (t: string) => void;
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
  seed,
  isDream,
  editArming,
  editRgb,
  hasEditableImage,
  showAdvanced,
  generating,
  taskKind,
  loaded,
  dreamW,
  dreamH,
  tokenLimit,
  hasLora,
  loraEnabled,
  loraMultiplier,
  onLoraEnabledChange,
  onLoraMultiplierChange,
  onPromptChange,
  onNegativePromptChange,
  onStepsChange,
  onCfgChange,
  onSeedChange,
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
        style={
          estimateTokens(prompt) > tokenLimit ? s.promptHintWarn : s.promptHint
        }>
        ~{estimateTokens(prompt)}/{tokenLimit} tokens
        {estimateTokens(prompt) > tokenLimit
          ? ' · 超出编码上限，出图将被截断'
          : ' · 端侧建议≤上限，过长拖慢速度'}
      </Text>
      <TouchableOpacity onPress={onToggleAdvanced}>
        <Text style={s.advToggle}>
          高级参数（
          {isDream && editArming
            ? '步数'
            : isDream
              ? '尺寸/步数'
              : '负面/比例/步数/CFG/种子'}
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
              <Text style={s.paramLabel}>比例</Text>
              {(isDream ? RATIOS : SD_RATIOS) &&
                Object.keys(isDream ? RATIOS : SD_RATIOS).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.sizeBtn, ratio === r && s.sizeBtnSelected]}
                    onPress={() => onRatioChange(r)}>
                    <Text style={s.sizeBtnText}>{r}</Text>
                    <Text style={s.sizeBtnSub}>
                      {(isDream ? RATIOS : SD_RATIOS)[r][0]}×
                      {(isDream ? RATIOS : SD_RATIOS)[r][1]}
                    </Text>
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
                <Text style={s.paramLabel}>种子</Text>
                <TextInput
                  style={s.paramInput}
                  value={seed}
                  onChangeText={onSeedChange}
                  keyboardType="numeric"
                  placeholder="随机"
                  placeholderTextColor="#999"
                />
              </>
            )}
          </View>
          {!isDream && hasLora && (
            <View style={s.paramRow}>
              <Text style={s.paramLabel}>LoRA</Text>
              <Switch
                value={loraEnabled}
                onValueChange={onLoraEnabledChange}
                disabled={generating}
              />
              <Text style={s.paramLabel}>强度</Text>
              <TextInput
                style={s.paramInput}
                value={loraMultiplier}
                onChangeText={onLoraMultiplierChange}
                keyboardType="numeric"
                editable={loraEnabled && !generating}
              />
            </View>
          )}
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
            {/* onPress 必须显式无参调用（不可直传 onGenerate）：RN 会把 GestureResponderEvent
                作为首参传入，若直传 handleGenerate(event)，可选参 promptOverride 会收到 event，
                入口 (promptOverride ?? prompt).trim() 即抛 TypeError 被事件系统吞掉——
                现象为「有按压缩放动效但出图无反应」（2026-08-20 两台真机 + 注入三重复现） */}
            <TouchableOpacity
              style={[s.button, s.buttonGen]}
              disabled={generating}
              testID="imagegen-generate"
              onPress={() => onGenerate()}>
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
        <View style={s.buttonRow}>
          {/* 非 Dream 编辑入口（2026-08-21）：预览区有图时常驻，点击由编排层
              确认后自动切 DreamLite（SD3.5/Z-Image 无编辑引擎）；未加载不禁用 */}
          {hasEditableImage && (
            <TouchableOpacity
              style={[s.button, s.buttonEdit]}
              disabled={generating}
              onPress={onEditArm}>
              <Text style={[s.buttonText, s.buttonTextOnInfo]}>编辑</Text>
            </TouchableOpacity>
          )}
          {/* 未加载不再灰置：点击由编排层弹引导（提示+展开模型下拉），新手友好 */}
          <TouchableOpacity
            style={[s.button, s.buttonGen]}
            disabled={generating}
            testID="imagegen-generate"
            onPress={() => onGenerate()}>
            {generating ? (
              <ActivityIndicator size="small" color={theme.colors.onPrimary} />
            ) : (
              <Text style={s.buttonText}>出图</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {/* 报错唯一出口 = 预览区 failed 任务页（任务化，2026-08），
          composer 底部不再展示错误文本 */}
    </View>
  );
};
