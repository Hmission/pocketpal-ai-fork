import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.m,
      paddingBottom: theme.spacing.xl,
    },
    privacyContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.m,
      backgroundColor: theme.colors.tertiaryContainer,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
    },
    privacyText: {
      flex: 1,
      color: theme.colors.onTertiaryContainer,
      fontSize: theme.typography.bodyS.fontSize,
      marginLeft: theme.spacing.s,
    },
    privacyDismiss: {
      marginLeft: theme.spacing.s,
      padding: theme.spacing.xs,
    },
    chipsSection: {
      marginBottom: theme.spacing.m,
    },
    chipsSectionLabel: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.s,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.sm,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.outlineVariant,
    },
    dividerText: {
      marginHorizontal: theme.spacing.sm,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
    },
    inputSpacing: {
      marginBottom: theme.spacing.sm,
    },
    apiKeyDescription: {
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
    },
    warningContainer: {
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.errorContainer,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
    },
    warningText: {
      color: theme.colors.onErrorContainer,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
    },
    probeStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.s,
    },
    probeStatusText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      marginLeft: theme.spacing.xs,
    },
    probeSuccessText: {
      color: theme.colors.primary,
    },
    probeErrorText: {
      color: theme.colors.error,
    },
    modelListSection: {
      marginTop: theme.spacing.s,
      marginBottom: theme.spacing.sm,
    },
    modelListLabel: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.s,
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.s,
    },
    modelRowDisabled: {
      opacity: 0.5,
    },
    modelName: {
      flex: 1,
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      color: theme.colors.onSurface,
      marginLeft: theme.spacing.s,
    },
    modelVisionSlot: {
      width: 20,
      marginStart: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modelVisionUnknown: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
    },
    alreadyAddedText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
      fontStyle: 'italic',
      marginStart: 4,
    },
    noModelsText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      paddingVertical: theme.spacing.m,
    },
    chipErrorContainer: {
      marginTop: theme.spacing.s,
      marginBottom: theme.spacing.sm,
    },
    chipErrorActions: {
      flexDirection: 'row',
      marginTop: theme.spacing.s,
    },
    chipServerInfo: {
      marginBottom: theme.spacing.sm,
    },
    chipServerName: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '500',
      color: theme.colors.onSurface,
    },
    chipServerUrl: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.onSurfaceVariant,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      marginTop: theme.spacing.xs,
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      width: '100%',
    },
    addButton: {
      flex: 1,
    },
  });
};
