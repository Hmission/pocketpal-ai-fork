import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.m,
      paddingBottom: theme.spacing.xl,
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
    modelsSection: {
      marginTop: theme.spacing.s,
      marginBottom: theme.spacing.sm,
    },
    modelsSectionLabel: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.s,
    },
    modelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
    },
    modelDot: {
      width: 6,
      height: 6,
      // B56②：6×6 圆点 → full（同 28px icon 钮裁定）
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.onSurfaceVariant,
      marginRight: theme.spacing.s,
    },
    modelItemText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurface,
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    saveButton: {
      flex: 1,
    },
    removeSection: {
      marginTop: theme.spacing.m,
      alignItems: 'center',
    },
    removeDescription: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xs,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      marginTop: theme.spacing.xs,
    },
  });
};
