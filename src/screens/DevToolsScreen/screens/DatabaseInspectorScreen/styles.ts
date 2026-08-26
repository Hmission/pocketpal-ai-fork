import {StyleSheet} from 'react-native';

import {Theme} from '../../../../utils/types';

/**
 * DatabaseInspector（开发者调试屏）——B56③ 整文件归一：
 * 间距→spacing token / 圆角→radius token / 灰度族→语义色（§1.6）/
 * fontSize→typography 等值档。工具屏视觉容忍度高，一次性收编。
 */
export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background, // #f5f5f5→background
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.m, // 16→m
      // 深色工具栏底：反色面（inverse 族，原 #2c3e50）
      backgroundColor: theme.colors.inverseSurface,
    },
    headerTitle: {
      fontSize: theme.typography.titleM.fontSize, // B56③ fontSize→titleM
      fontWeight: 'bold',
      color: theme.colors.inverseOnSurface, // white→inverseOnSurface
    },
    closeButton: {
      padding: theme.spacing.s, // 8→s
    },
    closeButtonText: {
      color: theme.colors.inverseOnSurface, // white→inverseOnSurface
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
      padding: theme.spacing.m, // 16→m
    },
    card: {
      marginBottom: theme.spacing.m, // 16→m
    },
    collectionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm, // 12→sm
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant, // #e0e0e0→outlineVariant
    },
    collectionName: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '500',
    },
    recordCount: {
      color: theme.colors.onSurfaceVariant, // #666→onSurfaceVariant（次级灰）
    },
    recordList: {
      maxHeight: 400, // 布局尺寸（非间距语义），保留
    },
    recordItem: {
      padding: theme.spacing.sm, // 12→sm
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant, // #e0e0e0→outlineVariant
    },
    recordId: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant, // #666→onSurfaceVariant
      marginBottom: theme.spacing.xs, // 4→xs
    },
    recordTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '500',
    },
    recordSessionId: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant, // #666→onSurfaceVariant
      marginTop: theme.spacing.xs, // 4→xs
    },
    emptyText: {
      textAlign: 'center',
      padding: theme.spacing.ml, // 20→ml
      color: theme.colors.onSurfaceVariant, // #666→onSurfaceVariant
    },
    recordDetails: {
      maxHeight: 500, // 布局尺寸（非间距语义），保留
    },
    detailItem: {
      marginBottom: theme.spacing.s, // 8→s
    },
    detailKey: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface, // #333→onSurface（正文灰）
    },
    detailValue: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant, // #666→onSurfaceVariant
      marginTop: theme.spacing.xxs, // 2→xxs
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    navigationButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    relatedRecordsSection: {
      marginTop: theme.spacing.ml, // 20→ml
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant, // #e0e0e0→outlineVariant
      paddingTop: theme.spacing.sm, // 12→sm
    },
    relatedRecordsTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: 'bold',
      marginBottom: theme.spacing.s, // 8→s
      color: theme.colors.onSurface, // #333→onSurface
    },
    relatedCollection: {
      marginBottom: theme.spacing.sm, // 12→sm
    },
    relatedCollectionTitle: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant, // #666→onSurfaceVariant
      marginBottom: theme.spacing.xs, // 4→xs
    },
    relatedRecord: {
      backgroundColor: theme.colors.surfaceVariant, // #f0f0f0→surfaceVariant
      padding: theme.spacing.s, // 8→s
      // 形状角色：小元素 s(8)（DESIGN_SPEC §4；B56③ 保持 radius token）
      borderRadius: theme.radius.s,
      marginBottom: theme.spacing.xs, // 4→xs
      marginLeft: theme.spacing.s, // 8→s
    },
    relatedRecordId: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant, // #888→onSurfaceVariant
    },
    relatedRecordTitle: {
      fontSize: theme.typography.uiM.fontSize, // B56③ 13→uiM(14)，500 权重匹配
      fontWeight: '500',
    },
    next: {
      flexDirection: 'row-reverse',
    },
    cardActionsColumn: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: theme.spacing.s, // 8→s
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.s, // 8→s
    },
    resetButton: {
      flex: 1,
    },
  });
