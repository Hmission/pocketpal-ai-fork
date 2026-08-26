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
import {useTheme} from '../../hooks/useTheme';
import {chatSessionStore, modelStore} from '../../store';
import {promptWriter} from '../../services/promptWriter';
import {HeaderLeft} from '../HeaderLeft';
import {
  getModelDisplayName,
  BUTLER_DISPLAY_NAME,
} from '../../utils/modelDisplayNames';

export const ChatHeader: React.FC<{
  onModelPickerPress?: () => void;
}> = observer(({onModelPickerPress}) => {
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
  // 胶囊三档显示链（B18 §16.1，单点决策）：
  // 已加载聊天模型 → 中文简称；仅管家驻场 → 管家名；均未加载 → 选模型。
  // 引擎就绪信息融入胶囊（SessionStatusBar 引擎项已随整行删除）。
  const modelShort = activeModel
    ? getModelDisplayName(activeModel)
    : promptWriter.isLoaded
      ? BUTLER_DISPLAY_NAME
      : '选模型';

  return (
    <View style={styles.wrapper}>
      <View testID="header-view" style={[styles.container, headerStyle]}>
        <View style={styles.leftSection}>
          <HeaderLeft />
          <ChatHeaderTitle />
        </View>
        {/* §18.3：右侧行 gap 6→2，三控件（模型胶囊/新建会话/菜单）收紧为一组 */}
        <View style={styles.rightSection}>
          {/* 模型切换下拉入口：直接出选择器，不跳转模型页
                testID=chat-model-picker-chip：e2e 打开 Pal/模型 Sheet 的唯一定位 */}
          {onModelPickerPress && (
            <TouchableOpacity
              testID="chat-model-picker-chip"
              onPress={onModelPickerPress}
              style={styles.modelPickerChip}>
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
      {/* B18 §17 → §18.2：SessionStatusBar 整行删除——引擎就绪融入胶囊（§16.1），
            上下文余量/落盘/召回/情绪 下沉助手卡 AssistantTurnFooter 统一指标行 */}
    </View>
  );
});
