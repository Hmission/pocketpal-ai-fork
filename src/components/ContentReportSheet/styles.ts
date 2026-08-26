import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.m,
      paddingTop: theme.spacing.s,
    },
    section: {
      marginBottom: theme.spacing.l,
    },
    label: {
      marginBottom: theme.spacing.s,
      color: theme.colors.onSurface,
    },
    infoNote: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
    },
    categoryButton: {
      justifyContent: 'flex-start',
    },
    categoryButtonContent: {
      justifyContent: 'space-between',
      flexDirection: 'row-reverse',
    },
    textInput: {
      backgroundColor: theme.colors.surface,
    },
    switchSection: {
      marginBottom: theme.spacing.l,
      paddingVertical: theme.spacing.s,
    },
    switchContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    switchLabel: {
      color: theme.colors.onSurface,
    },
    switchDescription: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
    disabledText: {
      opacity: 0.5,
    },
    button: {},
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: theme.spacing.m,
    },
  });
