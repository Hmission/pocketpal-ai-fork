import {StyleSheet} from 'react-native';

import type {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.surface,
      zIndex: 100,
    },
    // ① 联系人区（打电话仪式）
    contactArea: {
      alignItems: 'center',
      paddingTop: 72,
      paddingBottom: 12,
      paddingHorizontal: 24,
    },
    avatarRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...theme.typography.titleL,
      color: theme.colors.onPrimary,
      fontWeight: '600',
    },
    partnerName: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: 6,
    },
    contactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modelLabel: {
      ...theme.typography.captionS,
      color: theme.colors.primary,
      maxWidth: 200,
    },
    elapsed: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
    // ② 状态区
    statusArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    statusIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    statusIconWrapRecording: {
      backgroundColor: theme.colors.errorContainer,
    },
    waveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 88,
      marginBottom: 16,
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
      marginBottom: 10,
      textAlign: 'center',
    },
    transcript: {
      ...theme.typography.bodyM,
      color: theme.colors.primary,
      textAlign: 'center',
      maxWidth: 300,
      marginBottom: 8,
    },
    recentText: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      maxWidth: 300,
    },
    // ③ 跑分迷你行（PerfMiniRow 复用）
    perfRow: {
      width: '100%',
      marginTop: 18,
      paddingHorizontal: 12,
    },
    // 引擎就绪门控（§10.3）：加载进度
    engineLoadingWrap: {
      alignItems: 'center',
      width: '100%',
    },
    waveRowSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 24,
    },
    waveDotSmall: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
      marginHorizontal: 4,
    },
    progressTrack: {
      width: 220,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: 'hidden',
      marginTop: 12,
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
    progressStage: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      textAlign: 'center',
      maxWidth: 280,
    },
    // ④ 控制区
    controlArea: {
      alignItems: 'center',
      paddingBottom: 56,
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
    holdButtonDisabled: {
      backgroundColor: theme.colors.surfaceVariant,
      opacity: 0.9,
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
    holdLabelDisabled: {
      color: theme.colors.onSurfaceDisabled,
    },
    hangUpBtn: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: theme.colors.error,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hangUpLabel: {
      ...theme.typography.captionM,
      color: theme.colors.onError,
    },
    // 右上角收起
    closeBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceVariant,
    },
  });
