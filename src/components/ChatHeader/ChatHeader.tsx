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
import {getModelDisplayName} from '../../utils/modelDisplayNames';
import {withOpacity} from '../../utils/colorUtils';

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
    // 模型名用中文简称（modelDisplayNames 注册表，与弹窗/徽章共用单一事实源）
    const modelShort = activeModel
      ? getModelDisplayName(activeModel)
      : '选模型';

    return (
      <View style={styles.wrapper}>
        <View testID="header-view" style={[styles.container, headerStyle]}>
          <View style={styles.leftSection}>
            <HeaderLeft />
            <ChatHeaderTitle />
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            {/* 模型切换下拉入口：直接出选择器，不跳转模型页
                testID=chat-model-picker-chip：e2e 打开 Pal/模型 Sheet 的唯一定位 */}
            {onModelPickerPress && (
              <TouchableOpacity
                testID="chat-model-picker-chip"
                onPress={onModelPickerPress}
                style={{
                  paddingHorizontal: theme.spacing.s,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radius[theme.shapeRoles.pill],
                  // 灰色治理（DESIGN_SPEC §1.8）：模型 chip 从 surfaceVariant 改为域彩 12% 底
                  backgroundColor: withOpacity(theme.colors.primary, 0.12),
                }}>
                <Text
                  style={{
                    ...theme.typography.captionS,
                    color: theme.colors.primary,
                  }}>
                  {modelShort} ⌄
                </Text>
              </TouchableOpacity>
            )}
            {/* [已裁剪 2026-08] 头部生图入口（CameraIcon imagegen-button）：
                大王裁定收敛至抽屉 drawer-imagegen-button 唯一入口，聊天内生图
                走输入框意图闭环（useChatScheduler）。恢复见 git 历史。 */}
            <HeaderRight />
          </View>
        </View>
        <SessionStatusBar />
      </View>
    );
  },
);
