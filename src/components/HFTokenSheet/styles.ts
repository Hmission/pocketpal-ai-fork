import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      padding: theme.spacing.m,
      paddingBottom: theme.spacing.xl,
    },
    description: {
      marginBottom: theme.spacing.m,
      color: theme.colors.onSurface,
    },
    instructionsContainer: {
      marginBottom: theme.spacing.l,
      backgroundColor: theme.colors.surfaceContainerLow,
      padding: theme.spacing.m,
      borderRadius: theme.radius.s,
    },
    instructionsTitle: {
      fontWeight: 'bold',
      marginBottom: theme.spacing.s,
      color: theme.colors.onSurface,
    },
    instructionItem: {
      // B56②：6→s(8)（周围均为 s(8) 系列指令距）
      marginBottom: theme.spacing.s,
      color: theme.colors.onSurface,
    },
    linkButton: {
      marginTop: theme.spacing.s,
      alignSelf: 'flex-start',
      textDecorationLine: 'underline',
    },
    input: {
      marginBottom: theme.spacing.s,
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    saveButton: {
      flex: 1,
      marginRight: theme.spacing.s,
    },
    resetButton: {
      flex: 1,
      marginLeft: theme.spacing.s,
    },
    errorSnackbar: {
      backgroundColor: theme.colors.errorContainer,
    },
  });
};
