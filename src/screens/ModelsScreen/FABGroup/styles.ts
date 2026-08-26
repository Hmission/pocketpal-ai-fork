import {StyleSheet} from 'react-native';

import {Theme} from '../../../utils/types';
import {uiStore} from '../../../store';

export const createStyles = (theme: Theme) => {
  // v3.8：使用 resolvedColorScheme（'system' 模式解析为实际 light/dark）
  const isDark = uiStore.resolvedColorScheme === 'dark';

  return StyleSheet.create({
    fab: {
      bottom: 0,
      right: theme.spacing.m,
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.outline,
      borderWidth: isDark ? 1 : 0,
    },
    actionButton: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.outline,
      borderWidth: isDark ? 1 : 0,
    },
    icon: {
      width: 24,
      height: 24,
    },
  });
};
