import * as React from 'react';
import {Pressable, Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '../../../hooks';
import {XIcon} from '../../../assets/icons';
import {Progress} from '../Progress';
import {createStyles, tintFor, type BannerVariant} from './styles';

export type {BannerVariant};

export type BannerAction = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export type BannerBarProps = {
  /** 语义变体：neutral=信息带（surfaceVariant）/ 其余=语义色 12% wash */
  variant?: BannerVariant;
  /** 自绘图标（assets/icons）；缺省不渲染 */
  icon?: React.ReactNode;
  text: string;
  /** 0-100 确定进度；<0 或缺省不渲染进度条 */
  progress?: number;
  /** 百分比角标（0-100，渲染为「NN%」独立元素，testID 固定 banner-percent） */
  percent?: number;
  /** 动作槽（text 按钮，最多 2 个） */
  actions?: BannerAction[];
  /** 可选 × 关闭；dismissTestID 缺省为 `${testID}-dismiss` */
  onDismiss?: () => void;
  dismissTestID?: string;
  /** 主体点击（整条横幅可点，如 DownloadBanner → Models 页）；缺省纯展示 */
  onPress?: () => void;
  testID?: string;
  style?: React.ComponentProps<typeof View>['style'];
};

/**
 * DS BannerBar — 横幅唯一底座（DESIGN_SPEC §12.3）。
 *
 * 契约：语义色 12% wash 底 + hairline 边框 + captionM 文本 + 统一 Meter(4px)
 * + 动作槽（text 按钮）+ 自绘图标。新增横幅一律走本组件，禁手写第二套。
 */
export const BannerBar: React.FC<BannerBarProps> = ({
  variant = 'neutral',
  icon,
  text,
  progress,
  percent,
  actions,
  onDismiss,
  dismissTestID,
  onPress,
  testID = 'ui-banner',
  style,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const tint = tintFor(theme, variant);
  const ratio =
    typeof progress === 'number' && progress >= 0
      ? Math.max(0, Math.min(100, progress)) / 100
      : null;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'alert'}
      accessibilityLiveRegion={onPress ? undefined : 'polite'}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.root, tint, style]}>
      <View style={styles.row}>
        {icon}
        <Text style={styles.text} numberOfLines={2}>
          {text}
        </Text>
        {typeof percent === 'number' ? (
          <Text
            testID="banner-percent"
            style={[styles.percent, {color: tint.fill}]}>
            {`${Math.round(percent)}%`}
          </Text>
        ) : null}
        {onDismiss ? (
          <TouchableOpacity
            testID={dismissTestID ?? `${testID}-dismiss`}
            onPress={onDismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="dismiss">
            <XIcon
              width={14}
              height={14}
              stroke={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {ratio !== null ? (
        // B57：内部 Meter 归一 ui/Progress（height=4 契约；trackColor 保持
        // surfaceDisabled；style 补 alignSelf:stretch 维持 BannerRow 契约断言）
        <Progress
          testID="banner-meter"
          height={4}
          color={tint.fill}
          value={progress}
          trackColor={theme.colors.surfaceDisabled}
          style={styles.meter}
        />
      ) : null}
      {actions && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map(a => (
            <TouchableOpacity
              key={a.label}
              testID={a.testID}
              onPress={a.onPress}
              hitSlop={6}
              style={styles.action}
              accessibilityRole="button">
              <Text style={styles.actionText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
};
