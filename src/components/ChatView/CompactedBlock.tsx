import React, {useContext, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, TouchableRipple} from 'react-native-paper';

import {useTheme} from '../../hooks/useTheme';
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
      marginHorizontal: theme.spacing.s,
      marginVertical: theme.spacing.xs,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
    },
    title: {
      flex: 1,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '600',
    },
    chevron: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      marginLeft: theme.spacing.s,
    },
    summary: {
      paddingHorizontal: theme.spacing.sm,
      paddingBottom: 10,
    },
    summaryText: {
      fontSize: theme.typography.bodyS.fontSize,
      lineHeight: 19,
    },
  });
