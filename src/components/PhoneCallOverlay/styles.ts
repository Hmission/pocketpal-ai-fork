import {StyleSheet} from 'react-native';

import type {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.surface,
      zIndex: 100,
      paddingHorizontal: 24,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 16,
      paddingBottom: 8,
    },
    topInfo: {
      flex: 1,
      marginRight: 12,
    },
    partnerName: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
    },
    modelLabel: {
      ...theme.typography.captionS,
      color: theme.colors.primary,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceVariant,
    },
    statusArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    statusIconWrapRecording: {
      backgroundColor: theme.colors.errorContainer,
    },
    waveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 88,
      marginBottom: 20,
    },
    waveDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.colors.primary,
      marginHorizontal: 5,
    },
    statusLabel: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
      marginBottom: 12,
    },
    recentText: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      maxWidth: 280,
    },
    controlArea: {
      alignItems: 'center',
      paddingBottom: 48,
    },
    holdButton: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    holdButtonRecording: {
      backgroundColor: theme.colors.error,
    },
    holdButtonPressed: {
      opacity: 0.85,
      transform: [{scale: 0.97}],
    },
    holdLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onPrimary,
      marginTop: 6,
      textAlign: 'center',
    },
    holdLabelRecording: {
      color: theme.colors.onError,
    },
    hangUpBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: theme.colors.surfaceVariant,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hangUpLabel: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
  });
