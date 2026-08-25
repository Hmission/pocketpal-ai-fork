/**
 * BenchmarkScreen — 基准测试总控台（B39 v2，PERF_BENCHMARK_DESIGN §10.7）
 *
 * 三用例真实负载套件（推理速度→生图速度→温控耐久），编排器自动导航到
 * 聊天页/生图页让过程可见；结果页 = 四轴雷达（perfScore 口径）+ 揭幕综合分
 * + 段位。不发公网（云提交链已整体砍除），成绩全部本地。
 *
 * testID 契约保留：start-test-button（e2e selectors 依赖）。
 */
import {View, ScrollView} from 'react-native';
import React, {useState, useContext} from 'react';

import {observer} from 'mobx-react';
import {NavigationContext} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Text, Button, Card, ActivityIndicator} from 'react-native-paper';

import {Menu, Dialog} from '../../components';

import {useTheme} from '../../hooks';
import {L10nContext} from '../../utils';
import {t} from '../../locales';

import {createStyles} from './styles';
import {DeviceInfoCard} from './DeviceInfoCard';
import {BenchResultCard} from './BenchResultCard';
import {BenchRadar} from './BenchRadar';
import {ScoreReveal} from '../../components/PerfMotion';
import {PerfHistoryModal} from '../../components/PerfHistoryModal';

import {modelStore, benchmarkStore} from '../../store';
import {benchmarkOrchestrator} from '../../services/benchmarkOrchestrator';
import {shareScoreCard} from '../../services/benchShare';

import type {Model} from '../../utils/types';
import {ModelOrigin} from '../../utils/types';

/** 段位（综合分三分位）：中文展示 + ASCII 像素卡双口径 */
function rankOf(total: number): {cn: string; ascii: string} {
  if (total >= 75) {
    return {cn: '神鸡', ascii: 'GOD CHICK'};
  }
  if (total >= 50) {
    return {cn: '战斗鸡', ascii: 'FIGHTER CHICK'};
  }
  return {cn: '走地鸡', ascii: 'FREE RANGE CHICK'};
}

