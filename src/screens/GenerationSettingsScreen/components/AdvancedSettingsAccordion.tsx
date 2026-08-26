import React, {useEffect, useRef, useState} from 'react';
import {Platform, View} from 'react-native';

import {Text, Button, Icon, List, SegmentedButtons} from 'react-native-paper';

import {Menu, Divider, InputSlider} from '../../../components';

import {t} from '../../../locales';
import {L10nContext} from '../../../utils';
import {CacheType} from '../../../utils/types';
import {DeviceOption} from '../../../utils/deviceSelection';
import {FlashAttnType} from '../../../utils/flashAttnCompatibility';

import {createStyles} from '../styles';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;
type Point = {x: number; y: number};

// B51 纪律：paper Button icon render-callback 提模块级（禁渲染期定义组件）
const renderChevronDownIcon = ({
  size,
  color,
}: {
  size: number;
  color: string;
}) => <Icon source="chevron-down" size={size} color={color} />;

export interface CacheTypeOption {
  value: CacheType;
  label: string;
  disabled: boolean;
  reason?: string;
}

interface CacheTypeSelectProps {
  styles: SettingsStyles;
  title: string;
  description: string;
  /** flash_attn_type 原始值布尔派生：未设置或 'off' 时按钮/菜单禁用（原样保留） */
  enabled: boolean;
  label: string;
  /** 外点（Screen handleOutsidePress）递增后强制关闭菜单——与原版外点关菜单同义 */
  closeToken: number;
  onSelectCache: (value: CacheType) => void;
  selected: string;
  options: CacheTypeOption[];
}

/**
 * CacheTypeSelect — 高级设置中的缓存类型选择（K/V 结构同构 ×2）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出，零行为变化。
 */
const CacheTypeSelect: React.FC<CacheTypeSelectProps> = ({
  styles,
  title,
  description,
  enabled,
  label,
  closeToken,
  onSelectCache,
  selected,
  options,
}) => {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Point>({x: 0, y: 0});
  const buttonRef = useRef<View>(null);

  // 外点关闭（原实现：Screen handleOutsidePress 直接 setShowKeyCacheMenu(false)）
  useEffect(() => {
    setVisible(false);
  }, [closeToken]);

  const handlePress = () => {
    buttonRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setAnchor({x: pageX, y: pageY + height});
      setVisible(true);
    });
  };

  return (
    <View style={styles.settingItemContainer}>
      <View style={styles.switchContainer}>
        <View style={styles.textContainer}>
          <Text variant="titleMedium" style={styles.textLabel}>
            {title}
          </Text>
          <Text variant="labelSmall" style={styles.textDescription}>
            {description}
          </Text>
        </View>
        <View style={styles.menuContainer}>
          <Button
            ref={buttonRef}
            mode="outlined"
            onPress={handlePress}
            style={styles.menuButton}
            contentStyle={styles.buttonContent}
            disabled={!enabled}
            icon={renderChevronDownIcon}>
            {label}
          </Button>
          <Menu
            visible={visible}
            onDismiss={() => setVisible(false)}
            anchor={anchor}
            selectable>
            {options.map(option => (
              <Menu.Item
                key={option.value}
                label={option.label}
                style={styles.menu}
                selected={option.value === selected}
                disabled={option.disabled}
                onPress={() => {
                  if (!option.disabled) {
                    onSelectCache(option.value);
                    setVisible(false);
                  }
                }}
              />
            ))}
          </Menu>
        </View>
      </View>
    </View>
  );
};

export interface AdvancedSettingsAccordionProps {
  l10n: L10n;
  styles: SettingsStyles;
  expanded: boolean;
  onToggle: () => void;
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
  currentDeviceId: string;
  deviceOptions: DeviceOption[];
  cacheTypesEnabled: boolean;
  closeToken: number;
  cacheTypeK: string;
  cacheTypeKOptions: CacheTypeOption[];
  onKeyCacheSelect: (value: CacheType) => void;
  cacheTypeV: string;
  cacheTypeVOptions: CacheTypeOption[];
  onValueCacheSelect: (value: CacheType) => void;
}

/**
 * AdvancedSettingsAccordion — 模型初始化卡的高级设置折叠区
 * （Batch/UBatch/线程/图像 tokens/Flash Attention/缓存类型 K/V）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出，零行为变化。
 */
export const AdvancedSettingsAccordion: React.FC<
  AdvancedSettingsAccordionProps
