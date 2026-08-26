import {StyleSheet} from 'react-native';
import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      height: 46,
      backgroundColor: 'transparent',
      paddingRight: theme.spacing.m,
      paddingLeft: theme.spacing.m,
      maxWidth: 'auto',
    },
    leadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    contentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      // B56②：10→sm(12)（水平性内外距）
      marginLeft: theme.spacing.sm,
      marginRight: theme.spacing.sm,
      maxWidth: 'auto',
      flexGrow: 1,
    },
    noLeadingIcon: {
      marginLeft: 0,
    },
    noTrailingIcon: {
      marginRight: 0,
    },
    label: {
      ...theme.fonts.titleSmall,
      textAlign: 'left',
      paddingLeft: 0,
    },
    labelDisabled: {
      opacity: 0.5,
    },
    itemDisabled: {
      opacity: 0.5,
    },
    trailingContainer: {
      alignItems: 'flex-end',
    },
    groupLabel: {
      paddingTop: theme.spacing.sm,
      opacity: 0.5,
    },
    activeParent: {
      backgroundColor: theme.colors.menuBackgroundActive,
    },
  });
