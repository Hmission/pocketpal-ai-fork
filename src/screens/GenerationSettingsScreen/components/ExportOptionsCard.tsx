import React from 'react';
import {View} from 'react-native';

import {Text, Card, Button} from 'react-native-paper';

import {ShareIcon} from '../../../assets/icons';

import {L10nContext} from '../../../utils';
import {Theme} from '../../../utils/types';
import {exportLegacyChatSessions} from '../../../utils/exportUtils';
import {infoDialog} from '../../../components/ui/InfoDialog';

import {createStyles} from '../styles';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;

export interface ExportOptionsCardProps {
  l10n: L10n;
  theme: Theme;
  styles: SettingsStyles;
}

/**
 * ExportOptionsCard — 导出选项卡（Legacy Chat 导出）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出，零行为变化。
 */
export const ExportOptionsCard: React.FC<ExportOptionsCardProps> = ({
  l10n,
  theme,
  styles,
}) => (
  <Card elevation={0} style={styles.card}>
    <Card.Title title={l10n.settings.exportOptions} />
    <Card.Content>
      <View style={styles.settingItemContainer}>
        {/* Legacy Export */}
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <View style={styles.labelWithIconContainer}>
              <ShareIcon
                width={20}
                height={20}
                style={styles.settingIcon}
                stroke={theme.colors.onSurface}
              />
              <Text variant="titleMedium" style={styles.textLabel}>
                {l10n.settings.exportLegacyChats}
              </Text>
            </View>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.exportLegacyChatsDescription}
            </Text>
          </View>
          <Button
            mode="outlined"
            onPress={async () => {
              try {
                await exportLegacyChatSessions();
              } catch {
                infoDialog({
                  title: 'Export Error',
                  message:
                    'Failed to export legacy chat sessions. The file may not exist.',
                });
              }
            }}
            style={styles.menuButton}>
            {l10n.settings.exportButton}
          </Button>
        </View>
      </View>
    </Card.Content>
  </Card>
);