> = ({
  l10n,
  styles,
  expanded,
  onToggle,
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
  currentDeviceId,
  deviceOptions,
  cacheTypesEnabled,
  closeToken,
  cacheTypeK,
  cacheTypeKOptions,
  onKeyCacheSelect,
  cacheTypeV,
  cacheTypeVOptions,
  onValueCacheSelect,
}) => {
  const getCacheTypeLabel = (
    value: CacheType | string,
    isValueCache = false,
  ) => {
    const options = isValueCache ? cacheTypeVOptions : cacheTypeKOptions;
    return options.find(option => option.value === value)?.label || value;
  };

  return (
    <List.Accordion
      title={l10n.settings.advancedSettings}
      titleStyle={styles.accordionTitle}
      style={styles.advancedAccordion}
      expanded={expanded}
      onPress={onToggle}>
      <View style={styles.advancedSettingsContent}>
        {/* Batch Size Slider */}
        <View style={styles.settingItemContainer}>
          <InputSlider
            testID="batch-size-slider"
            label={l10n.settings.batchSize}
            value={nBatch}
            onValueChange={onNBatchChange}
            min={1}
            max={4096}
            step={1}
          />
          <Text variant="labelSmall" style={styles.textDescription}>
            {t(l10n.settings.batchSizeDescription, {
              batchSize: nBatch.toString(),
              effectiveBatch:
                nBatch > nCtx
                  ? ` (${l10n.settings.effectiveLabel}: ${nCtx})`
                  : '',
            })}
          </Text>
        </View>
        <Divider />

        {/* Physical Batch Size Slider */}
        <View style={styles.settingItemContainer}>
          <InputSlider
            testID="ubatch-size-slider"
            label={l10n.settings.physicalBatchSize}
            value={nUBatch}
            onValueChange={onNUBatchChange}
            min={1}
            max={4096}
            step={1}
          />
          <Text variant="labelSmall" style={styles.textDescription}>
            {t(l10n.settings.physicalBatchSizeDescription, {
              physicalBatchSize: nUBatch.toString(),
              effectivePhysicalBatch:
                nUBatch > Math.min(nBatch, nCtx)
                  ? ` (${l10n.settings.effectiveLabel}: ${Math.min(
                      nBatch,
                      nCtx,
                    )})`
                  : '',
            })}
          </Text>
        </View>
        <Divider />

        {/* Thread Count Slider */}
        <View style={styles.settingItemContainer}>
          <InputSlider
            testID="thread-count-slider"
            label={l10n.settings.cpuThreads}
            value={nThreads}
            onValueChange={onNThreadsChange}
            min={1}
            max={maxThreads}
            step={1}
          />
          <Text variant="labelSmall" style={styles.textDescription}>
            {t(l10n.settings.cpuThreadsDescription, {
              threads: nThreads.toString(),
              maxThreads: maxThreads.toString(),
            })}
          </Text>
        </View>
        <Divider />

        {/* Image Max Tokens Slider */}
        <View style={styles.settingItemContainer}>
          <InputSlider
            testID="image-max-tokens-slider"
            label={l10n.settings.imageMaxTokens}
            value={imageMaxTokens ?? 512}
            onValueChange={onImageMaxTokensChange}
            min={256}
            max={4096}
            step={1}
          />
          <Text variant="labelSmall" style={styles.textDescription}>
            {t(l10n.settings.imageMaxTokensDescription, {
              tokens: (imageMaxTokens ?? 512).toString(),
              effectiveTokens:
                (imageMaxTokens ?? 512) > nCtx
                  ? ` (${l10n.settings.effectiveLabel}: ${nCtx})`
                  : '',
            })}
          </Text>
        </View>
        <Divider />

        {/* Flash Attention Type */}
        <View style={styles.settingItemContainer}>
          <Text variant="titleMedium" style={styles.textLabel}>
            {l10n.settings.flashAttention}
          </Text>
          <Text variant="labelSmall" style={styles.textDescription}>
            {Platform.OS === 'ios'
              ? l10n.settings.flashAttentionIOSDescription
              : l10n.settings.flashAttentionAndroidDescription}
          </Text>
          <SegmentedButtons
            value={flashAttnType}
            onValueChange={onFlashAttnChange}
            density="high"
            buttons={(() => {
              const currentDevice = deviceOptions.find(
                option => option.id === currentDeviceId,
              );
              const validTypes = currentDevice?.valid_flash_attn_types || [
                'auto',
                'on',
                'off',
              ];

              return [
                {
                  value: 'auto',
                  label: l10n.settings.flashAttentionAuto,
                  disabled: !validTypes.includes('auto'),
                },
                {
                  value: 'on',
                  label: l10n.settings.flashAttentionOn,
                  disabled: !validTypes.includes('on'),
                },
                {
                  value: 'off',
                  label: l10n.settings.flashAttentionOff,
                  disabled: !validTypes.includes('off'),
                },
              ];
            })()}
            style={styles.segmentedButtons}
          />
        </View>
        <Divider />

        {/* Cache Type K Selection */}
        <CacheTypeSelect
          styles={styles}
          title={l10n.settings.keyCacheType}
          description={
            cacheTypesEnabled
              ? l10n.settings.keyCacheTypeDescription
              : l10n.settings.keyCacheTypeDisabledDescription
          }
          enabled={cacheTypesEnabled}
          label={getCacheTypeLabel(cacheTypeK, false)}
          closeToken={closeToken}
          onSelectCache={onKeyCacheSelect}
          selected={cacheTypeK}
          options={cacheTypeKOptions}
        />
        <Divider />

        {/* Cache Type V Selection */}
        <CacheTypeSelect
          styles={styles}
          title={l10n.settings.valueCacheType}
          description={
            cacheTypesEnabled
              ? l10n.settings.valueCacheTypeDescription
              : l10n.settings.valueCacheTypeDisabledDescription
          }
          enabled={cacheTypesEnabled}
          label={getCacheTypeLabel(cacheTypeV, true)}
          closeToken={closeToken}
          onSelectCache={onValueCacheSelect}
          selected={cacheTypeV}
          options={cacheTypeVOptions}
        />
      </View>
    </List.Accordion>
  );
};
