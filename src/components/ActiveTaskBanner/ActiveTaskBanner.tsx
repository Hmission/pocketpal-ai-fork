/**
 * ActiveTaskBanner — 聊天窗口内的引擎任务横幅（调度叙事的可见面）
 *
 * 观察 engineStatus.busy：有引擎在 加载/运行/出错 时，在聊天区顶部显示
 * 一条 slim 横幅（引擎名 + 阶段 + 进度），出错时提供 重试/去生图页。
 * 空闲时渲染 null——不占空间、不臃肿。
 *
 * 数据源唯一：engineStatus（promptWriter / imageGenStore 写入）。
 * 渲染底座：ui/BannerBar（DESIGN_SPEC §12.3，tools 域色变体）。
 */
import * as React from 'react';
import {ActivityIndicator} from 'react-native';
import {observer} from 'mobx-react';
import {useNavigation} from '@react-navigation/native';

import {BannerBar} from '../ui/BannerBar';
import {AlertTriangleMdIcon, SettingsMdIcon} from '../../assets/icons';
import {engineStatus, EngineKind} from '../../store/engineStatus';
import {imageGenStore} from '../../store/imageGenStore';
import {ROUTES} from '../../utils/navigationConstants';
import {useTheme} from '../../hooks';

const ENGINE_NAME: Record<EngineKind, string> = {
  prompter: '管家模型',
  chat: '对话模型',
  image: '生图引擎',
};

export const ActiveTaskBanner: React.FC = observer(() => {
  const navigation = useNavigation();
  const theme = useTheme();
  const busy = engineStatus.busy;
  // 聊天内联生图：顶部横幅隐藏——生成动效已在任务卡片内全程可见（
  // ImageTaskProgress），避免「卡片动效 + 横幅」双提示；
  // 其它引擎任务（加载大模型/生图页出图等）仍走横幅。
  if (busy === 'image' && imageGenStore.chatInlineGenerating) {
    return null;
  }
  if (!busy) {
    return null;
  }
  const st = engineStatus.engines[busy];
  const isError = st.phase === 'error';
  const indeterminate = st.progress < 0;
  const stage =
    st.stage ||
    (st.phase === 'loading'
      ? '加载中…'
      : st.phase === 'running'
        ? '运行中…'
        : '');
  const text = isError
    ? (st.error ?? '出错')
    : `${ENGINE_NAME[busy]} · ${stage}`;

  // 渲染于 ChatView headerAccessory 插槽（ChatHeader 之下）：
  // 顶部避让职责单一归 ChatHeader，本组件不做 insets 处理。
  return (
    <BannerBar
      testID="active-task-banner"
      variant={isError ? 'error' : 'tools'}
      icon={
        isError ? (
          <AlertTriangleMdIcon
            width={14}
            height={14}
            stroke={theme.colors.danger}
          />
        ) : indeterminate ? (
          <ActivityIndicator size="small" color={theme.colors.domain.tools} />
        ) : (
          <SettingsMdIcon
            width={14}
            height={14}
            stroke={theme.colors.domain.tools}
          />
        )
      }
      text={text}
      progress={!indeterminate && !isError ? st.progress : undefined}
      percent={!indeterminate && !isError ? st.progress : undefined}
      actions={
        isError && busy === 'image'
          ? [
              {
                label: '去生图页排查',
                onPress: () => navigation.navigate(ROUTES.IMAGE_GEN as never),
                testID: 'active-task-banner-goto',
              },
            ]
          : undefined
      }
    />
  );
});
