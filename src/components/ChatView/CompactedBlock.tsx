import React, {useContext, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, TouchableRipple} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {L10nContext} from '../../utils';
import {MessageType} from '../../utils/types';
import {t} from '../../locales';

/**
 * B19 上下文压缩占位卡片（锚点消息渲染）：
 * 折叠态显示「已压缩 N 条早期对话」，点按展开查看摘要。
 * 非破坏性：被压消息原文保留在库中，此卡片只是 prompt 注入摘要的 UI 代表。
 */
interface CompactedBlockProps {
  compaction: MessageType.CompactionMeta;
}

export const CompactedBlock: React.FC<CompactedBlockProps> = ({compaction}) => {
  const theme = useTheme();
  const l10n = useContext(L10nContext);
  const [expanded, setExpanded] = useState(false);

  const styles = createStyles(theme);

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: theme.colors.surfaceVariant},
      ]}>
      <TouchableRipple
        onPress={() => setExpanded(v => !v)}
        testID="compacted-block">
        <View style={styles.header}>
          <Text style={[styles.title, {color: theme.colors.onSurfaceVariant}]}>
            {t(l10n.chat.compactionBanner, {count: compaction.count})}
          </Text>
          <Text
            style={[styles.chevron, {color: theme.colors.onSurfaceVariant}]}>
            {expanded ? '⌃' : '⌄'}
          </Text>
        </View>
      </TouchableRipple>
      {expanded ? (
        <View style={styles.summary}>
          <Text style={[styles.summaryText, {color: theme.colors.onSurface}]}>
            {compaction.summary}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      marginHorizontal: 8,
      marginVertical: 4,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    title: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
    },
    chevron: {
      fontSize: 12,
      marginLeft: 8,
    },
    summary: {
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    summaryText: {
      fontSize: 13,
      lineHeight: 19,
    },
  });
