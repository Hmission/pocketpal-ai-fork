import React, {useContext} from 'react';
import {StyleSheet, View} from 'react-native';
import {observer} from 'mobx-react';
import {useNavigation, NavigationProp} from '@react-navigation/native';

import {BannerBar} from '../ui/BannerBar';
import {useTheme} from '../../hooks/useTheme';
import {modelStore, palStore, uiStore} from '../../store';
import {L10nContext} from '../../utils';
import {ROUTES} from '../../utils/navigationConstants';
import {Theme} from '../../utils/types';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    iconSlot: {
      width: 24,
      height: 24,
      borderRadius: theme.radius.full,
    },
  });

const formatSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) {
    return '';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  return `${Math.round(bytes / (1024 * 1024))} MB`;
};

/**
 * Sticky single-row banner showing the first non-dismissed active download.
 *
 * Affordances:
 *   - Body tap → Models screen (the home for multi-download management;
 *     the +N badge telegraphs that there are more behind the visible one).
 *   - Stop pill → cancels the visible download. Pal stays bound to the
 *     model so the user can resume from the Models screen.
 *   - × icon  → dismisses the banner for this download only. Download
 *     continues. Dismissal clears when the download disappears.
 *
 * 渲染底座：ui/BannerBar（DESIGN_SPEC §12.3）；avatar 与 stop pill 为业务专属。
 */
export const DownloadBanner: React.FC = observer(() => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<any>>();
  const l10n = useContext(L10nContext);

  const styles = createStyles(theme);

  const visible = modelStore.activeDownloads.find(
    d => !uiStore.isDownloadBannerDismissed(d.modelId),
  );
  if (!visible) {
    return null;
  }

  // Match the download's model id to a local pal so we can show the pal
  // name (the user's mental model is "Pip is downloading", not the
  // filename). Falls back to the model name when no pal owns it (manual
  // download from Models screen).
  const pal = palStore.pals.find(
    p =>
      p.source === 'local' &&
      p.defaultModel &&
      p.defaultModel.id === visible.modelId,
  );
  const subject = pal ? pal.name : visible.model.name;
  const title = (
    pal ? l10n.downloadBanner.titleByPal : l10n.downloadBanner.titleByModel
  ).replace('{{name}}', subject);
  const eta = visible.etaLabel || formatSize(visible.bytesTotal);
  const clamped = Math.max(0, Math.min(100, visible.progress));
  const extraCount = Math.max(0, modelStore.activeDownloads.length - 1);
  const text = `${title}${extraCount > 0 ? ` +${extraCount}` : ''}${
    eta ? ` · ${eta}` : ''
  }`;
  const iconSlotBg = {
    backgroundColor: pal?.color?.[0] ?? theme.colors.surfaceVariant,
  };

  return (
    <BannerBar
      testID="download-banner"
      onPress={() => navigation.navigate(ROUTES.MODELS as never)}
      icon={
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.iconSlot, iconSlotBg]}
        />
      }
      text={text}
      progress={clamped}
      actions={[
        {
          label: l10n.common.stop,
          onPress: () => modelStore.cancelDownload(visible.modelId),
          testID: 'download-banner-stop',
        },
      ]}
      onDismiss={() => uiStore.dismissDownloadBanner(visible.modelId)}
      dismissTestID="download-banner-dismiss"
    />
  );
});
