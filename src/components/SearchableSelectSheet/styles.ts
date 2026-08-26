import {I18nManager, StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
      marginHorizontal: theme.spacing.m,
      marginBottom: theme.spacing.s,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.m,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    searchInput: {
      flex: 1,
      height: theme.size.minTapTarget,
      color: theme.colors.onSurface,
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      padding: 0,
      // TextInput is not auto-mirrored the way Text is, so this needs the
      // explicit ternary. See rowLabel.
      textAlign: I18nManager.isRTL ? 'right' : 'left',
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: theme.spacing.l,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.m,
    },
    rowLabel: {
      flex: 1,
      color: theme.colors.onSurface,
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      // 'left' is how "start" is spelled: RN has no textAlign start/end, and
      // auto-mirrors left/right for Text. An isRTL ternary mirrors twice and
      // lands at the end.
      textAlign: 'left',
    },
    rowLabelSelected: {
      fontWeight: '700',
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      textAlign: 'left',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.m,
    },
  });
