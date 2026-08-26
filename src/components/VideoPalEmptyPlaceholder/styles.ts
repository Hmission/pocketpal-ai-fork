import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      // Don't use flex: 1 since we're in a FlatList ListEmptyComponent
      // The FlatList already handles centering with justifyContent: 'center'
      alignItems: 'center',
      paddingHorizontal: theme.spacing.l,
      paddingTop: theme.spacing.ml,
      gap: theme.spacing.m,
      minHeight: 400, // Ensure minimum height for proper centering
    },
    content: {
      alignItems: 'center',
      // B56②：6→xs(4)（紧凑 stack gap）
      gap: theme.spacing.xs,
      maxWidth: '100%',
    },
    title: {
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: theme.spacing.xxs,
      ...theme.fonts.titleLarge,
    },
    subtitle: {
      color: theme.colors.primary,
      textAlign: 'center',
      // B56②：6→xs(4)（紧凑标题距）
      marginBottom: theme.spacing.xs,
      ...theme.fonts.titleSmall,
    },
    description: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: theme.spacing.m,
      ...theme.fonts.bodyMedium,
    },
    experimentalNotice: {
      backgroundColor: theme.colors.errorContainer,
      // B56②：radius 6→s(8)（小卡档）/ 6→xs(4)（紧凑垂直）
      borderRadius: theme.radius.s,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
      maxWidth: '100%',
    },
    experimentalText: {
      color: theme.colors.onErrorContainer,
      textAlign: 'center',
      ...theme.fonts.bodySmall,
    },
    instructionsContainer: {
      alignItems: 'flex-start',
      // B56②：3→xs(4)（微距）
      gap: theme.spacing.xs,
      maxWidth: '100%',
    },
    instructionsTitle: {
      color: theme.colors.onSurface,
      // B56②：6→xs(4)（紧凑标题距）
      marginBottom: theme.spacing.xs,
      ...theme.fonts.titleSmall,
    },
    instructionStep: {
      color: theme.colors.onSurfaceVariant,
      ...theme.fonts.bodySmall,
    },

    logo: {
      width: 96,
      height: 96,
      borderRadius: theme.radius.l, // B56① radius 不扩档（镜像 Figma 量表），原值 24 归 l 档
    },
  });
