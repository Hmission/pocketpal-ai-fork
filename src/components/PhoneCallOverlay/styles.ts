import {StyleSheet} from 'react-native';

import type {Theme} from '../../utils/types';

/**
 * PhoneCallOverlay v2.1 样式（PHONE_SPEC §11.2）。
 *
 * 三条纪律：①图标全部走 `fill` 着色（DESIGN_SPEC §3 svgr 传参红线）；
 * ②不造「大空圆」——状态改贴边小图标 + 文案行（v2.0 的 88px 空底衬圆被裁）；
 * ③控制区横向一行两钮，caption 在圆钮**下方**（v2.0 把文案塞进固定圆内被裁）。
 * 通话页圆钮（96/64）是英雄级控件尺寸，不入 iconSize/controlHeight token 体系。
 */
export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.surface,
      zIndex: 100,
    },

    // ── ① 联系人区 ──────────────────────────────────────────────
    contactArea: {
      alignItems: 'center',
      paddingTop: 72,
      paddingBottom: theme.spacing.l,
      paddingHorizontal: theme.spacing.xl,
    },
    avatarRing: {
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.m,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.surfaceVariant,
    },
    partnerName: {
      ...theme.typography.titleL,
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: theme.spacing.xs,
    },
    contactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    modelLabel: {
      ...theme.typography.captionS,
      color: theme.colors.primary,
      maxWidth: 200,
    },
    elapsed: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      fontVariant: ['tabular-nums'],
    },

    // ── ② 状态区（贴边状态行 + 对话回显 + 播报通路 + 跑分行）──────
    statusArea: {
      flex: 1,
      paddingHorizontal: theme.spacing.xl,
    },
    dialogArea: {
      width: '100%',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: theme.spacing.s,
      marginBottom: theme.spacing.xs,
    },
    waveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: theme.iconSize.s,
    },
    waveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      marginHorizontal: 3,
    },
    statusLabel: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
    },
    hintText: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: theme.spacing.l,
    },
    lineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.s,
    },
    lineLabel: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      width: 44,
      paddingTop: 3,
    },
    lineContent: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
      flex: 1,
    },
    lineContentMuted: {
      ...theme.typography.bodyM,
      color: theme.colors.primary,
      flex: 1,
    },

    // 播报通路行（§11.3：不可用即给出可点入口，不静默失败）
    ttsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.s,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.surfaceBright,
    },
    ttsText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    ttsTextAction: {
      color: theme.colors.error,
    },

    // ③ 跑分迷你行（PerfMiniRow 复用，默认展开）
    perfRow: {
      width: '100%',
      marginTop: theme.spacing.l,
    },

    // 引擎就绪门控（§10.3）：加载进度
    engineLoadingWrap: {
      alignItems: 'center',
      width: '100%',
    },
    progressTrack: {
      width: 220,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: 'hidden',
      marginTop: theme.spacing.m,
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
    progressStage: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.s,
      textAlign: 'center',
      maxWidth: 280,
    },

    // ── ④ 控制区（横向同一行，同一基线）────────────────────────
    controlArea: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: theme.spacing.xxl,
      paddingBottom: 56,
    },
    controlItem: {
      alignItems: 'center',
      width: 96,
    },
    holdButton: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    holdButtonRecording: {
      backgroundColor: theme.colors.error,
    },
    holdButtonDisabled: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    holdButtonPressed: {
      opacity: 0.85,
    },
    hangupButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 电话图标横置 = 通话结束语义（不另造图标资产）
    hangupGlyph: {
      transform: [{rotate: '135deg'}],
    },
    controlCaption: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.s,
      textAlign: 'center',
    },
    controlCaptionRecording: {
      color: theme.colors.error,
    },
    controlCaptionDisabled: {
      color: theme.colors.onSurfaceDisabled,
    },
  });
