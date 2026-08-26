import React from 'react';
import {View} from 'react-native';

import {Text, Card} from 'react-native-paper';

import {Switch} from '../../../components/ui/Switch';

import {Divider} from '../../../components';

import {L10nContext} from '../../../utils';

import {createStyles} from '../styles';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;

export interface ModelLoadingCardProps {
  l10n: L10n;
  styles: SettingsStyles;
  autoOffloadLoad: boolean;
  onAutoOffloadChange: (value: boolean) => void;
  autoNavigateToChat: boolean;
  onAutoNavigateChange: (value: boolean) => void;
}

/**
 * ModelLoadingCard — 模型加载设置卡（Auto Offload/Load + Auto Navigate to Chat）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出（testID 一字不改），零行为变化。
 */
export const ModelLoadingCard: React.FC<ModelLoadingCardProps> = ({
  l10n,
  styles,
  autoOffloadLoad,
  onAutoOffloadChange,
  autoNavigateToChat,
  onAutoNavigateChange,
}) => (
  <Card elevation={0} style={styles.card}>
    <Card.Title title={l10n.settings.modelLoadingSettings} />
    <Card.Content>
      <View style={styles.settingItemContainer}>
        {/* Auto Offload/Load */}
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.autoOffloadLoad}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.autoOffloadLoadDescription}
            </Text>
          </View>
          <Switch
            testID="auto-offload-load-switch"
            accessibilityLabel={l10n.settings.autoOffloadLoad}
            value={autoOffloadLoad}
            onValueChange={onAutoOffloadChange}
          />
        </View>
        <Divider />

        {/* Auto Navigate to Chat */}
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.autoNavigateToChat}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.autoNavigateToChatDescription}
            </Text>
          </View>
          <Switch
            testID="auto-navigate-to-chat-switch"
            accessibilityLabel={l10n.settings.autoNavigateToChat}
            value={autoNavigateToChat}
            onValueChange={onAutoNavigateChange}
          />
        </View>
      </View>
    </Card.Content>
  </Card>
);
