import * as React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {observer} from 'mobx-react';
import {modelStore, chatSessionStore} from '../../store';
import {engineStatus} from '../../store/engineStatus';
import {getLastWriteTime} from '../../services/aiosMemory/conversationLog';
import {getLastRecallInfo} from '../../services/aiosMemory/contextAssembler';
import {getLastSentiment} from '../../services/aiosMemory/rituals';
import {useTheme} from '../../hooks';
import type {Theme} from '../../utils/types';

/**
 * Session Status Bar — shows context usage, disk status, recall preview,
 * and model load status. Embedded below ChatHeader.
 *
 * Spec 6.5 requirements:
 * - 上下文使用率 (used token / n_ctx)
 * - 落盘状态 (conversations/ last write time)
 * - 召回片段预览 (current turn recalled fragments, expandable)
 * - 模型加载状态 + 内存占用
 */
export const SessionStatusBar = observer(() => {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = React.useState(false);

  const nCtx = modelStore.activeContextSettings?.n_ctx;
  const snapshot = chatSessionStore.lastCompletionResult;
  const usedTokens = snapshot?.used ?? 0;
  const contextPct = nCtx
    ? Math.min(100, Math.round((usedTokens / nCtx) * 100))
    : 0;
  const contextFull = snapshot?.contextFull ?? false;

  const lastWrite = getLastWriteTime();
  const recallInfo = getLastRecallInfo();

  // 模型归属信息已移入聊天流卡片标签，顶栏不再重复展示模型状态

  const writeTimeStr = lastWrite
    ? new Date(lastWrite).toLocaleTimeString().slice(0, 5)
    : '--';

  // M7 情绪：大王最近输入的情绪状态
  const sentiment = getLastSentiment();
  const sentimentColor =
    sentiment.score > 0 ? '#4CAF50' : sentiment.score < 0 ? '#F44336' : '#888';

  const contextColor = contextFull
    ? '#F44336'
    : contextPct > 80
      ? '#FF9800'
      : '#4CAF50';

  return (
    <View style={styles.container}>
      {/* Context usage + 剩余上下文 */}
      <View style={styles.section}>
        <View style={[styles.dot, {backgroundColor: contextColor}]} />
        <Text style={styles.label}>ctx</Text>
        <Text style={[styles.value, {color: contextColor}]}>
          {contextPct}%
          {nCtx
            ? ` · 余${Math.max(0, Math.round((nCtx - usedTokens) / 100) / 10)}k`
            : ''}
        </Text>
      </View>

      {/* Disk status */}
      <Text style={styles.separator}>|</Text>
      <View style={styles.section}>
        <Text style={styles.label}>落盘</Text>
        <Text style={styles.value}>{writeTimeStr}</Text>
      </View>

      {/* Recall preview (expandable) */}
      <Text style={styles.separator}>|</Text>
      <TouchableOpacity
        style={styles.section}
        onPress={() => setExpanded(!expanded)}
        disabled={recallInfo.count === 0}>
        <Text style={styles.label}>召回</Text>
        <Text style={styles.value}>{recallInfo.count}</Text>
      </TouchableOpacity>

      {/* 模型状态区已移入聊天流卡片归属标签（顶栏瘦身） */}

      {/* M7 情绪指示 */}
      <Text style={styles.separator}>|</Text>
      <View style={styles.section}>
        <Text style={[styles.value, {color: sentimentColor}]}>
          {sentiment.label}
        </Text>
      </View>

      {/* 引擎全景（prompter/chat/image 调度状态） */}
      <Text style={styles.separator}>|</Text>
      <View style={styles.section}>
        <Text style={styles.label}>引擎</Text>
        <Text style={styles.value} numberOfLines={1}>
          {engineStatus.summary}
        </Text>
      </View>

      {/* Expandable recall preview */}
      {expanded && recallInfo.count > 0 && (
        <View style={styles.recallPreview}>
          {recallInfo.preview.map((frag, i) => (
            <Text key={i} style={styles.recallText} numberOfLines={2}>
              {frag.slice(0, 100)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      // 灰色治理（DESIGN_SPEC §1.8）：状态条降为 surface + hairline 分隔，
      // surfaceVariant 让位给 softCapBanner 唯一信息带职责
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      flexWrap: 'wrap',
    },
    section: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: theme.radius.xs,
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
      color: theme.colors.outlineVariant,
      marginHorizontal: theme.spacing.xs,
      ...theme.typography.captionS,
    },
    recallPreview: {
      width: '100%',
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: theme.radius.xs,
      marginTop: theme.spacing.xxs,
      gap: theme.spacing.xxs,
    },
    recallText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 14,
    },
  });
