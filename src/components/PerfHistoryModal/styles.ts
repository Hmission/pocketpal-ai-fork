/**
 * PerfHistoryModal 样式（B41 提共享：原 ImageGenScreen 回放面板，
 * 聊天回合 + 生图任务统一历史回看）。
 * v3.21：弃手写 Modal 壳（backdrop/card/header）——迁移 Sheet 底座（DESIGN_SPEC §12.2），
 * 内容区 padding 与二级导航按钮随迁；底部圆角/遮罩/关闭按钮由 Sheet 承担。
 */
import {StyleSheet} from 'react-native';

import {withOpacity} from '../../utils/colorUtils';

export const createStyles = (theme: any) =>
  StyleSheet.create({
    // Sheet 内容区：padding 对齐 Sheet 样板的 upscaleBody 族（padding 16 + 底 28）
    perfModalBody: {
      flex: 1,
      padding: theme.spacing.m,
      paddingBottom: 28,
      // B56②：10→sm(12)（区块级 gap）
      gap: theme.spacing.sm,
    },
    perfSessionList: {flex: 1},
    perfBackBtn: {
      alignSelf: 'flex-start',
      // B56②：10→sm(12)（水平性）
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.onSurface, 0.06),
    },
    perfBackText: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    perfModalEmpty: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      paddingVertical: theme.spacing.ml,
    },
    perfSessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // B56②：10→s(8)（垂直紧凑）
      paddingVertical: theme.spacing.s,
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
    perfReplayBody: {
      // B56②：10→sm(12)（区块级 gap）
      gap: theme.spacing.sm,
    },
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
      // B56②：1→xxs(2)（柱间细距）
      gap: theme.spacing.xxs,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    perfReplayBar: {
      width: 2,
      // B56②：1→xxs(2)（2px 柱圆角）
      borderRadius: theme.radius.xxs,
    },
    perfPlayBtn: {
      alignSelf: 'center',
      paddingHorizontal: theme.spacing.m,
      // B56②：6→xs(4)（紧凑垂直）
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.primary,
    },
    perfPlayBtnText: {
      ...theme.typography.uiS,
      // primary 底白字（onPrimary 深棕）——B56②登记评审，保持字面量
      color: '#ffffff',
      fontWeight: '600',
    },
    perfStatGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
    },
    perfStatCell: {
      flexBasis: '30%',
      gap: theme.spacing.xxs,
      padding: theme.spacing.s,
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
      padding: theme.spacing.sm,
      borderRadius: theme.radius.m,
      backgroundColor: withOpacity(theme.colors.primary, 0.08),
    },
    perfScoreTotal: {alignItems: 'center', gap: theme.spacing.xxs},
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
