/**
 * BenchResultCard — 跑分结果卡（B39 v2，PERF_BENCHMARK_DESIGN §10.7）
 *
 * 新协议（suiteCase 有值）：真实负载套件——综合分 + tok/s + 步耗时 +
 * PSS 峰值 + 温升 + 总时长；旧协议（无 suiteCase）：pp/tg 合成负载，
 * 诚实标「旧协议」，不洗数据。云提交链整体砍除（不发公网裁定）——
 * 成绩全部本地：「别人的跑分偷你数据，我们的成绩只住你手机里」。
 */
import React, {useContext} from 'react';
import {View} from 'react-native';

import {Card, Text, Button} from 'react-native-paper';

import {useTheme} from '../../../hooks/useTheme';
import {L10nContext} from '../../../utils';

import {createStyles} from './styles';

import {BenchmarkResult} from '../../../utils/types';
import {formatBytes, formatNumber} from '../../../utils';

type Props = {
  result: BenchmarkResult;
  onDelete: (timestamp: string) => void;
};

const formatDuration = (ms: number) => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

export const BenchResultCard = ({result, onDelete}: Props) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);
  const labels = l10n.benchmark.suite.labels;
  const suite = result.suite;

  return (
    <Card elevation={0} style={styles.resultCard}>
      <Card.Content>
        <View style={styles.resultHeader}>
          <View style={styles.headerLeft}>
            <Text variant="titleSmall" style={styles.modelName}>
              {result.modelName}
            </Text>
            {suite ? (
              <Text style={styles.modelMeta}>
                {new Date(result.timestamp).toLocaleString()}
              </Text>
            ) : (
              <Text style={styles.modelMeta}>
                {formatBytes(result.modelSize)} •{' '}
                {formatNumber(result.modelNParams, 2, true, false)}{' '}
                {l10n.benchmark.benchmarkResultCard.modelMeta.params}
              </Text>
            )}
          </View>
          <Button
            testID="delete-result-button"
            mode="text"
            onPress={() => onDelete(result.timestamp)}
            icon="delete"
            compact
            style={styles.deleteButton}>
            {l10n.benchmark.benchmarkResultCard.actions.deleteButton}
          </Button>
        </View>

        {suite ? (
          // ── 新协议：套件汇总（口径 = perfScore，综合分主视觉）──
          <View style={styles.resultsContainer} testID="suite-result">
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text
                  style={[
                    styles.resultValue,
                    {color: theme.colors.brandAccent},
                  ]}>
                  {suite.score.total}
                  <Text style={styles.resultUnit}> 分</Text>
                </Text>
                <Text style={styles.resultLabel}>{labels.total}</Text>
              </View>
              {suite.tokAvg != null && (
                <View style={styles.resultItem}>
                  <Text style={styles.resultValue}>
                    {suite.tokAvg.toFixed(1)}
                    <Text style={styles.resultUnit}> tok/s</Text>
                  </Text>
                  <Text style={styles.resultLabel}>{labels.inferSpeed}</Text>
                </View>
              )}
              {suite.stepAvg != null && (
                <View style={styles.resultItem}>
                  <Text style={styles.resultValue}>
                    {suite.stepAvg.toFixed(1)}
                    <Text style={styles.resultUnit}> s/步</Text>
                  </Text>
                  <Text style={styles.resultLabel}>{labels.genSpeed}</Text>
                </View>
              )}
            </View>
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={styles.resultValue}>{suite.score.memory}</Text>
                <Text style={styles.resultLabel}>{labels.memSafe}</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultValue}>{suite.score.thermal}</Text>
                <Text style={styles.resultLabel}>{labels.thermal}</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultValue}>{suite.score.stability}</Text>
                <Text style={styles.resultLabel}>{labels.stability}</Text>
              </View>
              {result.wallTimeMs != null && (
                <View style={styles.resultItem}>
                  <Text style={styles.resultValue}>
                    {formatDuration(result.wallTimeMs)}
                  </Text>
                  <Text style={styles.resultLabel}>{labels.totalTime}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          // ── 旧协议：bench() 合成负载（诚实标「旧协议」，不洗数据）──
          <View style={styles.resultsContainer}>
            <View style={styles.configContainer}>
              <View style={styles.configBar}>
                <Text variant="labelSmall">
                  {l10n.benchmark.benchmarkResultCard.config.title}
                </Text>
                <Text style={styles.configText}>
                  PP {result.config.pp} · TG {result.config.tg} · NR{' '}
                  {result.config.nr} · {labels.legacy}
                </Text>
              </View>
            </View>
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={styles.resultValue}>
                  {result.ppAvg?.toFixed(2)}
                  <Text style={styles.resultUnit}>
                    {' '}
                    {l10n.benchmark.benchmarkResultCard.results.tokensPerSecond}
                  </Text>
                </Text>
                <Text style={styles.resultLabel}>
                  {l10n.benchmark.benchmarkResultCard.results.promptProcessing}
                </Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultValue}>
                  {result.tgAvg?.toFixed(2)}
                  <Text style={styles.resultUnit}>
                    {' '}
                    {l10n.benchmark.benchmarkResultCard.results.tokensPerSecond}
                  </Text>
                </Text>
                <Text style={styles.resultLabel}>
                  {l10n.benchmark.benchmarkResultCard.results.tokenGeneration}
                </Text>
              </View>
            </View>
            <Text style={styles.timestamp}>
              {new Date(result.timestamp).toLocaleString()}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};
