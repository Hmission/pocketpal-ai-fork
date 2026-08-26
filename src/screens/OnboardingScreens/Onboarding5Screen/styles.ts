import {StyleSheet} from 'react-native';

import type {Theme} from '../../../utils/types';
import {FONT_FAMILIES} from '../../../theme/tokens/typography';

export const createStyles = (theme: Theme) => {
  const isFraunces =
    theme.typography.headlineH1.fontFamily === FONT_FAMILIES.FRAUNCES_MEDIUM;
  return StyleSheet.create({
    header: {
      width: 369,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    title: {
      // Figma `Headline/H2` — Fraunces Medium 24/28, centered.
      fontFamily: isFraunces
        ? FONT_FAMILIES.FRAUNCES_MEDIUM
        : FONT_FAMILIES.INTER_MEDIUM,
      fontSize: theme.typography.headlineH2.fontSize, // B56③ 24→headlineH2（补档归档，等值；字体条件保留）
      lineHeight: theme.typography.headlineH2.lineHeight, // B56③ lineHeight 同步取 token（等值 28）
      color: theme.colors.onBackground,
      textAlign: 'center',
      width: 279,
    },
    body: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
  });
};
