import React from 'react';
import {View} from 'react-native';

import {useTheme} from '../../../hooks';
import {withOpacity} from '../../../utils/colorUtils';

export type IconTileSize = 'm' | 's';

export interface IconTileProps {
  /** Lucide 线条图标组件（接受 width/height/stroke props） */
  icon: React.ComponentType<{width?: number; height?: number; stroke?: string}>;
  /** 域彩色（DESIGN_SPEC §1.2）：线条与底色同源，底取 12% 透明度 */
  color: string;
  /** m=40（默认，列表行）/ s=32（紧凑场景） */
  size?: IconTileSize;
  testID?: string;
}

/**
 * IconTile — 彩色圆底图标容器（DESIGN_SPEC §3，文本裸露治理核心）。
 * 40x40 圆角容器（radius.m）+ 域色 12% 透明底 + 22px 线条 icon。
 */
export const IconTile: React.FC<IconTileProps> = ({
  icon: Icon,
  color,
  size = 'm',
  testID = 'ui-icon-tile',
}) => {
  const theme = useTheme();
  const dim = size === 'm' ? 40 : 32;
  const iconDim = size === 'm' ? 22 : 18;
  return (
    <View
      testID={testID}
      style={{
        width: dim,
        height: dim,
        borderRadius: theme.radius.m,
        backgroundColor: withOpacity(color, 0.12),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon width={iconDim} height={iconDim} stroke={color} />
    </View>
  );
};
