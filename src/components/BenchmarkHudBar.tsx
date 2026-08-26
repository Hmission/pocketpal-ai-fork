/**
 * BenchmarkHudBar — 「基准测试进行中」HUD 条（PERF_BENCHMARK_DESIGN §10.7，B39）
 *
 * 套件征用聊天页/生图页时挂在页顶：横幅文案 + 终止权（温控耐久可随时停）。
 * 非运行态返回 null（零视觉负担）。数据经 benchmarkStore 单通道。
 */
import * as React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {observer} from 'mobx-react-lite';

import {useTheme} from '../hooks/useTheme';
import {L10nContext} from '../utils';
import {withOpacity} from '../utils/colorUtils';
import {benchmarkStore} from '../store/BenchmarkStore';
import {benchmarkOrchestrator} from '../services/benchmarkOrchestrator';
import {Theme} from '../utils/types';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // 2026-08-26 去灰（大王：不喜欢灰色、没设计感）：
    // surfaceContainerHighest 灰底 → 跑分金 brandAccent 12% wash + hairline 描边
    //（与 BannerBar 语义色 wash 同一设计语言）；文案居中，abort 右端。
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      marginHorizontal: theme.spacing.sm,
      marginTop: 6,
      borderRadius: theme.radius.s,
      backgroundColor: withOpacity(theme.colors.brandAccent, 0.12),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(theme.colors.brandAccent, 0.25),
    },
    label: {
      flex: 1,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.brandAccent,
      fontWeight: '600',
      textAlign: 'center',
    },
    abortText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.error,
    },
  });

export const BenchmarkHudBar: React.FC = observer(() => {
  const theme = useTheme();
  const l10n = React.useContext(L10nContext);
  const {suiteRunning, suiteBanner} = benchmarkStore;
  if (!suiteRunning) {
    return null;
  }
  // 用例 key → l10n 标签（与 BenchmarkScreen 同源映射；非用例文案原样透传）
  const labels = l10n.benchmark.suite.labels as Record<string, string>;
  const CASE_LABEL_KEY: Record<string, string> = {
    llm: 'inferSpeed',
    gen: 'genSpeed',
    endurance: 'endurance',
  };
  const caseText = CASE_LABEL_KEY[suiteBanner]
    ? (labels[CASE_LABEL_KEY[suiteBanner]] ?? suiteBanner)
    : suiteBanner;
  const styles = createStyles(theme);
  return (
    <View style={styles.banner} testID="benchmark-hud">
      <Text style={styles.label} numberOfLines={1}>
        {l10n.benchmark.suite.hudRunning}
        {caseText ? ` · ${caseText}` : ''}
      </Text>
      <TouchableOpacity
        onPress={() => benchmarkOrchestrator.abort()}
        testID="benchmark-hud-abort"
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text style={styles.abortText}>{l10n.benchmark.suite.abort}</Text>
      </TouchableOpacity>
    </View>
  );
});
