import React, {useState} from 'react';
import {
  View,
  Platform,
  Linking,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';

import {Text, Card, SegmentedButtons} from 'react-native-paper';

import {Switch} from '../../../components/ui/Switch';

import {LinkExternalIcon} from '../../../assets/icons';

import {TextInput, Divider, InputSlider} from '../../../components';

import {t} from '../../../locales';
import {L10nContext} from '../../../utils';
import {Theme} from '../../../utils/types';
import {CacheType} from '../../../utils/types';
import {DeviceOption} from '../../../utils/deviceSelection';
import {FlashAttnType} from '../../../utils/flashAttnCompatibility';

import {createStyles} from '../styles';
import {
  AdvancedSettingsAccordion,
  CacheTypeOption,
} from './AdvancedSettingsAccordion';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;
type ContextPolicyValue = 'expand' | 'compact' | 'ask';

// OpenCL documentation URL (not localized)
const OPENCL_DOCS_URL =
  'https://github.com/ggml-org/llama.cpp/blob/master/docs/backend/OPENCL.md#model-preparation';

export interface ModelInitCardProps {
  l10n: L10n;
  theme: Theme;
  styles: SettingsStyles;
  deviceOptions: DeviceOption[];
  gpuSupported: boolean;
  currentDeviceId: string;
  onDeviceSelect: (option: DeviceOption) => void;
  nGpuLayers: number;
  onNGPULayersChange: (value: number) => void;
  minContextSize: number;
  contextSize: string;
  isValidInput: boolean;
  contextSizeRef: React.RefObject<RNTextInput | null>;
  onContextSizeChange: (text: string) => void;
  hasActiveModel: boolean;
  activeModelName: string;
  contextPolicy: ContextPolicyValue;
  onContextPolicyChange: (value: ContextPolicyValue) => void;
  autoCompaction: boolean;
  onAutoCompactionChange: (value: boolean) => void;
  /** 外点令牌：Screen 每次外点递增，菜单/折叠按需关闭（原 Screen 直控菜单等价） */
  closeToken: number;
  maxThreads: number;
  nCtx: number;
  nBatch: number;
  onNBatchChange: (value: number) => void;
  nUBatch: number;
  onNUBatchChange: (value: number) => void;
  nThreads: number;
  onNThreadsChange: (value: number) => void;
  imageMaxTokens: number | undefined;
  onImageMaxTokensChange: (value: number) => void;
  flashAttnType: FlashAttnType;
  onFlashAttnChange: (value: FlashAttnType) => void;
  cacheTypesEnabled: boolean;
  cacheTypeK: string;
  cacheTypeKOptions: CacheTypeOption[];
  onKeyCacheSelect: (value: CacheType) => void;
  cacheTypeV: string;
  cacheTypeVOptions: CacheTypeOption[];
  onValueCacheSelect: (value: CacheType) => void;
}

/**
 * ModelInitCard — ①模型初始化卡（设备选择 + Context Size + B19 策略 + 高级设置折叠）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出（testID 一字不改），零行为变化。
 */
export const ModelInitCard: React.FC<ModelInitCardProps> = ({
  l10n,
  theme,
  styles,
  deviceOptions,
  gpuSupported,
  currentDeviceId,
  onDeviceSelect,
  nGpuLayers,
  onNGPULayersChange,
  minContextSize,
  contextSize,
  isValidInput,
  contextSizeRef,
  onContextSizeChange,
  hasActiveModel,
  activeModelName,
  contextPolicy,
  onContextPolicyChange,
  autoCompaction,
  onAutoCompactionChange,
  closeToken,
  maxThreads,
  nCtx,
  nBatch,
  onNBatchChange,
  nUBatch,
  onNUBatchChange,
  nThreads,
  onNThreadsChange,
  imageMaxTokens,
  onImageMaxTokensChange,
  flashAttnType,
  onFlashAttnChange,
  cacheTypesEnabled,
  cacheTypeK,
  cacheTypeKOptions,
  onKeyCacheSelect,
  cacheTypeV,
  cacheTypeVOptions,
  onValueCacheSelect,
}) => {
  // 高级设置折叠 + 缓存菜单均为卡内 UI 状态（原 Screen 层状态，行为等价）
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  return (
    <Card elevation={0} style={styles.card}>
      <Card.Title title={l10n.settings.modelInitializationSettings} />
      <Card.Content>
        {/* Device Selection */}
        <View style={styles.settingItemContainer}>
          {/* Show full UI when multiple device options available */}
          {deviceOptions.length > 1 ? (
            <>
              <Text variant="titleMedium" style={styles.textLabel}>
                {Platform.OS === 'ios'
                  ? l10n.settings.deviceSelectionIOS
                  : l10n.settings.deviceSelection}
              </Text>
              <Text variant="labelSmall" style={styles.textDescription}>
                {Platform.OS === 'ios'
                  ? l10n.settings.deviceSelectionIOSDescription
                  : l10n.settings.deviceSelectionAndroidDescription}
              </Text>
              <SegmentedButtons
                value={currentDeviceId}
                onValueChange={deviceId => {
                  const option = deviceOptions.find(
                    optionItem => optionItem.id === deviceId,
                  );
                  if (option) {
                    onDeviceSelect(option);
                  }
                }}
                density="medium"
                buttons={deviceOptions.map(option => ({
                  value: option.id,
                  label: option.label,
                  labelStyle: {
                    ...theme.typography.captionS,
                  },
                  testID: `device-option-${option.id}`,
                }))}
                style={styles.segmentedButtons}
              />

              {/* GPU Layers Slider */}
              <InputSlider
                testID="gpu-layers-slider"
                value={nGpuLayers}
                onValueChange={onNGPULayersChange}
                min={0}
                max={99}
                step={1}
              />
              <Text variant="labelSmall" style={styles.textDescription}>
                {t(l10n.settings.layersOnGPU, {
                  gpuLayers: nGpuLayers.toString(),
                })}
              </Text>
            </>
          ) : (
            /* Simplified UI when only CPU available */
            <>
              <Text variant="titleMedium" style={styles.textLabel}>
                {l10n.settings.deviceSelection}
              </Text>
              <Text variant="labelSmall" style={styles.textDescription}>
                {l10n.settings.cpuOnlyNoAccelerators}
              </Text>
            </>
          )}

          {/* OpenCL quantization note for Android */}
          {Platform.OS === 'android' &&
            gpuSupported &&
            (nGpuLayers ?? 0) > 0 && (
              <View>
                <Text variant="labelSmall" style={styles.textDescription}>
                  {l10n.settings.openCLQuantizationNote}
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL(OPENCL_DOCS_URL)}
                  style={styles.linkContainer}>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.textDescription,
                      {color: theme.colors.primary},
                    ]}>
                    {l10n.settings.openCLDocsLink}
                  </Text>
                  <LinkExternalIcon
                    width={12}
                    height={12}
                    stroke={theme.colors.primary}
                    style={styles.linkIcon}
                  />
                </TouchableOpacity>
              </View>
            )}
        </View>
        <Divider />

        {/* Context Size（每模型独立：标签带当前活动模型名） */}
        <View style={styles.settingItemContainer}>
          <Text variant="titleMedium" style={styles.textLabel}>
            {l10n.settings.contextSize}
            {hasActiveModel ? ` · ${activeModelName}` : ''}
          </Text>
          <TextInput
            ref={contextSizeRef}
            testID="context-size-input"
            style={[styles.textInput, !isValidInput && styles.invalidInput]}
            keyboardType="numeric"
            value={contextSize}
            onChangeText={onContextSizeChange}
            placeholder={t(l10n.settings.contextSizePlaceholder, {
              minContextSize: minContextSize.toString(),
            })}
          />
          {!isValidInput && (
            <Text style={styles.errorText}>
              {t(l10n.settings.invalidContextSizeError, {
                minContextSize: minContextSize.toString(),
              })}
            </Text>
          )}
          <Text variant="labelSmall" style={styles.textDescription}>
            {l10n.settings.modelReloadNotice}
          </Text>
        </View>

        {/* B19 上下文治理策略：发送前预算超阈值时，扩窗优先/压缩兜底/每次询问。
        选择 per-model 持久化（banner CTA 与发送前自动路径共用）。 */}
        {hasActiveModel ? (
          <>
            <Divider />
            <View style={styles.settingItemContainer}>
              <Text variant="titleMedium" style={styles.textLabel}>
                {l10n.settings.contextPolicy}
              </Text>
              <Text variant="labelSmall" style={styles.textDescription}>
                {l10n.settings.contextPolicyDescription}
              </Text>
              <SegmentedButtons
                value={contextPolicy}
                onValueChange={value =>
                  onContextPolicyChange(value as ContextPolicyValue)
                }
                density="medium"
                buttons={[
                  {
                    value: 'expand',
                    label: l10n.settings.contextPolicyExpand,
                  },
                  {
                    value: 'compact',
                    label: l10n.settings.contextPolicyCompact,
                  },
                  {
                    value: 'ask',
                    label: l10n.settings.contextPolicyAsk,
                  },
                ]}
                style={styles.segmentedButtons}
              />
              <View style={styles.switchContainer}>
                <View style={styles.textContainer}>
                  <Text variant="titleMedium" style={styles.textLabel}>
                    {l10n.settings.contextAutoCompaction}
                  </Text>
                  <Text variant="labelSmall" style={styles.textDescription}>
                    {l10n.settings.contextAutoCompactionDescription}
                  </Text>
                </View>
                <Switch
                  testID="auto-compaction-switch"
                  accessibilityLabel={l10n.settings.contextAutoCompaction}
                  value={autoCompaction}
                  onValueChange={onAutoCompactionChange}
                />
              </View>
            </View>
          </>
        ) : null}

        {/* Advanced Settings */}
        <AdvancedSettingsAccordion
          l10n={l10n}
          styles={styles}
          expanded={showAdvancedSettings}
          onToggle={() => setShowAdvancedSettings(!showAdvancedSettings)}
          maxThreads={maxThreads}
          nCtx={nCtx}
          nBatch={nBatch}
          onNBatchChange={onNBatchChange}
          nUBatch={nUBatch}
          onNUBatchChange={onNUBatchChange}
          nThreads={nThreads}
          onNThreadsChange={onNThreadsChange}
          imageMaxTokens={imageMaxTokens}
          onImageMaxTokensChange={onImageMaxTokensChange}
          flashAttnType={flashAttnType}
          onFlashAttnChange={onFlashAttnChange}
          currentDeviceId={currentDeviceId}
          deviceOptions={deviceOptions}
          cacheTypesEnabled={cacheTypesEnabled}
          closeToken={closeToken}
          cacheTypeK={cacheTypeK}
          cacheTypeKOptions={cacheTypeKOptions}
          onKeyCacheSelect={onKeyCacheSelect}
          cacheTypeV={cacheTypeV}
          cacheTypeVOptions={cacheTypeVOptions}
          onValueCacheSelect={onValueCacheSelect}
        />
      </Card.Content>
    </Card>
  );
};
