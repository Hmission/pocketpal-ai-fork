import {StyleSheet} from 'react-native';

import type {Theme} from '../../utils/types';
import {withOpacity} from '../../utils/colorUtils';

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
      // v2.4 对话流版（§14.1）：状态行 + 对话流（flex:1）+ 播报行 + 跑分行
      flex: 1,
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
    // 声波柱（v2.2，§11.5）：录音/播报期三根呼吸柱（高度由 Animated 插值驱动）；
    // 静态不等高三柱 = 无真实数据源的窗口（聆听/转写），不造假跳动。
    waveWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 30,
      gap: theme.spacing.xs,
    },
    waveBar: {
      width: 4,
      borderRadius: 2,
    },
    waveBarTall: {
      width: 5,
    },
    ambientBar: {
      width: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.outline,
    },
    ambientBar1: {
      height: 10,
    },
    ambientBar2: {
      height: 18,
    },
    ambientBar3: {
      height: 13,
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
    // 对话流（§14.1）：全文铺满，伙伴句深色主读 / 我说浅色（豆包同构，不用气泡）
    conversation: {
      flex: 1,
      width: '100%',
      marginTop: theme.spacing.l,
    },
    conversationContent: {
      paddingVertical: theme.spacing.s,
    },
    conversationLine: {
      ...theme.typography.bodyM,
      marginBottom: theme.spacing.m,
      lineHeight: 24,
    },
    conversationPartner: {
      color: theme.colors.onSurface,
    },
    conversationMe: {
      color: theme.colors.onSurfaceVariant,
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
      // v2.2 定案（大王复测：两钮离得太近会误触）：挂断居左 / 按住说话居右，
      // space-between + xl 边距分居两侧——400dp 屏上两钮圆心相距 ~240dp。
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: 56,
    },
    // 两钮**同尺寸**（v2.3，大王：「按住说话比挂断大好多」；参豆包：
    // 通话页所有圆钮等大，靠颜色/图标区分语义，不靠尺寸做视觉等级）。
    controlItem: {
      alignItems: 'center',
      width: 72,
    },
    holdButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      // 大王报障：实心大圆 + 反白图标与全局「线条为主」的图标语言不符。
      // 底衬改为本仓已有的「域彩 12% 底 + 1px 同色描边」（与 ChatHeader.modelPickerChip、
      // 抽屉搜索框聚焦态同一设计语言，不另造一套）；72dp 等大与左右分居
      // 保持 v2.2/v2.3 裁定不动（靠颜色/图标区分语义，不靠尺寸做视觉等级）。
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
      borderWidth: 1,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    holdButtonRecording: {
      backgroundColor: withOpacity(theme.colors.error, 0.12),
      borderColor: theme.colors.error,
    },
    holdButtonDisabled: {
      backgroundColor: withOpacity(theme.colors.outline, 0.12),
      borderColor: theme.colors.outline,
    },
    holdButtonPressed: {
      opacity: 0.85,
    },
    hangupButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      // 同 holdButton：域彩 12% 底 + 1px 描边，图标走 error 线条（不再反白）。
      backgroundColor: withOpacity(theme.colors.error, 0.12),
      borderWidth: 1,
      borderColor: theme.colors.error,
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
