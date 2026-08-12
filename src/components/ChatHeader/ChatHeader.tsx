import React from 'react';
import {Platform, View, TouchableOpacity, Text} from 'react-native';
import {observer} from 'mobx-react';

import {createStyles} from './styles';
import {HeaderRight} from '../HeaderRight';
import {ChatHeaderTitle} from '../ChatHeaderTitle';
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {getDefaultHeaderHeight} from '@react-navigation/elements';
import {useTheme} from '../../hooks';
import {chatSessionStore, modelStore} from '../../store';
import {HeaderLeft} from '../HeaderLeft';
import {SessionStatusBar} from '../SessionStatusBar';

export const ChatHeader: React.FC<{onModelPickerPress?: () => void}> = observer(
  ({onModelPickerPress}) => {
  const theme = useTheme();

  const insets = useSafeAreaInsets();
  const layout = useSafeAreaFrame();

  // On models with Dynamic Island the status bar height is smaller than the safe area top inset.
  // https://github.com/react-navigation/react-navigation/blob/e4815c538536ddccf4207b87bf3e2f1603dedd84/packages/elements/src/Header/Header.tsx#L52
  // NOTE: in v7, this is fixed and getDefaultHeaderHeight returns the correct height.

  const hasDynamicIsland = Platform.OS === 'ios' && insets.top > 50;
  const statusBarHeight = hasDynamicIsland ? insets.top - 5 : insets.top;

  const headerHeight = getDefaultHeaderHeight(layout, false, statusBarHeight);

  const styles = createStyles({theme, insets, headerHeight});

  const headerStyle = chatSessionStore?.shouldShowHeaderDivider
    ? styles.headerWithDivider
    : styles.headerWithoutDivider;

  const activeModel = modelStore.activeModel;
  const modelShort = activeModel?.name
    ? activeModel.name.length > 10
      ? `${activeModel.name.slice(0, 10)}…`
      : activeModel.name
    : '选模型';

  return (
    <View style={styles.wrapper}>
      <View testID="header-view" style={[styles.container, headerStyle]}>
        <View style={styles.leftSection}>
          <HeaderLeft />
          <ChatHeaderTitle />
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          {/* 模型切换下拉入口：直接出选择器，不跳转模型页 */}
          {onModelPickerPress && (
            <TouchableOpacity
              onPress={onModelPickerPress}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: theme.colors.surfaceVariant,
              }}>
              <Text style={{fontSize: 11, color: theme.colors.onSurface}}>
                {modelShort} ⌄
              </Text>
            </TouchableOpacity>
          )}
          <HeaderRight />
        </View>
      </View>
      <SessionStatusBar />
    </View>
  );
});
