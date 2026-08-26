import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sliderContainer: {
      marginBottom: theme.spacing.m,
      paddingHorizontal: theme.spacing.s,
    },
    sliderLabel: {
      ...theme.fonts.bodyMedium,
      marginBottom: theme.spacing.s,
    },
    slider: {
      width: '100%',
      height: 40,
    },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: -8,
    },
    sliderMinLabel: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
    },
    sliderMaxLabel: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
    },
    scrollviewContainer: {
      padding: theme.spacing.default,
    },
    form: {
      gap: theme.spacing.default,
      padding: theme.spacing.default,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borders.default,
    },
    innerForm: {
      gap: theme.spacing.default,
    },
    modelNotDownloaded: {
      gap: theme.spacing.sm,
    },
    errorContainer: {
      gap: theme.spacing.sm,
    },
    errorMessage: {
      color: theme.colors.error,
      lineHeight: 20,
    },
    recommendedModelContainer: {
      // B56②：6→xs(4)（紧凑 stack gap）
      gap: theme.spacing.xs,
      paddingLeft: theme.spacing.xs,
    },
    recommendedLabel: {
      color: theme.colors.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    modelDetailsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    modelDetails: {
      color: theme.colors.onSurface,
      flex: 1,
    },
    modelSize: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: '500',
    },
    field: {
      gap: theme.spacing.xs,
    },
    dividerContainer: {
      marginVertical: theme.spacing.default,
    },
    dividerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.default,
    },
    dividerLabel: {
      color: theme.colors.onSurfaceVariant,
    },
    dividerLine: {
      flex: 1,
    },
    label: {
      ...theme.fonts.titleMedium,
      color: theme.colors.onSurface,
    },
    sublabel: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
    },
    input: {
      backgroundColor: theme.colors.surface,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.s,
      width: '100%',
    },
    actionBtn: {
      flex: 1,
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.s,
    },
    warningText: {
      color: theme.colors.error,
      flex: 1,
    },
    resetButton: {
      marginLeft: theme.spacing.s,
    },
    // New styles for LookieSheet
    modelDownloadSection: {
      gap: theme.spacing.m,
      marginTop: theme.spacing.s,
      marginBottom: theme.spacing.m,
    },
    modelSectionTitle: {
      ...theme.fonts.bodyMedium,
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.s,
    },
    modelItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.borders.default,
    },
    modelInfo: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    modelName: {
      ...theme.fonts.titleSmall,
      color: theme.colors.onSurface,
    },
    modelDescription: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
    },
    renderedPromptContainer: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.borders.default,
      padding: theme.spacing.default,
      marginTop: theme.spacing.s,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    renderedPromptText: {
      ...theme.fonts.bodyMedium,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
    },
    templateModeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.s,
    },
    toggleButton: {
      margin: 0,
    },
    resetOptionsContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: theme.spacing.s,
      marginTop: theme.spacing.s,
    },
    generationSettingsSection: {
      paddingHorizontal: theme.spacing.default,
      marginBottom: theme.spacing.default,
    },
    generationSettingsButton: {
      marginTop: theme.spacing.s,
    },
    talentItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.default,
    },
    talentInfo: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    talentDescription: {
      color: theme.colors.onSurfaceVariant,
    },
  });
