import {Platform, StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.m,
      paddingBottom: theme.spacing.xl,
    },

    // Engine logo (used by EngineLogo)
    engineLogoCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    engineLogoHalo: {
      position: 'absolute',
      left: -4,
      top: -4,
      opacity: 0.35,
    },
    engineLogoSurface: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    engineLogoSystemBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      // B56②：系统徽章面板底 → surfaceVariant（§1.6 #f5f5f5/#e8e8e8→surfaceVariant 近值；
      // 原 iOS #F1F2F5 / Android #E8F0E8 两分支归一）
      backgroundColor: theme.colors.surfaceVariant,
    },
    engineLogoSystemBadgeDot: {
      width: 10,
      height: 10,
      borderRadius: theme.radius.full,
      // B56②豁免：系统徽章语义色（iOS 深黑点/Android 品牌绿 #3DDC84 无 token），登记评审
      backgroundColor: Platform.OS === 'ios' ? '#1A1A1A' : '#3DDC84',
    },

    // Engine groups (used by VoicePickerView)
    engineGroup: {
      marginBottom: theme.spacing.m,
      borderRadius: theme.radius.ml,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    engineGroupGradientFill: {
      borderRadius: theme.radius.ml,
    },
    engineGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      // B56②：14→sm(12)（行内紧凑）
      paddingHorizontal: theme.spacing.sm,
    },
    engineGroupHeaderText: {
      flex: 1,
      paddingHorizontal: theme.spacing.sm,
    },
    engineGroupTitle: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    engineGroupTier: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: theme.spacing.xxs,
    },
    engineGroupSpecs: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.2,
      // B56②：1→xxs(2)（细距）
      marginTop: theme.spacing.xxs,
    },
    engineGroupDeleteBtn: {
      margin: 0,
    },
    engineGroupChevron: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: theme.spacing.xs,
    },
    engineGroupChevronExpanded: {
      transform: [{rotate: '90deg'}],
    },
    engineGroupBody: {
      // B56②：14→sm(12)（行内紧凑）
      paddingHorizontal: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
    },
    engineGroupCta: {
      borderRadius: theme.radius.m,
    },
    engineGroupCtaLabel: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    engineGroupProgressText: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.bodyS.fontSize,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.2,
      paddingVertical: theme.spacing.s,
    },
    engineGroupErrorText: {
      color: theme.colors.error,
      fontSize: theme.typography.captionM.fontSize, // B56③ 12.5→captionM(12)
      lineHeight: 17,
      // B56②：10→sm(12)（段落距/外层距）
      marginBottom: theme.spacing.sm,
    },
    engineGroupHintText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      lineHeight: 16,
      opacity: 0.7,
    },
    engineGroupEmpty: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ 12.5→captionM(12)
      fontStyle: 'italic',
      paddingVertical: theme.spacing.s,
    },
    engineGroupTagline: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ 12.5→captionM(12)
      lineHeight: 18,
      marginBottom: theme.spacing.sm,
    },

    // Hero row (used by HeroRow)
    heroRow: {
      // B56②：14→m(16)（页卡内边距/块距）
      padding: theme.spacing.m,
      marginBottom: theme.spacing.m,
      borderRadius: theme.radius.ml,
      borderWidth: 1,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    heroRowBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroAvatarWrap: {
      // B56②：14→sm(12)（行内水平距）
      marginRight: theme.spacing.sm,
    },
    heroRowMain: {
      flex: 1,
      paddingRight: theme.spacing.sm,
    },
    heroRowName: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.displayS.fontSize, // B56③ 26→displayS(28)，非 4pt 值归就近档（差 2）
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    heroSubtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '600',
      marginTop: theme.spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroPreviewButton: {
      margin: 0,
    },
    heroQualityBlock: {
      // B56②：14→m(16)（卡内块距）
      marginTop: theme.spacing.m,
      paddingHorizontal: theme.spacing.xxs,
    },
    heroQualityLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: theme.spacing.s,
    },
    heroLanguageWrap: {
      // B56②：14→m(16)（卡内块距）
      marginTop: theme.spacing.m,
    },
    heroLanguageTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: theme.size.minTapTarget,
      // B56②：14→sm(12)（触发器行内内边距）
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.m,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surface,
    },
    heroLanguageTriggerLabel: {
      flex: 1,
      color: theme.colors.onSurface,
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      paddingRight: theme.spacing.s,
    },

    // Voice rows (used by VoicePickerView)
    voiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
      paddingLeft: theme.spacing.xs,
      paddingRight: theme.spacing.xs,
      minHeight: 48,
    },
    voiceRowLabelBlock: {
      flex: 1,
      paddingLeft: theme.spacing.s,
      paddingRight: theme.spacing.s,
    },
    voiceRowPreviewBtn: {
      margin: 0,
    },
    voiceRowName: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '500',
    },
    voiceRowNameSelected: {
      fontWeight: '700',
    },

    voicesEmptyHint: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ 12.5→captionM(12)
      lineHeight: 18,
      marginBottom: theme.spacing.m,
      paddingHorizontal: theme.spacing.xs,
    },

    // Primary settings rows (used by AutoSpeakRow)
    primaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // B56②：14→sm(12)（设置行垂直内缩）
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
      // R5 裁定：52→56 对齐 DESIGN_SPEC §2.4 列表行高规范（行组件行高 56）
      minHeight: 56,
    },
    primaryRowLabelBlock: {
      flex: 1,
      paddingRight: theme.spacing.sm,
    },
    primaryRowLabel: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
    },
    primaryRowDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      marginTop: theme.spacing.xxs,
    },
  });
