import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outline,
      overflow: 'hidden',
    },
    searchContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainerHigh,
      borderRadius: theme.radius.l, // B56① radius 不扩档（镜像 Figma 量表），原值 24 归 l 档
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
      gap: theme.spacing.s,
    },
    searchIcon: {
      opacity: 0.7,
    },
    searchInput: {
      flex: 1,
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      color: theme.colors.onSurface,
      padding: 0,
      margin: 0,
      minHeight: 24,
    },
    clearButton: {
      padding: theme.spacing.xs,
      borderRadius: theme.radius.m,
    },
    searchActions: {
      flexDirection: 'row',
      gap: theme.spacing.s,
    },

    closeButton: {
      padding: theme.spacing.s,
      borderRadius: theme.radius.l,
      backgroundColor: theme.colors.surfaceContainerHigh,
    },
  });
