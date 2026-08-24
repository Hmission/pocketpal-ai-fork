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
  });
