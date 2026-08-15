import React from 'react';
import {Text, View} from 'react-native';

import {useTheme} from '../../../hooks';
import {ChevronRightIcon} from '../../../assets/icons';

import {IconTile} from '../IconTile';
import {PressableScale} from '../PressableScale';

import {createStyles} from './styles';

export interface ListItemProps {
  testID?: string;
  /** 行标题（bodyM / onSurface，单行截断） */
  title: string;
  /** 辅助说明（captionM / onSurfaceVariant，两行截断） */
  subtitle?: string;
  /** Lucide 线条图标组件（IconTile 底/线同源域色） */
  Icon: React.ComponentType<{width?: number; height?: number; stroke?: string}>;
  /** IconTile 色（域色或语义色，DESIGN_SPEC §1.7） */
  color: string;
  /** 右侧自定义节点（Switch/操作按钮）；提供时不再渲染 chevron */
  right?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * ListItem — 子页统一模板的三段式行（DESIGN_SPEC §4b）：
 * IconTile + 标题 + 辅助说明 + right/chevron，PressableScale 按压回弹。
 * 行高 56（IconTile 40 + padding 8×2），触区 44 起。
 */
export const ListItem: React.FC<ListItemProps> = ({
  testID = 'ui-list-item',
  title,
  subtitle,
  Icon,
  color,
  right,
  onPress,
  disabled,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <PressableScale
      style={styles.row}
      testID={testID}
      onPress={onPress}
      disabled={disabled}>
      <IconTile icon={Icon} color={color} />
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <ChevronRightIcon
            width={18}
            height={18}
            stroke={theme.colors.onSurfaceVariant}
          />
        ) : null)}
    </PressableScale>
  );
};
