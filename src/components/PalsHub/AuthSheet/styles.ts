import {StyleSheet} from 'react-native';
import {Theme} from '../../../utils';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Auth Sheet
    authSheet: {
      padding: theme.spacing.m,
    },
    authHeader: {
      padding: theme.spacing.l,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    authTitle: {
      fontSize: theme.typography.headlineH2.fontSize, // B56③ 24→headlineH2（补档归档，等值）
      fontWeight: 'bold',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.s,
    },
    authSubtitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    authContent: {
      padding: theme.spacing.l,
    },
    authForm: {
      gap: theme.spacing.m,
    },
    authInput: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    authButton: {
      height: 48,
      marginTop: theme.spacing.s,
    },
    authButtonContent: {
      height: 48,
      justifyContent: 'center',
    },
    authDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.l,
    },
    authDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.outline,
    },
    authDividerText: {
      paddingHorizontal: theme.spacing.m,
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
    },
    authSocialButton: {
      height: 48,
      borderColor: theme.colors.outline,
    },
    authToggle: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing.m,
    },
    authToggleText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
    },
    authToggleLink: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      color: theme.colors.primary,
      fontWeight: '600',
    },
    authToggleButtonContent: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      minHeight: 20,
    },
    authLoadingContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.m,
    },
    authErrorText: {
      color: theme.colors.error,
      marginBottom: theme.spacing.m,
    },
    // Auth Prompt
    authPrompt: {
      padding: theme.spacing.m,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
      backgroundColor: theme.colors.surfaceVariant,
    },
    authPromptText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
  });
