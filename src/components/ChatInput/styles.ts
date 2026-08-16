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
      borderRadius: 100,
    },
    plusButton: {
      height: 28,
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 100,
      opacity: 0.9,
    },
    thinkingToggle: {
      height: 28,
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 100,
      borderWidth: 1,
      marginRight: 8,
    },
    thinkingToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 36, // 与右侧发送/语音按钮统一高度（2026-08 大王裁定）
      borderRadius: 18,
      paddingHorizontal: 12,
      marginLeft: 8,
      // 2026-08-16 去描边（与快捷生图/编辑图标钮统一无描边）：状态靠背景填充色表达，
      // 激活=onSurfaceColor 背景，未激活=透明+灰字；灰色描边冗余（DESIGN_SPEC §1.8 一灰一职）
    },
    thinkingToggleLeftDisabled: {
      backgroundColor: 'transparent',
    },
    thinkingToggleText: {
      fontSize: 12,
      fontWeight: '500',
      marginLeft: 4,
    },
    thinkingToggleTextDisabled: {
      // Dynamic color will be applied via theme
    },
    palSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 13,
      flexShrink: 1,
    },
    input: {
      // legacy fonts 双轨收口（DESIGN_SPEC §8 B1）：输入文本改用 theme.typography.bodyM
      ...theme.typography.bodyM,
      color: theme.colors.inverseOnSurface,
      flex: 1,
      maxHeight: 150,
      paddingVertical: 0,
    },
    marginRight: {
      marginRight: 16,
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'column',
      borderRadius: 12,
      overflow: 'hidden',
    },
    textInputArea: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 12,
    },
    inputDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.outlineVariant,
      marginHorizontal: 24,
    },
    controlBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 6,
      minHeight: 30,
    },
    leftControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    rightControls: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
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
      paddingHorizontal: 12,
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
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 6,
      gap: 6,
    },
    quickPrefixText: {
      color: theme.colors.surface,
      fontWeight: '600' as const,
      fontSize: 12,
    },
    // 快捷生图/编辑图标钮（P5 下沉 controlBar：与语音钮同高基准，触摸友好）
    quickIconBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    inputRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 24,
      paddingVertical: 20,
      marginTop: isEditMode ? 28 : 0,
    },
    palNameWrapper: {
      fontFamily: FONT_FAMILIES.INTER_REGULAR,
      color: theme.colors.inverseOnSurface,
      fontSize: 12,
    },
    palName: {
      fontSize: 12,
      color: theme.colors.inverseOnSurface,
      fontFamily: FONT_FAMILIES.INTER_SEMIBOLD,
    },
    // New compact pal name styles for control bar
    palNameCompact: {
      fontSize: 10,
      fontFamily: FONT_FAMILIES.INTER_REGULAR,
      color: theme.colors.inverseOnSurface,
    },
    palNameValueCompact: {
      fontSize: 10,
      fontFamily: FONT_FAMILIES.INTER_SEMIBOLD,
      color: theme.colors.inverseOnSurface,
    },
    // Image preview styles
    imagePreviewContainer: {
      marginVertical: 8,
      paddingHorizontal: 16,
    },
    imagePreviewContainerEditMode: {
      marginTop: 36, // Account for edit bar height (28px) + extra spacing (8px)
    },
    imageScrollContent: {
      paddingHorizontal: 4,
    },
    imageContainer: {
      marginHorizontal: 4,
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
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
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
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },

    // Compact Video Button (for right side)
    compactVideoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 36, // 与思考胶囊/发送按钮统一高度
      paddingHorizontal: 14,
      borderRadius: 18,
      gap: 6,
      minWidth: 85,
    },
    compactButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    // 语音输入/停止按钮（36px 圆钮，与思考胶囊同一高度基准）
    voiceButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 16,
    },
    // Prompt Label for Video Pals
    promptLabel: {
      marginBottom: 4,
    },
    inputWithLabel: {
      marginTop: 0,
    },
    // Helper text for model not loaded warning
    helperTextContainer: {
      position: 'absolute',
      bottom: '100%',
      right: 0,
      marginBottom: 4,
      backgroundColor: theme.colors.errorContainer,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      maxWidth: 250,
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
      fontSize: 11,
      lineHeight: 14,
    },
  });
