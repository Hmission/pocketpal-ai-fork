import {StyleSheet} from 'react-native';
import {EdgeInsets} from 'react-native-safe-area-context';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flexGrow: 1,
      padding: theme.spacing.default,
      paddingBottom: theme.spacing.default + insets.bottom,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borders.default,
      overflow: 'hidden',
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    header: {
      padding: theme.spacing.default * 2,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceVariant,
    },
    headerContent: {
      gap: theme.spacing.default,
    },
    title: {
      ...theme.fonts.headlineLarge,
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.default / 2,
      letterSpacing: -0.5,
    },
    description: {
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.default,
      lineHeight: 24,
    },
    bodyText: {
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.default,
      lineHeight: 24,
    },
    featuresTitle: {
      color: theme.colors.onSurface,
      fontWeight: '600',
      marginBottom: theme.spacing.default / 2,
    },
    featureItem: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 24,
      marginBottom: theme.spacing.default / 4,
    },
    openSourceText: {
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.default,
      lineHeight: 20,
      opacity: 0.85,
    },
    basedOnText: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.default / 2,
      opacity: 0.7,
    },
    versionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.default / 2,
    },
    versionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainerHigh,
      paddingHorizontal: theme.spacing.default,
      paddingVertical: theme.spacing.default / 2,
      borderRadius: theme.borders.default,
      gap: theme.spacing.default / 2,
      borderWidth: 1,
      borderColor: theme.colors.surfaceVariant,
    },
    versionText: {
      ...theme.fonts.bodyMedium,
      color: theme.colors.onSurface,
    },
    llamaBuildText: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.default / 2,
      opacity: 0.7,
    },
    githubSection: {
      marginTop: theme.spacing.default * 1.5,
      gap: theme.spacing.default / 2,
    },
    githubDescription: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 18,
      opacity: 0.85,
    },
    githubButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.default * 1.5,
      paddingVertical: theme.spacing.default,
      borderRadius: theme.borders.default,
    },
    githubButtonText: {
      ...theme.fonts.labelLarge,
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
  });
