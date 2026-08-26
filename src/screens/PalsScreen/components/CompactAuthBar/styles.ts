import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceContainerHigh,
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outline,
    },
    authenticatedContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    welcomeText: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
      flex: 1,
    },
    unauthenticatedContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    infoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
      flex: 1,
    },
    infoText: {
      fontSize: theme.typography.bodyS.fontSize,
      color: theme.colors.onSurfaceVariant,
      flex: 1,
      lineHeight: 18,
    },
    actionsSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    signInButton: {
      borderRadius: theme.radius.l,
      minWidth: 80,
    },
    signInButtonLabel: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '600',
    },
    dismissButton: {
      margin: 0,
    },
  });
