import {StyleSheet} from 'react-native';
import type {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Figma `885:29601` Visual frame — 85×142.67 natural width.
    illustrationWrap: {
      width: 85,
      height: 143,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 阶段四存储权限说明：正文上方留白（captionS 叠 12px）
    storageNote: {
      marginTop: theme.spacing.sm,
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
  });
