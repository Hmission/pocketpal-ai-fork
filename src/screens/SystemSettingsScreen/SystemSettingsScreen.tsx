/**
 * 系统设置（v3.8 新增）
 *
 * 原 appSettings Card（语言/深色模式/TTS/自检/内存显示）从 GenerationSettingsScreen
 * 迁出，归位系统设置页。新增色彩模式三选（跟随系统/浅色/深色）。
 * 修复：UIStore useColorScheme() 被注释致系统跟随断裂（v3.8）。
 */
import * as React from 'react';
import {Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Appbar, Divider, Switch, Card} from 'react-native-paper';
import {observer} from 'mobx-react';

import {uiStore, ttsStore} from '../../store';
import {useTheme} from '../../hooks';
import {L10nContext} from '../../utils';
import type {Theme} from '../../utils/types';
import {LanguageSelector} from '../../components';
import {
  VolumeOnIcon,
  CpuChipIcon,
} from '../../assets/icons';

export const SystemSettingsScreen: React.FC<{navigation?: any}> = observer(
  ({navigation}) => {
    const theme = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const l10n = React.useContext(L10nContext);

    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="系统设置" />
        </Appbar.Header>

        <ScrollView contentContainerStyle={styles.content}>
          {/* 语言 */}
          <Card elevation={0} style={styles.card}>
            <Card.Title title={l10n.settings.language} />
            <Card.Content>
              <View style={styles.settingItem}>
                <LanguageSelector />
              </View>
            </Card.Content>
          </Card>

          {/* 色彩模式：跟随系统 / 浅色 / 深色 */}
          <Card elevation={0} style={styles.card}>
            <Card.Title title={l10n.settings.colorScheme} />
            <Card.Content>
              <View style={styles.settingItem}>
                <View style={styles.segmentedRow}>
                  {(
                    [
                      {key: 'system', label: l10n.settings.systemMode},
                      {key: 'light', label: l10n.settings.lightMode},
                      {key: 'dark', label: l10n.settings.darkMode},
                    ] as const
                  ).map(opt => {
                    const selected = uiStore.colorScheme === opt.key;
                    return (
                      <Text
                        key={opt.key}
                        testID={`color-scheme-${opt.key}`}
                        style={[
                          styles.segmentedOption,
                          selected && styles.segmentedOptionSelected,
                        ]}
                        onPress={() => uiStore.setColorScheme(opt.key)}>
                        {opt.label}
                      </Text>
                    );
                  })}
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* AIOS 功能 */}
          <Card elevation={0} style={styles.card}>
            <Card.Title title={l10n.settings.appSettings} />
            <Card.Content>
              {/* TTS 可用性 */}
              <View style={styles.settingItem}>
                <View style={styles.labelWithIcon}>
                  <VolumeOnIcon
                    width={20}
                    height={20}
                    stroke={theme.colors.onSurface}
                  />
                  <View style={styles.textBlock}>
                    <Text style={styles.textLabel}>
                      {l10n.settings.ttsAvailability}
                    </Text>
                    <Text style={styles.textDescription}>
                      {l10n.settings.ttsAvailabilityDescription}
                    </Text>
                    {!ttsStore.deviceMeetsMemory && (
                      <Text style={styles.textDescription}>
                        {l10n.settings.ttsAvailabilityLowMemoryWarning}
                      </Text>
                    )}
                  </View>
                </View>
                <Switch
                  testID="tts-availability-switch"
                  value={
                    ttsStore.userTTSOverride ?? ttsStore.deviceMeetsMemory
                  }
                  onValueChange={value =>
                    ttsStore.setUserTTSOverride(value)
                  }
                />
              </View>
              <Divider />

              {/* 自检修正 */}
              <View style={styles.settingItem}>
                <View style={styles.labelWithIcon}>
                  <View style={styles.textBlock}>
                    <Text style={styles.textLabel}>自检修正</Text>
                    <Text style={styles.textDescription}>
                      开启后重要回复会跑两遍（生成→自检→修正），更稳但更慢
                    </Text>
                  </View>
                </View>
                <Switch
                  testID="self-check-switch"
                  value={uiStore.selfCheckEnabled}
                  onValueChange={value =>
                    uiStore.setSelfCheckEnabled(value)
                  }
                />
              </View>

              {/* 内存显示（iOS） */}
              {Platform.OS === 'ios' && (
                <>
                  <Divider />
                  <View style={styles.settingItem}>
                    <View style={styles.labelWithIcon}>
                      <CpuChipIcon
                        width={20}
                        height={20}
                        stroke={theme.colors.onSurface}
                      />
                      <View style={styles.textBlock}>
                        <Text style={styles.textLabel}>
                          {l10n.settings.displayMemoryUsage}
                        </Text>
                        <Text style={styles.textDescription}>
                          {l10n.settings.displayMemoryUsageDescription}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      testID="display-memory-usage-switch"
                      value={uiStore.displayMemUsage}
                      onValueChange={value =>
                        uiStore.setDisplayMemUsage(value)
                      }
                    />
                  </View>
                </>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    );
  },
);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.background},
    content: {padding: theme.spacing.m, gap: theme.spacing.l},
    card: {backgroundColor: theme.colors.surface},
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.s,
    },
    labelWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      flex: 1,
    },
    textBlock: {flex: 1},
    textLabel: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
    },
    textDescription: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xxs,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    segmentedOption: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.s,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    segmentedOptionSelected: {
      color: theme.colors.onPrimary,
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      fontWeight: '600',
    },
  });
