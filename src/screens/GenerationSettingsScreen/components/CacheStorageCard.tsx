import React from 'react';
import {View} from 'react-native';

import {Text, Card, Button} from 'react-native-paper';

import {t} from '../../../locales';
import {
  L10nContext,
  formatBytes,
  clearAllSessionCaches,
  getSessionCacheInfo,
} from '../../../utils';
import {infoDialog} from '../../../components/ui/InfoDialog';
import {confirmDialog} from '../../../components/ui/ConfirmDialog';

import {createStyles} from '../styles';

type L10n = React.ContextType<typeof L10nContext>;
type SettingsStyles = ReturnType<typeof createStyles>;

export interface CacheStorageCardProps {
  l10n: L10n;
  styles: SettingsStyles;
}

/**
 * CacheStorageCard — 缓存与存储卡（iOS only，Shortcuts 会话缓存清理）。
 * R3-P1 从 GenerationSettingsScreen 原样迁出，零行为变化。
 */
export const CacheStorageCard: React.FC<CacheStorageCardProps> = ({
  l10n,
  styles,
}) => (
  <Card elevation={0} style={styles.card}>
    <Card.Title title={l10n.settings.cacheStorageTitle} />
    <Card.Content>
      <View style={styles.settingItemContainer}>
        {/* Clear Shortcuts Caches */}
        <View style={styles.switchContainer}>
          <View style={styles.textContainer}>
            <Text variant="titleMedium" style={styles.textLabel}>
              {l10n.settings.clearPalCaches}
            </Text>
            <Text variant="labelSmall" style={styles.textDescription}>
              {l10n.settings.clearPalCachesDescription}
            </Text>
          </View>
          <Button
            mode="outlined"
            onPress={async () => {
              try {
                // Get cache info first
                const cacheInfo = await getSessionCacheInfo();

                if (cacheInfo.fileCount === 0) {
                  infoDialog({
                    title: l10n.settings.clearPalCaches,
                    message: l10n.settings.noCachesToClear,
                  });
                  return;
                }

                // Show confirmation dialog with cache info
                const formattedSize = formatBytes(cacheInfo.totalSizeBytes);
                const confirmMessage = t(
                  l10n.settings.clearCachesConfirmMessage,
                  {
                    fileCount: cacheInfo.fileCount.toString(),
                    size: formattedSize,
                  },
                );

                void confirmDialog({
                  title: l10n.settings.clearCachesConfirmTitle,
                  message: confirmMessage,
                  confirmText: l10n.settings.clearCachesButton,
                  cancelText: l10n.common.cancel,
                  destructive: true,
                }).then(async ok => {
                  if (!ok) {
                    return;
                  }
                  try {
                    const deletedCount = await clearAllSessionCaches();
                    const successMessage = t(l10n.settings.clearCachesSuccess, {
                      count: deletedCount.toString(),
                    });
                    infoDialog({
                      title: l10n.settings.clearPalCaches,
                      message: successMessage,
                    });
                  } catch (error) {
                    console.error('Failed to clear caches:', error);
                    infoDialog({
                      title: l10n.settings.clearPalCaches,
                      message: l10n.settings.clearCachesError,
                    });
                  }
                });
              } catch (error) {
                console.error('Failed to get cache info:', error);
                infoDialog({
                  title: l10n.settings.clearPalCaches,
                  message: l10n.settings.clearCachesError,
                });
              }
            }}
            style={styles.menuButton}>
            {l10n.settings.clearCachesButton}
          </Button>
        </View>
      </View>
    </Card.Content>
  </Card>
);
