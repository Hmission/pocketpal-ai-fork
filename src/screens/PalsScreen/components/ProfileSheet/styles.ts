import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      padding: theme.spacing.m,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.m,
      marginBottom: theme.spacing.l,
    },
    avatarContainer: {
      width: 64,
      height: 64,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: theme.typography.titleM.fontSize, // B56③ fontSize→titleM
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xs,
    },
    userEmail: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
    },
    divider: {
      marginVertical: theme.spacing.m,
    },
    actions: {
      gap: theme.spacing.m,
    },
    sectionTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.s,
    },
    actionButton: {
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.m,
    },
    signInPrompt: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.m,
    },
    signInTitle: {
      fontSize: theme.typography.headlineH3.fontSize, // B56③ 20→headlineH3（补档归档，等值）
      fontWeight: '600',
      color: theme.colors.onSurface,
      textAlign: 'center',
    },
    signInDescription: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: theme.spacing.m,
    },
    signInButton: {
      marginTop: theme.spacing.s,
      paddingHorizontal: theme.spacing.xl,
    },
  });
