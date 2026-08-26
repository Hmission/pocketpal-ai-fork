import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    contentContainer: {
      flex: 1,
      justifyContent: 'space-between',
    },
    list: {
      padding: theme.spacing.m,
      // R2：100 静态底缘 → xxl（40）。核实结论：bottomOffset={100} 为键盘补偿（KeyboardAwareScrollView），
      // 与内容底缘留白是两件事——Sheet 92% 底缘无遮挡物，40 留白足够（完整分区列入下批）
      paddingBottom: theme.spacing.xxl,
    },
    divider: {
      marginVertical: theme.spacing.sm,
    },
    modelAuthor: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.xxs,
    },
    modelNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
      flexWrap: 'wrap',
    },
    modelName: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '500',
      color: theme.colors.onSurface,
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    statText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
    },
    noResultsText: {
      textAlign: 'center',
      marginTop: theme.spacing.ml,
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      color: theme.colors.onSurfaceVariant,
    },
    loadingMoreText: {
      textAlign: 'center',
      padding: theme.spacing.m,
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
    },
    gatedChipText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
    },
    emptyStateContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.ml,
      marginBottom: theme.spacing.ml,
      padding: theme.spacing.m,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surfaceVariant,
      width: '90%',
      alignSelf: 'center',
    },
    errorText: {
      color: theme.colors.error,
      marginTop: theme.spacing.s,
    },
    errorHintText: {
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.s,
      textAlign: 'center',
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      fontStyle: 'italic',
      paddingHorizontal: theme.spacing.ml,
    },
    disableTokenButton: {
      // B56②：10→sm(12)（外层距）
      marginTop: theme.spacing.sm,
      alignSelf: 'center',
    },
  });
