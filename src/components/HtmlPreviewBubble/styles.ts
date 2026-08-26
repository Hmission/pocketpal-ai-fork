import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

// Plain object (not via StyleSheet.create) because react-syntax-highlighter's
// customStyle is merged with Object.assign — a numeric StyleSheet id won't
// flatten the upstream white PreTag fallback. See MarkdownView for the why.
export const codeHighlighterPreOverride = {
  backgroundColor: 'transparent',
} as const;

export const createStyles = (
  colors: {
    background: string;
    border: string;
    text: string;
    headerBg: string;
    modalOverlay: string;
  },
  theme: Theme,
) =>
  StyleSheet.create({
    container: {
      // alignSelf: 'stretch' makes the bubble fill the cross-axis of its
      // parent (horizontal width in the default column-flex chat row).
      // Without it, the auto-width parent + percentage-width WebView
      // (`collapsedWebView: { width: '100%' }`) hits the classic flexbox
      // "0% of nothing" race: on first layout pass the container shrink-
      // wraps to intrinsic content, the WebView's 100% resolves to that
      // small value, and only a later layout pass (e.g., when the model
      // emits a follow-up text bubble below) gives container a definite
      // width that lets WebView re-measure.
      alignSelf: 'stretch',
      marginVertical: theme.spacing.s,
      marginHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.m,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
      // B56②：6→xs(4)（紧凑顶栏垂直内距）
      paddingVertical: theme.spacing.xs,
      backgroundColor: colors.headerBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    headerButton: {
      // B56②：6→xs(4)（紧凑水平内距）
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
    },
    collapsedWebView: {
      // 基值 480；运行期由 estimatePreviewHeight 按板面高度覆盖
      // （2026-08-19 K90 血证：250 截断 300×300 游戏画面）。
      height: 480,
      width: '100%',
      backgroundColor: colors.background,
    },
    codeSurface: {
      backgroundColor: '#282c34',
    },
    codeInnerScroll: {
      backgroundColor: '#282c34',
    },
    codeContent: {
      padding: theme.spacing.sm,
      minWidth: '100%',
      flexGrow: 1,
    },
    codeText: {
      fontFamily: 'Menlo',
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 16,
      // Default color for any token the highlighter doesn't colorize;
      // atomOneDark lays its own per-token colors on top.
      color: '#abb2bf',
    },
    modalRoot: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.sm,
      backgroundColor: colors.headerBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    closeButton: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      color: colors.text,
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xs,
    },
    modalHeaderButton: {
      marginRight: theme.spacing.s,
    },
    modalWebView: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
