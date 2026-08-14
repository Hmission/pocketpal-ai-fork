import React from 'react';
import {TouchableOpacity} from 'react-native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {useNavigation, useNavigationState} from '@react-navigation/native';

import {styles} from './styles';
import {ArrowLeftMdIcon, MenuIcon} from '../../assets/icons';
import {useTheme} from '../../hooks';
import {ROUTES} from '../../utils/navigationConstants';

/**
 * HeaderLeft — 三级导航后退逻辑：
 * 可后退且当前非聊天根级 → 渲染后退箭头（goBack 回上一级）；
 * 否则渲染汉堡（openDrawer）。聊天页 headerShown:false 自行处理，不受影响。
 * 路由状态经 useNavigationState 派生（非 Screen 环境 index 为空时退化汉堡）。
 */
export const HeaderLeft: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const navState = useNavigationState(s => s);

  const index = navState?.index ?? -1;
  const routeName = navState?.routes?.[index]?.name;
  const canGoBack = index > 0 && routeName !== ROUTES.CHAT;

  if (canGoBack) {
    return (
      <TouchableOpacity
        style={[styles.menuIcon]}
        testID="header-back-button"
        accessibilityLabel="Go back"
        onPress={() => navigation.goBack()}>
        <ArrowLeftMdIcon stroke={theme.colors.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.menuIcon]}
      testID="menu-button"
      accessibilityLabel="Open drawer"
      onPress={() => navigation.openDrawer()}>
      <MenuIcon stroke={theme.colors.primary} />
    </TouchableOpacity>
  );
};
