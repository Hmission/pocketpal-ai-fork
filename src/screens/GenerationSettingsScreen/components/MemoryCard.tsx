import React from 'react';
import {Platform, View} from 'react-native';

import {Text, Card} from 'react-native-paper';

import {Switch} from '../../../components/ui/Switch';

import {Divider} from '../../../components';

import {L10nContext} from '../../../utils';

import {createStyles} from '../styles';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;

export interface MemoryCardProps {
  l10n: L10n;
  styles: SettingsStyles;
  useMlock: boolean;
  onUseMlockChange: (value: boolean) => void;
  useMmap: 'true' | 'false' | 'smart';
  onUseMmapChange: (value: boolean) => void;
  noExtraBufts: boolean | undefined;
  onNoExtraBuftsChange: (value: boolean) => void;
}

/**
 * MemoryCard — 内存设置卡（Use Memory Lock / Memory Mapping / Weight Repacking）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出（testID 一字不改），零行为变化。
 */
export const MemoryCard: React.FC<MemoryCardProps> = ({
  l10n,
  styles,
  useMlock,
  onUseMlockChange,
  useMmap,
  onUseMmapChange,
  noExtraBufts,
  onNoExtraBuftsChange,
}) => (
  <Card elevation={0} style={styles.card}>
    <Card.Title title={l10n.settings.memorySettings} />
    <Card.Content>
      <View style={styles.settingItemContainer}>
        {/* Use Memory Lock */}
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.useMlock}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.useMlockDescription}
            </Text>
          </View>
          <Switch
            testID="use-mlock-switch"
            accessibilityLabel={l10n.settings.useMlock}
            value={useMlock}
            onValueChange={onUseMlockChange}
          />
        </View>
      </View>
      <Divider />

      {/* Memory Mapping */}
      <View style={styles.settingItemContainer}>
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.useMmap}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.useMmapDescription}
            </Text>
          </View>
          <Switch
            testID="use-mmap-switch"
            accessibilityLabel={l10n.settings.useMmap}
            value={useMmap !== 'false' && useMmap !== 'smart'}
            onValueChange={onUseMmapChange}
          />
        </View>
      </View>
      <Divider />

      {/* Enable Weight Repacking (Android only) */}
      {Platform.OS === 'android' && (
        <View style={styles.settingItemContainer}>
          <View style={styles.switchContainer}>
            <View style={styles.textContainer}>
              <Text variant="titleMedium" style={styles.textLabel}>
                {l10n.settings.weightRepacking}
              </Text>
              <Text variant="labelSmall" style={styles.textDescription}>
                {l10n.settings.weightRepackingDescription}
              </Text>
            </View>
            <Switch
              testID="weight-repacking-switch"
              accessibilityLabel={l10n.settings.weightRepacking}
              value={!(noExtraBufts ?? false)}
              onValueChange={onNoExtraBuftsChange}
            />
          </View>
        </View>
      )}
      {Platform.OS === 'android' && <Divider />}

      <Text variant="labelSmall" style={styles.textDescription}>
        {l10n.settings.modelReloadNotice}
      </Text>
    </Card.Content>
  </Card>
);
