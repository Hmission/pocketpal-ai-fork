import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.default,
    },
    title: {
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: theme.spacing.s,
      // 页面大标题（DESIGN_SPEC §2.3 displayS）
      ...theme.typography.displayS,
    },
    description: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      ...theme.typography.bodyM,
    },
    button: {
      minWidth: 200,
    },
    logo: {
      width: 112,
      height: 112,
      borderRadius: theme.radius.xl,
    },
  });
