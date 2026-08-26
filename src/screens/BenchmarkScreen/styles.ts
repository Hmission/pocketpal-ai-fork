import {StyleSheet} from 'react-native';
import type {Theme} from '../../utils/types';

// B39 总控台样式（砍除祖传高级参数/滑杆/提交 Dialog 的死样式）
export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
      padding: theme.spacing.m,
    },
    card: {
      marginBottom: theme.spacing.m,
    },
    description: {
      flex: 1,
      color: theme.colors.onSurfaceVariant,
      paddingRight: theme.spacing.s,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
    button: {
      // B56②：6→s(8)（周围 8 系列 loadingContainer 距）
      marginVertical: theme.spacing.s,
    },
    loadingContainer: {
      alignItems: 'center',
      marginVertical: theme.spacing.s,
      // B56②：6→xs(4)（spinner-文本紧凑 gap）
      gap: theme.spacing.xs,
    },
    // B46 迁移：确认弹窗正文（Dialog → OverlayCard 后 Message 文本）
    dialogMessage: {
      ...theme.typography.bodyS,
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
    },
    modelSelectorContent: {
      justifyContent: 'space-between',
      flexDirection: 'row-reverse',
      alignItems: 'center',
    },
    warningContainer: {
      backgroundColor: theme.colors.errorContainer,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
      marginVertical: theme.spacing.s,
    },
    warningText: {
      color: theme.colors.error,
      marginVertical: theme.spacing.xxs,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.s,
    },
    resultsCard: {
      marginTop: theme.spacing.m,
      padding: 0,
    },
    resultItem: {
      marginBottom: theme.spacing.m,
    },
    // 结果页分项标签（雷达下/卡片内通用）
    resultLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
    },
    // 结果页段位行：品牌色 + 居中（rankHighlight 叠加在 resultLabel 上）
    rankHighlight: {
      color: theme.colors.brandAccent,
      textAlign: 'center',
    },
    // 结果页分享提示：居中（叠加在 resultLabel 上）
    labelCenter: {
      textAlign: 'center',
    },
    // 结果页雷达包裹（揭幕分下方居中）
    radarWrap: {
      alignItems: 'center',
      marginVertical: theme.spacing.s,
    },
  });
