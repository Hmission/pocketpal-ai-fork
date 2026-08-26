import React from 'react';
import {View} from 'react-native';

import {Text, Card} from 'react-native-paper';

import {Switch} from '../../../components/ui/Switch';

import {Divider, InputSlider} from '../../../components';

import {L10nContext} from '../../../utils';

import {createStyles} from '../styles';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;

export interface InternetSearchCardProps {
  l10n: L10n;
  styles: SettingsStyles;
  searchEnabled: boolean;
  onConsentChange: (value: boolean) => void;
  resultCount: number;
  onResultCountChange: (value: number) => void;
}

/**
 * InternetSearchCard — 联网搜索卡（隐私 kill-switch + 结果数控制）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出（testID 一字不改），零行为变化。
 */
export const InternetSearchCard: React.FC<InternetSearchCardProps> = ({
  l10n,
  styles,
  searchEnabled,
  onConsentChange,
  resultCount,
  onResultCountChange,
}) => (
  <Card elevation={0} style={styles.card} testID="internet-search-card">
    <Card.Title title={l10n.settings.internetSearch.title} />
    <Card.Content>
      <View style={styles.settingItemContainer}>
        <Text variant="labelSmall" style={styles.textDescription}>
          {l10n.settings.internetSearch.description}
        </Text>

        {/* Privacy kill-switch — on by default, no key needed */}
        <Divider style={styles.divider} />
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.internetSearch.enableLabel}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.internetSearch.enableDescription}
            </Text>
          </View>
          <Switch
            testID="internet-search-enable-switch"
            accessibilityLabel={l10n.settings.internetSearch.enableLabel}
            value={searchEnabled}
            onValueChange={onConsentChange}
          />
        </View>

        {/* Result-count control */}
        <Divider style={styles.divider} />
        <View style={styles.textContainer}>
          <Text variant="titleMedium" style={styles.textLabel}>
            {l10n.settings.internetSearch.resultCountLabel}
          </Text>
          <InputSlider
            testID="search-result-count-slider"
            accessibilityLabel={l10n.settings.internetSearch.resultCountLabel}
            value={resultCount}
            onValueChange={onResultCountChange}
            min={1}
            max={8}
            step={1}
          />
          <Text variant="labelSmall" style={styles.textDescription}>
            {l10n.settings.internetSearch.resultCountDescription}
          </Text>
        </View>
      </View>
    </Card.Content>
  </Card>
);
