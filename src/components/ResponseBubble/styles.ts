import {StyleSheet, Platform} from 'react-native';

import {Theme} from '../../utils/types';

import {withOpacity} from '../../utils/colorUtils';

// B56②颜色迁移（DESIGN_SPEC §1.6）：深色气泡 rgba 遮罩/边框 → scrim/outlineVariant；
// 豁免登记：①shadowColor 保持字面量（shadow token dark 绑定 #fff 不适配深色泡）；
// ②maskSolid 实黑底（scrim 半透明不适用）；③chevronIndicator 深色面上白线。
export const createStyles = (theme: Theme) => {
  // Colors
  const bubbleBackground = withOpacity(theme.colors.scrim, 0.7);
  // B56②：白边 → outlineVariant 0.2（§1.6 边框灰；outline 为 5% ink 近透明直映隐形）
  const bubbleBorderColor = withOpacity(theme.colors.outlineVariant, 0.2);
  // iOS 阴影色：#000 保持字面量（B56②豁免：shadow token dark 绑定白不适配深色泡，登记评审）
  const shadowColor = '#000';

  return StyleSheet.create({
    shadowContainer: {
      ...Platform.select({
        ios: {
          shadowColor: shadowColor,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.4,
          shadowRadius: 12,
        },
        android: {
          // No need here, shadows come from elevation in the inner container
        },
      }),
    },
    container: {
      borderRadius: theme.radius.ml,
      overflow: 'hidden',
      backgroundColor: bubbleBackground,
      borderWidth: 1,
      borderColor: bubbleBorderColor,
      ...Platform.select({
        ios: {
          // No need here, shadows come from parent container
        },
        android: {
          elevation: 8,
        },
      }),
    },
    partialContainer: {
      maxHeight: 120, // Limited height for partial view
    },
    expandedContainer: {
      // Full height for expanded view
    },
    contentContainer: {
      padding: theme.spacing.m,
      paddingBottom: theme.spacing.xxl, // Extra padding at bottom for indicator and to ensure content is visible
    },
    contentContainerStyle: {
      flexGrow: 1, // Allow content to grow and enable proper scrolling
    },
    maskedContentContainer: {
      height: 120, // Match the partialContainer maxHeight
    },
    maskElementContainer: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    maskGradient: {
      height: 40, // Height of the fade effect
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    maskSolid: {
      flex: 1,
      // 实黑遮罩底（B56②豁免：scrim 半透明不适用，登记评审）
      backgroundColor: 'black',
      marginTop: theme.spacing.xxl, // Match the maskGradient height
    },
    indicatorContainer: {
      position: 'absolute',
      bottom: theme.spacing.xs,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      height: 20,
    },
    chevronContainer: {
      width: 30,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevronIndicator: {
      width: 36,
      height: 4,
      borderRadius: theme.radius.xxs,
      // 深色泡上白指示线（B56②豁免：无亮色线 token，登记评审）
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
  });
};

export default createStyles;
