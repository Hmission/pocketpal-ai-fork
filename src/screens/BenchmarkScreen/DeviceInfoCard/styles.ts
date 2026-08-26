import {StyleSheet} from 'react-native';

import type {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    deviceInfoCard: {
      marginBottom: theme.spacing.m,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      // B56②：15→ml(16)（卡外层圆角取大档）
      borderRadius: theme.radius.ml,
    },
    deviceInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.xs,
    },
    deviceInfoLabel: {
      color: theme.colors.onSurfaceVariant,
      flexShrink: 0,
      marginRight: theme.spacing.s,
    },
    deviceInfoValue: {
      color: theme.colors.onSurface,
      flex: 1,
      textAlign: 'right',
      flexWrap: 'wrap',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.m,
    },
    headerContent: {
      flex: 1,
    },
    headerSummary: {
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xs,
    },
    section: {
      marginVertical: theme.spacing.s,
    },
    sectionTitle: {
      color: theme.colors.primary,
      marginBottom: theme.spacing.s,
      textTransform: 'uppercase',
    },
  });