export const BenchmarkScreen: React.FC = observer(() => {
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [pendingDeleteTimestamp, setPendingDeleteTimestamp] = useState<
    string | null
  >(null);
  const [deleteAllConfirmVisible, setDeleteAllConfirmVisible] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  // B41 留存：性能回放历史（聊天回合 + 生图任务统一落盘可回看）
  const [historyVisible, setHistoryVisible] = useState(false);

  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);
  // 直读 NavigationContext（同 AssistantTurnFooter 模式）：无导航上下文（单测等）
  // 时优雅降级，应用内永远有导航容器，编排入口不丢。
  const navigation = useContext(NavigationContext);

  const handleModelSelect = async (model: Model) => {
    setShowModelMenu(false);
    if (model.id !== modelStore.activeModelId) {
      try {
        await modelStore.selectModel(model);
        setSelectedModel(model);
      } catch (error) {
        if (error instanceof Error) {
          console.error('Model initialization error:', error);
        }
      }
    } else {
      setSelectedModel(model);
    }
  };

  const handleDeleteResult = (timestamp: string) => {
    setPendingDeleteTimestamp(timestamp);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteTimestamp) {
      benchmarkStore.removeResult(pendingDeleteTimestamp);
    }
    setDeleteConfirmVisible(false);
    setPendingDeleteTimestamp(null);
  };

  const localModels = modelStore.availableModels.filter(
    m => m.origin !== ModelOrigin.REMOTE,
  );

  const handleShareCard = async () => {
    const s = benchmarkStore.results.find(r => r.suiteCase === 'suite')?.suite;
    if (!s) {
      return;
    }
    setShareBusy(true);
    setShareNotice(null);
    const {status} = await shareScoreCard({
      total: s.score.total,
      memory: s.score.memory,
      thermal: s.score.thermal,
      stability: s.score.stability,
      speed: s.score.speed,
      rank: rankOf(s.score.total).ascii,
      date: new Date().toISOString().slice(0, 10),
    });
    setShareBusy(false);
    if (status === 'failed') {
      // 诚实提示（不静默）：图片已落盘缓存，可稍后重试或从文件管理器分享
      setShareNotice(l10n.benchmark.suite.shareFailed);
    }
  };

  const {suiteRunning, suiteBanner, suiteError, suiteCaseIndex} =
    benchmarkStore;
  // 横幅：用例 key → l10n 标签（服务层不绑 l10n，展示层单点映射）
  const CASE_LABEL_KEY: Record<string, string> = {
    llm: 'inferSpeed',
    gen: 'genSpeed',
    endurance: 'endurance',
  };
  const labels = l10n.benchmark.suite
    .labels as Record<string, string>;
  const bannerText =
    suiteRunning && suiteBanner && CASE_LABEL_KEY[suiteBanner]
      ? t(l10n.benchmark.suite.caseProgress, {
          index: String(suiteCaseIndex + 1),
          case: labels[CASE_LABEL_KEY[suiteBanner]] ?? suiteBanner,
        })
      : l10n.benchmark.suite.runningDefault;
  // 最新套件结果 → 揭幕 + 雷达（结果页语义：挂载即演一次）
  const latestSuite = benchmarkStore.results.find(r => r.suiteCase === 'suite');

  const renderModelSelector = () => (
    <Menu
      visible={showModelMenu}
      onDismiss={() => setShowModelMenu(false)}
      anchorPosition="bottom"
      selectable
      anchor={
        <Button
          mode="outlined"
          onPress={() => setShowModelMenu(true)}
          contentStyle={styles.modelSelectorContent}
          icon="chevron-down">
          {selectedModel?.name ||
            modelStore.activeModel?.name ||
            l10n.benchmark.modelSelector.prompt}
        </Button>
      }>
      {localModels.length === 0 ? (
        <Menu.Item
          key="no-models"
          label={l10n.benchmark.modelSelector.noModels}
          disabled
        />
      ) : (
        localModels.map(model => (
          <Menu.Item
            key={model.id}
            onPress={() => handleModelSelect(model)}
            label={model.name}
            leadingIcon={
              model.id === modelStore.activeModelId ? 'check' : undefined
            }
          />
        ))
      )}
    </Menu>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        <Card elevation={0} style={styles.card}>
          <Card.Content>
            <DeviceInfoCard />
            {renderModelSelector()}

            {/* ── 总控区：一键跑分 / 进行中横幅 / 失败诚实报错 ── */}
            {suiteRunning ? (
              <View style={styles.loadingContainer} testID="suite-running">
                <ActivityIndicator testID="loading-indicator-benchmark" size="large" />
                <Text style={styles.warningText}>{bannerText}</Text>
                <Text variant="bodySmall" style={styles.description}>
                  {l10n.benchmark.suite.runningHint}
                </Text>
                <Button
                  mode="text"
                  onPress={() => benchmarkOrchestrator.abort()}
                  testID="suite-abort-button">
                  {l10n.benchmark.suite.abort}
                </Button>
              </View>
            ) : (
              <>
                {suiteError ? (
                  <View
                    style={styles.warningContainer}
                    testID="suite-error">
                    <Text variant="bodySmall" style={styles.warningText}>
                      {suiteError}
                    </Text>
                    <Button
                      mode="text"
                      compact
                      onPress={() => benchmarkStore.clearSuiteError()}>
                      {l10n.benchmark.suite.gotIt}
                    </Button>
                  </View>
                ) : null}
                <Button
                  testID="start-test-button"
                  mode="contained"
                  onPress={() =>
                    benchmarkOrchestrator.start({
                      navigate: route => navigation?.navigate(route as never),
                    })
                  }
                  disabled={suiteRunning}
                  style={styles.button}>
                  {l10n.benchmark.suite.startButton}
                </Button>
                <Button
                  testID="perf-history-button"
                  mode="outlined"
                  icon="history"
                  onPress={() => setHistoryVisible(true)}
                  style={styles.button}>
                  性能回放历史
                </Button>
                <View style={styles.warningContainer}>
                  <Text variant="bodySmall" style={styles.warningText}>
                    {l10n.benchmark.messages.testWarning}
                  </Text>
                </View>
              </>
            )}

            {/* ── 结果页：四轴雷达 + 揭幕综合分 + 段位（最新套件结果）── */}
            {latestSuite?.suite && !suiteRunning ? (
              <View style={styles.resultsCard} testID="suite-reveal">
                <ScoreReveal
                  value={latestSuite.suite.score.total}
                  color={theme.colors.brandAccent}
                  fontSize={44}
                  testID="suite-total-reveal"
                />
                <Text
                  style={[
                    styles.resultLabel,
                    {color: theme.colors.brandAccent, textAlign: 'center'},
                  ]}
                  testID="suite-rank">
                  {l10n.benchmark.suite.rankPrefix} ·{' '}
                  {rankOf(latestSuite.suite.score.total).cn}
                </Text>
                <View style={{alignItems: 'center', marginVertical: 8}}>
                  <BenchRadar
                    score={latestSuite.suite.score}
                    color={theme.colors.brandAccent}
                    gridColor={theme.colors.outlineVariant}
                    textColor={theme.colors.onSurfaceVariant}
                    testID="suite-radar"
                  />
                </View>
                {/* 分享跑分卡：像素风 PNG + 系统分享（不发公网） */}
                <Button
                  testID="share-score-card"
                  mode="outlined"
                  icon="share"
                  loading={shareBusy}
                  disabled={shareBusy}
                  onPress={handleShareCard}
                  style={styles.button}>
                  {l10n.benchmark.suite.shareButton}
                </Button>
                {shareNotice ? (
                  <Text
                    variant="bodySmall"
                    style={[styles.resultLabel, {textAlign: 'center'}]}
                    testID="share-notice">
                    {shareNotice}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* ── 成绩列表（全部本地，旧协议诚实标记）── */}
            {benchmarkStore.results.length > 0 && (
              <View style={styles.resultsCard}>
                <View style={styles.resultsHeader}>
                  <Text variant="titleSmall">
                    {l10n.benchmark.sections.testResults}
                  </Text>
                  <Button
                    testID="clear-all-button"
                    mode="text"
                    onPress={() => setDeleteAllConfirmVisible(true)}
                    icon="delete"
                    compact>
                    {l10n.benchmark.buttons.clearAll}
                  </Button>
                </View>
                {benchmarkStore.results.map((result, index) => (
                  <View key={index} style={styles.resultItem}>
                    <BenchResultCard
                      result={result}
                      onDelete={handleDeleteResult}
                    />
                  </View>
                ))}
              </View>
            )}

            <Dialog
              visible={deleteConfirmVisible}
              onDismiss={() => setDeleteConfirmVisible(false)}
              title={l10n.benchmark.dialogs.deleteResult.title}
              actions={[
                {
                  label: l10n.benchmark.buttons.cancel,
                  onPress: () => setDeleteConfirmVisible(false),
                },
                {
                  label: l10n.benchmark.buttons.delete,
                  onPress: handleConfirmDelete,
                },
              ]}>
              <Text>{l10n.benchmark.dialogs.deleteResult.message}</Text>
            </Dialog>

            <Dialog
              testID="clear-all-dialog"
              visible={deleteAllConfirmVisible}
              onDismiss={() => setDeleteAllConfirmVisible(false)}
              title={l10n.benchmark.dialogs.clearAllResults.title}
              actions={[
                {
                  testID: 'clear-all-dialog-cancel-button',
                  label: l10n.benchmark.buttons.cancel,
                  onPress: () => setDeleteAllConfirmVisible(false),
                },
                {
                  testID: 'clear-all-dialog-confirm-button',
                  label: l10n.benchmark.buttons.clearAll,
                  onPress: () => {
                    benchmarkStore.clearResults();
                    setDeleteAllConfirmVisible(false);
                  },
                },
              ]}>
              <Text>{l10n.benchmark.dialogs.clearAllResults.message}</Text>
            </Dialog>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* B41 留存：聊天回合 + 生图任务统一跑分历史回放 */}
      <PerfHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </SafeAreaView>
  );
});
