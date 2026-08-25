/**
 * PerfHistoryModal 样式（B41 提共享：原 ImageGenScreen 回放面板，
 * 聊天回合 + 生图任务统一历史回看）。从 ImageGenScreen/styles.ts 原样迁出。
 */
import {StyleSheet} from 'react-native';

import {withOpacity} from '../../utils/colorUtils';

export const createStyles = (theme: any) =>
  StyleSheet.create({
    perfModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    perfModalCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.radius.l,
      borderTopRightRadius: theme.radius.l,
      padding: 16,
      maxHeight: '82%',
      gap: 10,
    },
    perfModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    perfModalBackBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.onSurface, 0.06),
    },
    perfModalBackText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    perfModalTitle: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '600',
      flexShrink: 1,
    },
    perfModalEmpty: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      paddingVertical: 20,
    },
    perfSessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    perfSessionTitle: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
      fontWeight: '600',
      flexShrink: 1,
    },
    perfSessionMeta: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfReplayBody: {gap: 10},
    perfReplayCursorRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    perfReplayPss: {
      ...theme.typography.titleL,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    perfReplayCursorMeta: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfReplayChart: {
      height: 120,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 1,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    perfReplayBar: {width: 2, borderRadius: 1},
    perfPlayBtn: {
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.primary,
    },
    perfPlayBtnText: {
      ...theme.typography.uiS,
      color: '#ffffff',
      fontWeight: '600',
    },
    perfStatGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    perfStatCell: {
      flexBasis: '30%',
      gap: 2,
      padding: 8,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.onSurface, 0.04),
    },
    perfStatCellLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfStatCellValue: {
      ...theme.typography.uiM,
      color: theme.colors.onSurface,
      fontWeight: '700',
    },
    // 跑分卡：左侧总分圆 + 右侧分项（Geekbench 式）
    perfScoreCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 12,
      borderRadius: theme.radius.m,
      backgroundColor: withOpacity(theme.colors.primary, 0.08),
    },
    perfScoreTotal: {alignItems: 'center', gap: 2},
    perfScoreTotalNum: {
      ...theme.typography.displayM,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    perfScoreTotalLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    perfScoreItems: {gap: 3, flexShrink: 1},
    perfScoreItem: {
      ...theme.typography.uiS,
      color: theme.colors.onSurface,
    },
  });
