import * as React from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';

import {Switch} from '../../../components/ui/Switch';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {DREAM_EDIT_SIZE, estimateTokens, RATIOS, SD_RATIOS} from '../constants';

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
  /** 提示词卡折叠（2026-08-26 大王裁定：折叠后出图按钮一屏可见；编辑预备态由编排层强制展开） */
  promptCollapsed: boolean;
  onToggleCollapse: () => void;
  /** 引擎加载中（loading 与 generating 同属任务进行期；按钮区已移 GenActionBar 吸底条） */
  loading?: boolean;
  generating: boolean;
  taskKind: 'gen' | 'edit' | 'caption' | null;
  /** 非 DreamLite 出图按钮的加载前置条件 */
  loaded: boolean;
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
}

/**
 * ComposerPanel — ③创作区（底部 composer）：提示词 + 折叠高级参数。
 * 2026-08-26：出图/编辑按钮移出至 GenActionBar 吸底条（本卡只留输入；
 * 折叠态=单行胶囊，出图按钮一屏可见）。
 * 提示词限长（端侧≤120 字）与高级参数按族分流（DreamLite=画幅档位，通用 SD=尺寸/负面/CFG）。
 * 只读 props 渲染，所有 setter 由编排层注入。
 */
export const ComposerPanel: React.FC<ComposerPanelProps> = ({
  prompt,
  negativePrompt,
  steps,
  cfg,
  size: _size,
  ratio,
  seed,
  isDream,
  editArming,
  editRgb: _editRgb,
  hasEditableImage: _hasEditableImage,
  showAdvanced,
  promptCollapsed,
  onToggleCollapse,
  loading: _loading = false,
  generating,
  taskKind: _taskKind,
  loaded: _loaded,
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
  onSizeChange: _onSizeChange,
  onRatioChange,
  onToggleAdvanced,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const tokenCount = estimateTokens(prompt);

  return (
    <View style={s.card}>
      {/* 折叠头（2026-08-26）：单行胶囊，出图按钮一屏可见 */}
      <TouchableOpacity
        style={s.collapseHead}
        onPress={onToggleCollapse}
        activeOpacity={0.7}
        testID="composer-collapse">
        <Text style={s.collapseHeadLabel}>
          提示词 {promptCollapsed ? '▾' : '▴'}
        </Text>
        {promptCollapsed ? (
          <Text style={s.collapseHeadSummary} numberOfLines={1}>
            {prompt.trim() || '描述你想生成的画面…'}
          </Text>
        ) : null}
        <Text style={tokenCount > tokenLimit ? s.promptHintWarn : s.promptHint}>
          ~{tokenCount}/{tokenLimit}
        </Text>
      </TouchableOpacity>
      {!promptCollapsed && (
        <>
          <TextInput
            style={s.input}
            value={prompt}
            onChangeText={onPromptChange}
            placeholder={
              isDream && editArming
                ? '输入图像编辑指令，如：把天空换成日落、人物换上红色外套…'
                : '描述你想生成的画面…'
            }
            // B56②：#999 占位文字 → placeholder token（语义精确对位，§1.6 灰阶）
            placeholderTextColor={theme.colors.placeholder}
            multiline
          />
          <Text
            style={tokenCount > tokenLimit ? s.promptHintWarn : s.promptHint}>
            ~{tokenCount}/{tokenLimit} tokens
            {tokenCount > tokenLimit
              ? ' · 超出编码上限，出图将被截断'
              : ' · 端侧建议≤上限，过长拖慢速度'}
          </Text>
        </>
      )}
      {/* 高级参数折叠钮与提示词折叠**平级**【2026-08-27 大王裁定】：
          高级参数展开/折叠独立于提示词折叠（原实现被误包进 promptCollapsed 作用域） */}
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
              placeholderTextColor={theme.colors.placeholder}
              multiline
            />
          )}
          {isDream ? (
            editArming ? (
              <Text style={s.promptHint}>
                编辑输出 {DREAM_EDIT_SIZE}×{DREAM_EDIT_SIZE}{' '}
                正方形（编辑固定契约，与画幅无关）
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
                  // B56②：#999 占位文字 → placeholder token
                  placeholderTextColor={theme.colors.placeholder}
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
                accessibilityLabel="启用 LoRA"
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
      {isDream && editArming && !promptCollapsed && (
        <Text style={s.promptHint}>
          已锁定当前预览图（{DREAM_EDIT_SIZE}×{DREAM_EDIT_SIZE}
          ），编辑指令见上方输入框
        </Text>
      )}
      {/* 报错唯一出口 = 预览区 failed 任务页（任务化，2026-08），
          composer 底部不再展示错误文本 */}
    </View>
  );
};
