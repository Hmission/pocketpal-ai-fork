import {StyleSheet} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';
import {Theme} from '../../utils/types';

export const createStyles = ({
  theme,
  insets,
}: {
  theme: Theme;
  insets: EdgeInsets;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    flatList: {
      height: '100%',
      // flex: 1,
    },
    flatListContentContainer: {
      flexGrow: 1,
    },
    footer: {
      height: 16,
    },
    footerLoadingPage: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.m,
      height: 32,
    },
    header: {
      height: 4,
    },
    menu: {
      width: 170,
    },
    scrollToBottomButton: {
      position: 'absolute',
      right: theme.spacing.m,
      backgroundColor: theme.colors.primary,
      width: 35,
      height: 35,
      borderRadius: theme.radius.l,
      justifyContent: 'center',
      alignItems: 'center',
      // B56②豁免：shadow token dark 绑定白不适配（登记评审）
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    suggestedPromptsOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 9,
      backgroundColor: 'transparent',
    },
    inputContainer: {
      borderTopLeftRadius: theme.borders.inputBorderRadius,
      borderTopRightRadius: theme.borders.inputBorderRadius,
      position: 'absolute',
      zIndex: 10,
      left: 0,
      right: 0,
      bottom: 0,
      ...(!theme.dark
        ? {
            boxShadow: `0px -2px 8px ${theme.colors.shadow}1A`,
          }
        : {}),
    },
    chatContainer: {
      flex: 1,
      position: 'relative',
      backgroundColor: theme.colors.background,
      zIndex: 0,
    },
    headerWrapper: {
      zIndex: 100,
    },
    customBottomComponent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    // P5 全屏查看器「编辑此图片」按钮（底部悬浮胶囊，与保存按钮同层）
    viewerEditButton: {
      position: 'absolute' as const,
      // B58：insets 感知（底部手势条设备不贴条，与 TextMessage 保存钮同表达式归一）
      bottom: insets.bottom + theme.spacing.m,
      alignSelf: 'center' as const,
      paddingHorizontal: theme.spacing.l,
      // B56②：10→s(8)（按钮垂直内距紧凑）
      paddingVertical: theme.spacing.s,
      borderRadius: theme.radius.l, // B56① radius 不扩档（镜像 Figma 量表），原值 24 归 l 档
      // 浅色浮层：surfaceElevated（全屏查看器浅色面，§12.6 豁免登记）
      backgroundColor: theme.colors.surfaceElevated,
      zIndex: 1,
    },
    viewerEditText: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.bodyM.fontSize,
      fontWeight: '600' as const,
    },
  });
