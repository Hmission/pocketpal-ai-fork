import React, {useContext, useMemo, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {NavigationContext} from '@react-navigation/native';

import {useTheme} from '../../hooks';
import {ROUTES} from '../../utils/navigationConstants';
import type {MessageType, Theme} from '../../utils/types';

/**
 * TurnMetricsRow — 助手卡底部每输出指标行（CHAT_UI_SPEC §17，B18）。
 *
 * 数据源单一：`metadata.turnMetrics`（run_finished 时快照，每卡各记各的）。
 * 老消息无快照 = 不渲染（锋利不兜底）。
 * 布局：`上下文余量 x% · 落盘 HH:mm · 召回 n · 情绪`；
 * - ctx 点按直达生成设置（每模型 n_ctx 入口不丢）；
 * - 召回点按展开片段预览（默认折叠，SessionStatusBar 能力平移）。
 */
export interface TurnMetrics {
  ctxPct: number;
  writeTime: number;
  recallCount: number;
  recallPreview: string[];
  sentimentLabel: string;
  intent: 'chat' | 'vent' | 'qa' | 'task';
}

export const TurnMetricsRow: React.FC<{message: MessageType.Any}> = ({
  message,
}) => {
  const theme = useTheme();
  // 直读 NavigationContext（非 useNavigation）：无导航上下文（单测等）时优雅降级
  // 为纯展示，不抛错；应用内永远有导航容器，入口不丢。
  const navigation = useContext(NavigationContext);
  const [recallExpanded, setRecallExpanded] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const metrics = (message.metadata as {turnMetrics?: TurnMetrics} | undefined)
    ?.turnMetrics;
  if (!metrics) {
    return null;
  }

  // 上下文余量语义色（与旧状态栏同一阈值叙事）：满=error / >80=warning / 常态 success
  const ctxColor =
    metrics.ctxPct >= 100
      ? theme.colors.error
      : metrics.ctxPct > 80
        ? theme.colors.warning
        : theme.colors.success;

  const writeTimeStr = new Date(metrics.writeTime)
    .toLocaleTimeString()
    .slice(0, 5);

  return (
    <View testID="turn-metrics-row">
      <View style={styles.row}>
        {/* 上下文余量：点按直达生成设置（每模型 n_ctx） */}
        <TouchableOpacity
          style={styles.section}
          onPress={() =>
            navigation?.navigate(ROUTES.GENERATION_SETTINGS as never)
          }
          disabled={!navigation}
          testID="metrics-ctx"
          hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
          <Text style={styles.label}>上下文余量</Text>
          <Text style={[styles.value, {color: ctxColor}]}>
            {metrics.ctxPct}%
          </Text>
        </TouchableOpacity>

        <Text style={styles.separator}>·</Text>
        <View style={styles.section}>
          <Text style={styles.label}>落盘</Text>
          <Text style={styles.value}>{writeTimeStr}</Text>
        </View>

        <Text style={styles.separator}>·</Text>
        <TouchableOpacity
          style={styles.section}
          onPress={() => setRecallExpanded(v => !v)}
          disabled={metrics.recallCount === 0}
          testID="metrics-recall"
          hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
          <Text style={styles.label}>召回</Text>
          <Text style={styles.value}>
            {metrics.recallCount}
            {metrics.recallCount > 0 ? (recallExpanded ? ' ⌃' : ' ⌄') : ''}
          </Text>
        </TouchableOpacity>

        <Text style={styles.separator}>·</Text>
        <Text style={styles.value}>{metrics.sentimentLabel}</Text>
      </View>

      {/* 召回片段预览（默认折叠，点按展开） */}
      {recallExpanded && metrics.recallCount > 0 && (
        <View style={styles.recallPreview} testID="metrics-recall-preview">
          {metrics.recallPreview.map((frag, i) => (
            <Text key={i} style={styles.recallText} numberOfLines={2}>
              {frag.slice(0, 100)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: theme.spacing.xs,
      marginHorizontal: theme.spacing.default,
    },
    section: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    label: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    value: {
      ...theme.typography.captionS,
      color: theme.colors.onSurface,
      fontWeight: '500',
    },
    separator: {
      ...theme.typography.captionS,
      color: theme.colors.outlineVariant,
      marginHorizontal: theme.spacing.xs,
    },
    recallPreview: {
      marginTop: theme.spacing.xxs,
      marginHorizontal: theme.spacing.default,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: theme.radius.xs,
      gap: theme.spacing.xxs,
    },
    recallText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 14,
    },
  });
