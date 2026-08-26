/**
 * ImageTaskProgress — 聊天内联生图任务卡片的生成动效（2026-08）
 *
 * 挂载于 ChatScreen renderTextMessage 的 actions 槽（生成中占位卡）：
 * 复用生图页预览区的生成动效（三点波浪 + 进度条 + 采样进度 + 耗时 + 阶段），
 * 让聊天内生图全程可见，不再只靠顶部横幅一行提示。
 * 数据源唯一：imageGenStore 单状态机（与生图页同源，observer 自动跟踪）。
 * 组件自守卫：loading/generating 均 false 时渲染 null（卡片回写瞬间不闪烁）。
 */
import * as React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {imageGenStore} from '../../store/imageGenStore';
import {WaveDots} from '../ui/WaveDots';
import {Progress} from '../ui/Progress';
import {withOpacity} from '../../utils/colorUtils';
import type {Theme} from '../../utils/types';

export const ImageTaskProgress: React.FC = observer(() => {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const active = imageGenStore.loading || imageGenStore.generating;

  // 耗时展示：生成期间每 2s 刷新（与生图页预览区同节奏）
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!active) {
      return;
    }
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) {
    return null;
  }

  const {progress, progressText, stepTime, stage, genStartedAt} = imageGenStore;
  // 无确定进度（加载权重/准备中）时展示 2% 底条，与生图页进度条语义一致
  const pct = progress >= 0 ? Math.max(progress, 2) : 2;
  const elapsed =
    genStartedAt > 0 ? Math.max(0, Math.round((now - genStartedAt) / 1000)) : 0;

  return (
    <View style={styles.wrap} testID="image-task-progress">
      <View style={styles.dotsRow}>
        {/* B57：三点波浪动效归一 ui/WaveDots（JS driver 纪律在组件内承接） */}
        <WaveDots active={active} />
        <Text style={styles.title}>正在生成新图…</Text>
      </View>
      {/* B57：进度条归一 ui/Progress（value≥2 底条语义保留） */}
      <Progress value={pct} />
      <Text style={styles.text}>
        {progressText
          ? `采样 ${progressText}` +
            (stepTime > 0 ? `（${stepTime.toFixed(1)}s/步）` : '')
          : '加载权重/准备中…'}
        {' · '}
        {elapsed}s
      </Text>
      {stage ? (
        <Text style={styles.stage} numberOfLines={2}>
          ▸ {stage}
        </Text>
      ) : null}
    </View>
  );
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      padding: theme.spacing.s,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.primary, 0.06),
      gap: theme.spacing.xs,
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 24,
    },
    title: {
      ...theme.typography.captionM,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    text: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    stage: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
  });
