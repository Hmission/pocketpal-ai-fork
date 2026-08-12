import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: 16,
      paddingBottom: 32,
    },
    description: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 24,
      lineHeight: 20,
    },
    optionsContainer: {
      gap: 12,
      marginBottom: 24,
    },
    optionCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.outline + '30',
      backgroundColor: theme.colors.surface,
      padding: 16,
    },
    optionCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer + '20',
    },
    optionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    optionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    optionTitleSelected: {
      color: theme.colors.primary,
    },
    optionDescription: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 12,
      lineHeight: 18,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
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
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    sizeChip: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.secondaryContainer + '50',
    },
    sizeChipText: {
      fontSize: 12,
      color: theme.colors.onSecondaryContainer,
    },
    // ProjectionModelSelector-style components
    modelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.surfaceVariant + '20',
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    selectedModelItem: {
      borderLeftColor: theme.colors.tertiary,
      backgroundColor: theme.colors.tertiaryContainer + '20',
    },
    modelInfo: {
      flex: 1,
      marginRight: 12,
    },
    modelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    modelIcon: {
      marginRight: 8,
    },
    modelName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.onSurface,
      flex: 1,
    },
    selectedModelName: {
      fontWeight: '600',
      color: theme.colors.tertiary,
    },
    modelSize: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      marginLeft: 20,
    },
    modelActions: {
      minWidth: 80,
      alignItems: 'flex-end',
    },
    selectArea: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 6,
      minWidth: 70,
      justifyContent: 'center',
    },
    selectedArea: {
      backgroundColor: theme.colors.tertiaryContainer + '30',
    },
    selectText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
      marginLeft: 4,
    },
    // VisionControlSheet-style components
    toggleContainer: {
      marginBottom: 16,
    },
    toggleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    toggleTextContainer: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    divider: {
      marginVertical: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    projectionModelsContainer: {
      marginBottom: 16,
    },
    disabledProjectionSelector: {
      opacity: 0.5,
    },
    projectionModelItem: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.surfaceVariant + '20',
      borderRadius: 8,
      marginBottom: 8,
    },
    projectionModelInfo: {
      flex: 1,
    },
    projectionModelName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    projectionModelSize: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      marginTop: 6,
      fontStyle: 'italic',
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.errorContainer + '30',
      borderWidth: 1,
      borderColor: theme.colors.error + '50',
      marginBottom: 16,
    },
    warningText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.error,
      lineHeight: 18,
    },
    actionsContainer: {
      flexDirection: 'row',
      // justifyContent: 'space-between',
      // alignItems: 'center',
      // width: '100%',
      paddingHorizontal: 24,
    },
  });
