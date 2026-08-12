import * as React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {observer} from 'mobx-react';
import {modelStore, chatSessionStore} from '../../store';
import {getLastWriteTime} from '../../services/aiosMemory/conversationLog';
import {getLastRecallInfo} from '../../services/aiosMemory/contextAssembler';
import {getLastSentiment} from '../../services/aiosMemory/rituals';

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
  const [expanded, setExpanded] = React.useState(false);

  const activeModel = modelStore.activeModel;
  const nCtx = modelStore.activeContextSettings?.n_ctx;
  const snapshot = chatSessionStore.lastCompletionResult;
  const usedTokens = snapshot?.used ?? 0;
  const contextPct = nCtx ? Math.min(100, Math.round((usedTokens / nCtx) * 100)) : 0;
  const contextFull = snapshot?.contextFull ?? false;

  const lastWrite = getLastWriteTime();
  const recallInfo = getLastRecallInfo();

  const modelStatus = activeModel
    ? modelStore.inferencing
      ? '推理中'
      : modelStore.isContextLoading
        ? '加载中'
        : '已加载'
    : '未加载';

  // Estimate memory usage from model size (approx: model_size * 1.3 for runtime overhead)
  const memEstimate = activeModel?.size
    ? Math.round((activeModel.size * 1.3) / 1024 / 1024)
    : 0;

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
      {/* Context usage */}
      <View style={styles.section}>
        <View style={[styles.dot, {backgroundColor: contextColor}]} />
        <Text style={styles.label}>ctx</Text>
        <Text style={[styles.value, {color: contextColor}]}>
          {contextPct}%
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

      {/* Model status + memory */}
      <Text style={styles.separator}>|</Text>
      <View style={[styles.section, {flex: 1}]}>
        <Text style={styles.label} numberOfLines={1}>
          {activeModel ? activeModel.name?.slice(0, 14) : '无模型'}
        </Text>
        <Text style={[styles.value, {fontSize: 9}]}>
          {modelStatus}{memEstimate > 0 ? ` ${memEstimate}MB` : ''}
        </Text>
      </View>

      {/* M7 情绪指示 */}
      <Text style={styles.separator}>|</Text>
      <View style={styles.section}>
        <Text style={[styles.value, {color: sentimentColor}]}>{sentiment.label}</Text>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    flexWrap: 'wrap',
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    color: '#888',
  },
  value: {
    fontSize: 10,
    color: '#555',
    fontWeight: '500',
  },
  separator: {
    color: '#ccc',
    marginHorizontal: 6,
    fontSize: 10,
  },
  recallPreview: {
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 4,
    marginTop: 2,
    gap: 2,
  },
  recallText: {
    fontSize: 9,
    color: '#666',
    lineHeight: 14,
  },
});
