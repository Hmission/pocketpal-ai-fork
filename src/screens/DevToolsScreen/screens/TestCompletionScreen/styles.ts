import {StyleSheet} from 'react-native';

import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    card: {
      margin: theme.spacing.m,
      backgroundColor: theme.colors.surface,
    },
    title: {
      marginBottom: theme.spacing.m,
      textAlign: 'center',
    },
    modelSelectorContent: {
      width: '100%',
      justifyContent: 'flex-start',
      marginBottom: theme.spacing.m,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.ml,
    },
    loadingText: {
      // B56②：10→sm(12)（外层距）
      marginTop: theme.spacing.sm,
      color: theme.colors.onSurfaceVariant,
    },
    warning: {
      color: theme.colors.error,
      textAlign: 'center',
      marginVertical: theme.spacing.ml,
    },
    optionsHeader: {
      fontWeight: 'bold',
      marginTop: theme.spacing.m,
      marginBottom: theme.spacing.s,
    },
    radioItem: {
      paddingVertical: 0,
    },
    radioLabel: {
      textAlign: 'left',
    },
    testDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.bodyS.fontSize,
      marginBottom: theme.spacing.sm,
    },
    optionsCard: {
      marginVertical: theme.spacing.sm,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.radius.s,
    },
    optionBlock: {
      marginBottom: theme.spacing.sm,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    nPredictInput: {
      width: 100,
      height: 40,
    },
    runButton: {
      marginTop: theme.spacing.s,
    },
    resultsContainer: {
      marginTop: theme.spacing.m,
    },
    resultCard: {
      marginBottom: theme.spacing.m,
    },
    resultText: {
      fontFamily: 'monospace',
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      lineHeight: 20,
    },
    streamingText: {
      fontFamily: 'monospace',
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      lineHeight: 20,
      // B56②：10→sm(12)（外层距）
      marginTop: theme.spacing.sm,
    },
    errorText: {
      color: theme.colors.error,
      fontFamily: 'monospace',
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
    },
    divider: {
      marginVertical: theme.spacing.sm,
    },
    sectionTitle: {
      fontWeight: 'bold',
      marginBottom: theme.spacing.s,
    },
    codeBlock: {
      fontFamily: 'monospace',
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      backgroundColor: theme.colors.surfaceVariant,
      padding: theme.spacing.s,
      borderRadius: theme.radius.xs,
    },
    testOptionsContainer: {
      marginVertical: theme.spacing.sm,
      padding: theme.spacing.s,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.radius.s,
    },
    optionLabel: {
      marginBottom: theme.spacing.s,
      fontWeight: 'bold',
    },
    jinjaOption: {
      marginTop: theme.spacing.sm,
    },
  });
