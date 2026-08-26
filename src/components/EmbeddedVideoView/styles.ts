import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
      gap: 20, // Space between close and flip buttons
      marginBottom: theme.spacing.l,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonIcon: {
      color: '#fff',
      fontSize: 20,
    },
    flipButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    flipButtonIcon: {
      color: '#fff',
      fontSize: 20,
    },
    permissionContainer: {
      height: 250,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 8,
      zIndex: 1,
    },
    permissionText: {
      color: theme.colors.onBackground,
      fontSize: 16,
      marginBottom: 20,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    intervalControlsContainer: {
      // B58：流式（原 absolute bottom '11%'）——controls 之上，间距 m 档
      alignSelf: 'center',
      width: '50%', // Take up 50% of screen width
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 25, // Make it oval-shaped
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      marginBottom: theme.spacing.m,
    },
    intervalLabel: {
      color: '#fff',
      fontSize: 11,
      marginRight: 4,
      fontWeight: '500',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 1,
    },
    intervalValue: {
      color: '#fff',
      fontSize: 12,
      marginHorizontal: 8,
      minWidth: 40,
      textAlign: 'center',
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: 1,
    },
    intervalButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    intervalButtonText: {
      color: '#fff',
      fontSize: 14,
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
      color: '#fff',
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '400',
    },
  });
