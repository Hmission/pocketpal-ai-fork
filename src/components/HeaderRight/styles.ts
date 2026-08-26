import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    headerRightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      // task-6ad §20.3 复查修正（真机像素验证）：三控件视觉等距以
      // 「图标间空隙」为度量（非触区间距）——加号图标在 36px 触区内居中
      // 自然形成右留白 ~30px；三点图标左贴触区左缘（compactBtnLeft），
      // 空隙 ≈30px 与胶囊↔加号 ≈35px 视觉一致。不加 gap（10px 会拉到 99px）。
    },
    // §18.3 紧凑触区：36px、margin 0，与模型胶囊同组收紧
    // （IconButton 默认 40px 容器 + 内边距撑开间距，弃用）
    compactBtn: {
      width: theme.size.controlHeight,
      height: theme.size.controlHeight,
      margin: 0,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.size.controlHeight / 2,
    },
    // §20.3 三点菜单图标左贴：触区右缘贴屏边，图标贴触区左缘，
    // 与加号右留白形成等距空隙（避免图标居中产生的双倍留白）。
    // 注意 RN column 容器：水平方向由 alignItems 控制（justifyContent 只管垂直）。
    // marginLeft -6dp：补偿 DotsVerticalIcon viewBox 内三点居中的左侧空白
    // （真机像素验证 52px→≈36px，与胶囊↔加号 35-37px 视觉等距）。
    compactBtnLeft: {
      width: theme.size.controlHeight,
      height: theme.size.controlHeight,
      margin: 0,
      marginLeft: -6,
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingLeft: 0,
      borderRadius: theme.size.controlHeight / 2,
    },
  });
