import React from 'react';
import {View} from 'react-native';

import {Text, Card, Button} from 'react-native-paper';

import {Switch} from '../../../components/ui/Switch';

import {Divider} from '../../../components';

import {L10nContext} from '../../../utils';

import {createStyles} from '../styles';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;

export interface ApiSettingsCardProps {
  l10n: L10n;
  styles: SettingsStyles;
  isTokenPresent: boolean;
  useHfToken: boolean;
  onUseHfTokenChange: (value: boolean) => void;
  onSetTokenPress: () => void;
}

/**
 * ApiSettingsCard — API 设置卡（Hugging Face Token + Use HF Token 开关）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出（testID 一字不改），零行为变化。
 */
export const ApiSettingsCard: React.FC<ApiSettingsCardProps> = ({
  l10n,
  styles,
  isTokenPresent,
  useHfToken,
  onUseHfTokenChange,
  onSetTokenPress,
}) => (
  <Card elevation={0} style={styles.card}>
    <Card.Title title={l10n.settings.apiSettingsTitle} />
    <Card.Content>
      <View style={styles.settingItemContainer}>
        {/* Hugging Face Token */}
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.huggingFaceTokenLabel}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {isTokenPresent
                ? l10n.settings.tokenIsSetDescription
                : l10n.settings.setTokenDescription}
            </Text>
          </View>
          <Button
            mode="outlined"
            onPress={onSetTokenPress}
            style={styles.menuButton}>
            {isTokenPresent ? l10n.common.update : l10n.settings.setTokenButton}
          </Button>
        </View>

        {/* Use HF Token Switch */}
        <Divider style={styles.divider} />
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.useHfTokenLabel}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.useHfTokenDescription}
            </Text>
          </View>
          <Switch
            testID="use-hf-token-switch"
            accessibilityLabel={l10n.settings.useHfTokenLabel}
            value={useHfToken}
            disabled={!isTokenPresent}
            onValueChange={onUseHfTokenChange}
          />
        </View>
      </View>
    </Card.Content>
  </Card>
);
