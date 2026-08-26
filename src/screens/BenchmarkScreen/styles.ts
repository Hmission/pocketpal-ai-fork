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
      padding: 16,
    },
    card: {
      marginBottom: 16,
    },
    description: {
      flex: 1,
      color: theme.colors.onSurfaceVariant,
      paddingRight: 8,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
    },
    button: {
      marginVertical: 6,
    },
    loadingContainer: {
      alignItems: 'center',
      marginVertical: 8,
      gap: 6,
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
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    warningText: {
      color: theme.colors.error,
      marginVertical: 2,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    resultsCard: {
      marginTop: 16,
      padding: 0,
    },
    resultItem: {
      marginBottom: 16,
    },
    // 结果页分项标签（雷达下/卡片内通用）
    resultLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 11,
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
