import {Platform, StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.m,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borders.default,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    stopLabel: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingItem: {
      marginBottom: theme.spacing.l,
      paddingHorizontal: theme.spacing.xs,
    },
    settingLabel: {
      marginBottom: theme.spacing.xxs,
    },
    settingValue: {
      textAlign: 'right',
    },
    slider: {
      ...Platform.select({
        android: {
          marginLeft: -12,
          marginRight: -10,
        },
      }),
    },
    divider: {
      marginVertical: theme.spacing.m,
    },
    segmentedButtons: {
      marginTop: theme.spacing.s,
    },
    inputLabel: {
      flex: 1,
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      marginRight: theme.spacing.s,
    },
    stopWordsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
      marginBottom: theme.spacing.s,
    },
    stopChip: {
      marginRight: theme.spacing.xs,
      marginVertical: theme.spacing.xs,
    },
    stopChipText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
    },
    description: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xxs,
      marginBottom: theme.spacing.s,
    },
  });
