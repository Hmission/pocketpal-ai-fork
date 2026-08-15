/**
 * ActiveTaskBanner — 聊天窗口内的引擎任务横幅（调度叙事的可见面）
 *
 * 观察 engineStatus.busy：有引擎在 加载/运行/出错 时，在聊天区顶部显示
 * 一条 slim 横幅（引擎名 + 阶段 + 进度），出错时提供 重试/去生图页。
 * 空闲时渲染 null——不占空间、不臃肿。
 *
 * 数据源唯一：engineStatus（promptWriter / imageGenStore 写入）。
 */
import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {observer} from 'mobx-react';
import {useNavigation} from '@react-navigation/native';
import {engineStatus, EngineKind} from '../../store/engineStatus';
import {ROUTES} from '../../utils/navigationConstants';
import {useTheme} from '../../hooks';
import type {Theme} from '../../utils/types';
import {withOpacity} from '../../utils/colorUtils';

const ENGINE_NAME: Record<EngineKind, string> = {
  prompter: '管家模型',
  chat: '对话模型',
  image: '生图引擎',
};

export const ActiveTaskBanner: React.FC = observer(() => {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const busy = engineStatus.busy;
  if (!busy) {
    return null;
  }
  const st = engineStatus.engines[busy];
  const isError = st.phase === 'error';
  const indeterminate = st.progress < 0;

  // 渲染于 ChatView headerAccessory 插槽（ChatHeader 之下）：
  // 顶部避让职责单一归 ChatHeader，本组件不做 insets 处理。
  return (
    <View style={[styles.wrap, isError && styles.wrapError]}>
      <View style={styles.row}>
        {isError ? (
          <Text style={styles.icon}>⚠️</Text>
        ) : indeterminate ? (
          <ActivityIndicator size="small" color={theme.colors.domain.tools} />
        ) : (
          <Text style={styles.icon}>⚙️</Text>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {ENGINE_NAME[busy]}
        </Text>
        <Text style={styles.stage} numberOfLines={1}>
          {isError
            ? (st.error ?? '出错')
            : st.stage ||
              (st.phase === 'loading'
                ? '加载中…'
                : st.phase === 'running'
                  ? '运行中…'
                  : '')}
        </Text>
        {!indeterminate && !isError && (
          <Text style={styles.pct}>{st.progress}%</Text>
        )}
      </View>

      {/* 进度条（确定进度时） */}
      {!indeterminate && !isError && (
        <View style={styles.track}>
          <View style={[styles.fill, {width: `${st.progress}%`}]} />
        </View>
      )}

      {/* 出错操作区：生图引擎出错 → 引导去生图页（那里有完整模型选择/下载/排查） */}
      {isError && busy === 'image' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate(ROUTES.IMAGE_GEN as never)}>
            <Text style={styles.btnText}>去生图页排查</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

// 域色：工具域（DESIGN_SPEC §1.2，收编原紫色系硬编码）
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: withOpacity(theme.colors.domain.tools, 0.1),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withOpacity(theme.colors.domain.tools, 0.25),
    },
    wrapError: {
      backgroundColor: withOpacity(theme.colors.danger, 0.1),
      borderBottomColor: withOpacity(theme.colors.danger, 0.25),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    icon: {
      fontSize: 12,
    },
    title: {
      ...theme.typography.captionM,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    stage: {
      flex: 1,
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    pct: {
      ...theme.typography.captionS,
      fontWeight: '600',
      color: theme.colors.domain.tools,
    },
    track: {
      marginTop: theme.spacing.xs,
      height: 3,
      borderRadius: theme.radius.xxs,
      backgroundColor: withOpacity(theme.colors.domain.tools, 0.25),
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: theme.colors.domain.tools,
    },
    actions: {
      marginTop: theme.spacing.xs,
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    btn: {
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xxs + 1,
      borderRadius: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    btnText: {
      ...theme.typography.captionS,
      color: theme.colors.domain.tools,
    },
  });
