import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.m,
      paddingBottom: theme.spacing.xl,
    },
    description: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.l,
      lineHeight: 20,
    },
    optionsContainer: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.l,
    },
    optionCard: {
      borderRadius: theme.radius.m,
      borderWidth: 1,
      borderColor: theme.colors.outline + '30',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.m,
    },
    optionCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer + '20',
    },
    optionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.s,
    },
    optionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    optionTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    optionTitleSelected: {
      color: theme.colors.primary,
    },
    optionDescription: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.sm,
      lineHeight: 18,
    },
    radioButton: {
      width: 20,
      height: 20,
      // B56②：20px 圆钮 10=半高 → full
      borderRadius: theme.radius.full,
      borderWidth: 2,
      borderColor: theme.colors.outline,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioButtonSelected: {
      borderColor: theme.colors.primary,
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      // B56②：10×10 内圆点 → full
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primary,
    },
    sizeChip: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.secondaryContainer + '50',
    },
    sizeChipText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.onSecondaryContainer,
    },
    // ProjectionModelSelector-style components
    modelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.surface + '20',
      borderRadius: theme.radius.s,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    selectedModelItem: {
      borderLeftColor: theme.colors.tertiary,
      backgroundColor: theme.colors.tertiaryContainer + '20',
    },
    modelInfo: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    modelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    modelIcon: {
      marginRight: theme.spacing.s,
    },
    modelName: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
      flex: 1,
    },
    selectedModelName: {
      fontWeight: '600',
      color: theme.colors.tertiary,
    },
    modelSize: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
      marginLeft: theme.spacing.ml,
    },
    modelActions: {
      minWidth: 80,
      alignItems: 'flex-end',
    },
    selectArea: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：6→xs(4) 垂直 / radius 6→s(8)（小按钮档）
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
      borderRadius: theme.radius.s,
      minWidth: 70,
      justifyContent: 'center',
    },
    selectedArea: {
      backgroundColor: theme.colors.tertiaryContainer + '30',
    },
    selectText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
      marginLeft: theme.spacing.xs,
    },
    // VisionControlSheet-style components
    toggleContainer: {
      marginBottom: theme.spacing.m,
    },
    toggleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
    },
    toggleTextContainer: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    divider: {
      marginVertical: theme.spacing.m,
    },
    sectionTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    projectionModelsContainer: {
      marginBottom: theme.spacing.m,
    },
    disabledProjectionSelector: {
      opacity: 0.5,
    },
    projectionModelItem: {
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.surface + '20',
      borderRadius: theme.radius.s,
      marginBottom: theme.spacing.s,
    },
    projectionModelInfo: {
      flex: 1,
    },
    projectionModelName: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xs,
    },
    projectionModelSize: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: theme.spacing.m,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      // B56②：6→xs(4)（紧凑）
      marginTop: theme.spacing.xs,
      fontStyle: 'italic',
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.errorContainer + '30',
      borderWidth: 1,
      borderColor: theme.colors.error + '50',
      marginBottom: theme.spacing.m,
    },
    warningText: {
      flex: 1,
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.error,
      lineHeight: 18,
    },
    actionsContainer: {
      flexDirection: 'row',
      // justifyContent: 'space-between',
      // alignItems: 'center',
      // width: '100%',
      paddingHorizontal: theme.spacing.l,
    },
  });
