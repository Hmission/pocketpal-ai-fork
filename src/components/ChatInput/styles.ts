import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';
import {FONT_FAMILIES} from '../../theme/tokens';

export const createStyles = ({
  theme,
  isEditMode,
}: {
  theme: Theme;
  isEditMode: boolean;
}) =>
  StyleSheet.create({
    container: {
      flexDirection: 'column',
    },
    palBtn: {
      height: 28,
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      // B56②：28px icon 钮 → full（胶囊意图）
      borderRadius: theme.radius.full,
    },
    plusButton: {
      height: 28,
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      // B56②：28px icon 钮 → full（胶囊意图）
      borderRadius: theme.radius.full,
      opacity: 0.9,
    },
    thinkingToggle: {
      height: 28,
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      // B56②：28px icon 钮 → full（胶囊意图）
      borderRadius: theme.radius.full,
      borderWidth: 1,
      marginRight: theme.spacing.s,
    },
    thinkingToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // B18 §17：胶囊 36→24px（与两边 28px 图标钮视觉同量级，不再凸出）；
      // 行基线仍 36，触区由 hitSlop 上下各 +6 补齐（ChatInput 单点）。
      height: 24,
      borderRadius: theme.radius.m,
      paddingHorizontal: theme.spacing.sm,
      marginLeft: theme.spacing.s,
      // 2026-08-16 去描边（与快捷生图/编辑图标钮统一无描边）：状态靠背景填充色表达，
      // 激活=onSurfaceColor 背景，未激活=透明+灰字；灰色描边冗余（DESIGN_SPEC §1.8 一灰一职）
    },
    thinkingToggleLeftDisabled: {
      backgroundColor: 'transparent',
    },
    thinkingToggleText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '500',
      marginLeft: theme.spacing.xs,
    },
    thinkingToggleTextDisabled: {
      // Dynamic color will be applied via theme
    },
    palSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      // B56②：13→sm(12)（行内紧凑）
      gap: theme.spacing.sm,
      flexShrink: 1,
    },
    input: {
      // legacy fonts 双轨收口（DESIGN_SPEC §8 B1）：输入文本改用 theme.typography.bodyM
      ...theme.typography.bodyM,
      color: theme.colors.inverseOnSurface,
      flex: 1,
      // R2 裁定：输入高度上限（防无限增高）非底缘留白——归尺寸域豁免，本批不改值
      maxHeight: 150,
      paddingVertical: 0,
    },
    marginRight: {
      marginRight: theme.spacing.m,
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'column',
      borderRadius: theme.radius.m,
      overflow: 'hidden',
    },
    textInputArea: {
      flex: 1,
      paddingHorizontal: theme.spacing.l,
      paddingTop: theme.spacing.l,
      paddingBottom: theme.spacing.sm,
    },
    inputDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.outlineVariant,
      marginHorizontal: theme.spacing.l,
    },
    controlBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.l,
      // B56②：6→xs(4)（紧凑条）
      paddingVertical: theme.spacing.xs,
      minHeight: 30,
    },
    leftControls: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：10→sm(12)（水平性；可 s(8) 与 rightControls 对齐，取水平性档）
      gap: theme.spacing.sm,
      flex: 1,
    },
    rightControls: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      // §18.4 发送/停止/语音钮同基准间距（去按钮 marginLeft 后由容器控制）
      gap: theme.spacing.s,
    },
    editBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      // 灰色治理（DESIGN_SPEC §1.8）：编辑栏降为 surface + 描边，不再占用 surfaceVariant
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
      borderTopLeftRadius: theme.radius.ml,
      borderTopRightRadius: theme.radius.ml,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
      zIndex: 10, // Ensure edit bar stays above other elements
    },
    editBarText: {
      color: theme.colors.onSurfaceVariant,
    },
    editBarButton: {
      margin: 0,
    },
    // 快捷前缀标签（P5 v3 图标语义）：primary 彩底 + 白字 + ×；整体删除（不进 value/模型）
    quickPrefixChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.s,
      // B56②：10→sm(12)（水平性）/ 6→xs(4)、1→（紧凑 chip 内距）
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    quickPrefixText: {
      color: theme.colors.surface,
      fontWeight: '600' as const,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
    },
    // 快捷生图/编辑图标钮（P5 下沉 controlBar：与语音钮同高基准，触摸友好）
    quickIconBtn: {
      width: theme.size.controlHeight,
      height: theme.size.controlHeight,
      alignItems: 'center',
      justifyContent: 'center',
      // B56②：36px 圆钮半高 18 → full
      borderRadius: theme.radius.full,
    },
    // busy 禁用态：降透明示不可点（与生图页动作条同语义）
    quickIconBtnBusy: {
      opacity: 0.4,
    },
    inputRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: theme.spacing.l,
      paddingVertical: theme.spacing.ml,
      marginTop: isEditMode ? 28 : 0,
    },
    palNameWrapper: {
      fontFamily: FONT_FAMILIES.INTER_REGULAR,
      color: theme.colors.inverseOnSurface,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
    },
    palName: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.inverseOnSurface,
      fontFamily: FONT_FAMILIES.INTER_SEMIBOLD,
    },
    // New compact pal name styles for control bar
    palNameCompact: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontFamily: FONT_FAMILIES.INTER_REGULAR,
      color: theme.colors.inverseOnSurface,
    },
    palNameValueCompact: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontFamily: FONT_FAMILIES.INTER_SEMIBOLD,
      color: theme.colors.inverseOnSurface,
    },
    // Image preview styles
    imagePreviewContainer: {
      marginVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.m,
    },
    imagePreviewContainerEditMode: {
      marginTop: 36, // Account for edit bar height (28px) + extra spacing (8px)
    },
    imageScrollContent: {
      paddingHorizontal: theme.spacing.xs,
    },
    imageContainer: {
      marginHorizontal: theme.spacing.xs,
      position: 'relative',
    },
    previewImage: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.surface,
    },
    removeImageButton: {
      position: 'absolute',
      top: 0,
      right: 0,
      margin: 0,
      padding: 0,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.s,
      width: 25,
      height: 25,
    },
    inputInnerContainer: {
      flexShrink: 1,
      flexGrow: 1,
    },
    // Camera-specific styles
    cameraButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.l, // B56① radius 不扩档（镜像 Figma 量表），原值 24 归 l 档
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.s,
      // B56②豁免：shadow token dark 绑定白不适配（登记评审）
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },

    stopButton: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.l, // B56① radius 不扩档（镜像 Figma 量表），原值 24 归 l 档
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.s,
    },

    // Compact Video Button (for right side)
    compactVideoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // R1：controlHeight 基线（原 36）
      height: theme.size.controlHeight, // 与思考胶囊/发送按钮统一高度
      // B56②：14→sm(12)（行内）/ 18→full（36px 胶囊）/ 6→xs(4)（紧凑）
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.full,
      gap: theme.spacing.xs,
      minWidth: 85,
    },
    compactButtonText: {
      // 彩色底（primary/danger）白字：无单一 onX token（onPrimary 深棕）——B56②登记评审
      color: 'white',
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '600',
    },
    // 语音输入/停止按钮（36px 圆钮，与思考胶囊同一高度基准）
    voiceButton: {
      width: theme.size.controlHeight,
      height: theme.size.controlHeight,
      // B56②：36px 圆钮半高 18 → full
      borderRadius: theme.radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: theme.spacing.m,
    },
    // Prompt Label for Video Pals
    promptLabel: {
      marginBottom: theme.spacing.xs,
    },
    inputWithLabel: {
      marginTop: 0,
    },
    // Helper text for model not loaded warning
    helperTextContainer: {
      position: 'absolute',
      bottom: '100%',
      right: 0,
      marginBottom: theme.spacing.xs,
      backgroundColor: theme.colors.errorContainer,
      paddingHorizontal: theme.spacing.sm,
      // B56②：6→xs(4)（气泡内距）
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.s,
      maxWidth: 250,
      // B56②豁免：shadow token dark 绑定白不适配（登记评审）
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3,
    },
    helperText: {
      color: theme.colors.onErrorContainer,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
    },
  });
