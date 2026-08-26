import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

import {withOpacity} from '../../utils/colorUtils';

// B56②颜色迁移（DESIGN_SPEC §1.6）：遮罩 rgba 族 → scrim/outlineVariant；
// 全屏豁免（§12.6）：容器实黑底 #000 与深色控件上恒定白前景 #fff 为全屏
// 查看器语义（scrim/backdrop 为半透明、shadow token dark 绑定白不可用），
// 逐处保留字面量并登记评审清单。
export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      // 全屏查看器实黑底（B56②全屏豁免，登记评审清单）
      backgroundColor: '#000',
      overflow: 'hidden',
      zIndex: 1,
      // B58：flex-end 流式——控件组贴底单锚点（原三层 absolute 混合 %/px 锚
      // 在短屏/高屏下层距漂移），层距用 spacing token
      justifyContent: 'flex-end',
    },
    camera: {
      flex: 1,
    },
    controlsContainer: {
      // B58：流式（原 absolute bottom '5%'）——最底控件组，底部留 l 档余量
      alignSelf: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.spacing.ml, // Space between close and flip buttons
      marginBottom: theme.spacing.l,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.l,
      backgroundColor: withOpacity(theme.colors.scrim, 0.5),
      borderWidth: 1,
      // B56②：白边 → outlineVariant 0.2（§1.6 边框灰；outline 为 5% ink 近透明直映隐形）
      borderColor: withOpacity(theme.colors.outlineVariant, 0.2),
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonIcon: {
      // 全屏豁免：深色钮上恒定白前景（B56②登记）
      color: '#fff',
      fontSize: 20,
    },
    flipButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.l,
      backgroundColor: withOpacity(theme.colors.scrim, 0.5),
      borderWidth: 1,
      // B56②：白边 → outlineVariant 0.2（同上）
      borderColor: withOpacity(theme.colors.outlineVariant, 0.2),
      justifyContent: 'center',
      alignItems: 'center',
    },
    flipButtonIcon: {
      // 全屏豁免：深色钮上恒定白前景（B56②登记）
      color: '#fff',
      fontSize: 20,
    },
    permissionContainer: {
      height: 250,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.m,
      marginHorizontal: theme.spacing.m,
      marginVertical: theme.spacing.s,
      zIndex: 1,
    },
    permissionText: {
      color: theme.colors.onBackground,
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      marginBottom: theme.spacing.ml,
      textAlign: 'center',
      paddingHorizontal: theme.spacing.ml,
    },
    intervalControlsContainer: {
      // B58：流式（原 absolute bottom '11%'）——controls 之上，间距 m 档
      alignSelf: 'center',
      width: '50%', // Take up 50% of screen width
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
      backgroundColor: withOpacity(theme.colors.scrim, 0.5),
      // B56②：胶囊意图（高度≈42 半高 21≈25）→ full
      borderRadius: theme.radius.full,
      borderWidth: 1,
      // B56②：白边 → outlineVariant 0.2（同上）
      borderColor: withOpacity(theme.colors.outlineVariant, 0.2),
      marginBottom: theme.spacing.m,
    },
    intervalLabel: {
      // 全屏豁免：深色控条上恒定白前景（B56②登记）
      color: '#fff',
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      marginRight: theme.spacing.xs,
      fontWeight: '500',
      textShadowColor: withOpacity(theme.colors.scrim, 0.5),
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 1,
    },
    intervalValue: {
      // 全屏豁免：深色控条上恒定白前景（B56②登记）
      color: '#fff',
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      marginHorizontal: theme.spacing.s,
      minWidth: 40,
      textAlign: 'center',
      fontWeight: '600',
      textShadowColor: withOpacity(theme.colors.scrim, 0.5),
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 1,
    },
    intervalButton: {
      width: 26,
      height: 26,
      // B56②：26px 圆钮（height/2=13）→ full（同 28px icon 钮 100→full 裁定）
      borderRadius: theme.radius.full,
      backgroundColor: withOpacity(theme.colors.scrim, 0.5),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      // B56②：白边 → outlineVariant 0.2（同上）
      borderColor: withOpacity(theme.colors.outlineVariant, 0.2),
    },
    intervalButtonText: {
      // 全屏豁免：深色钮上恒定白前景（B56②登记）
      color: '#fff',
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: 'bold',
    },
    responseOverlayContainer: {
      // B58：流式（原 absolute bottom:180 + left/right:16）——最上层，
      // stretch 保证宽度 = 父宽 - 左右 m 档边距（width 100% + margin 会溢出）
      alignSelf: 'stretch',
      maxHeight: '40%',
      marginHorizontal: theme.spacing.m,
      marginBottom: theme.spacing.m,
    },
    responseText: {
      // 全屏豁免：深色表面上恒定白前景（B56②登记）
      color: '#fff',
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      lineHeight: 22,
      fontWeight: '400',
    },
  });
