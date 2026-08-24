/**
 * BenchmarkHudBar — 「基准测试进行中」HUD 条（PERF_BENCHMARK_DESIGN §10.7，B39）
 *
 * 套件征用聊天页/生图页时挂在页顶：横幅文案 + 终止权（温控耐久可随时停）。
 * 非运行态返回 null（零视觉负担）。数据经 benchmarkStore 单通道。
 */
import * as React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {observer} from 'mobx-react-lite';

import {useTheme} from '../hooks';
import {L10nContext} from '../utils';
import {benchmarkStore} from '../store/BenchmarkStore';
import {benchmarkOrchestrator} from '../services/benchmarkOrchestrator';

export const BenchmarkHudBar: React.FC = observer(() => {
  const theme = useTheme();
  const l10n = React.useContext(L10nContext);
  const {suiteRunning, suiteBanner} = benchmarkStore;
  if (!suiteRunning) {
    return null;
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginHorizontal: 12,
        marginTop: 6,
        borderRadius: 8,
        backgroundColor: theme.colors.surfaceContainerHighest,
      }}
      testID="benchmark-hud">
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          color: theme.colors.brandAccent,
          fontWeight: '600',
        }}
        numberOfLines={1}>
        {l10n.benchmark.suite.hudRunning}
        {suiteBanner ? ` · ${suiteBanner}` : ''}
      </Text>
      <TouchableOpacity
        onPress={() => benchmarkOrchestrator.abort()}
        testID="benchmark-hud-abort"
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <Text style={{fontSize: 12, color: theme.colors.error}}>
          {l10n.benchmark.suite.abort}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
