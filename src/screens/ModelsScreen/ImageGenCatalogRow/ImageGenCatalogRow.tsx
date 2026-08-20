import React, {useCallback, useContext, useState} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

import {useTheme} from '../../../hooks';
import {L10nContext} from '../../../utils';
import {ROUTES} from '../../../utils/navigationConstants';
import {CatalogModel} from '../../../utils/modelCatalog';
import {
  DownloadSource,
  getAvailableSources,
} from '../../../utils/downloadSources';
import {modelStore} from '../../../store';
import {DownloadSourceSheet} from '../DownloadSourceSheet';

import {createStyles} from './styles';

interface ImageGenCatalogRowProps {
  entry: CatalogModel;
  isDownloaded: boolean;
}

/**
 * 生图清单条目行（设置-模型页）：状态 = main 文件存在性（ModelStore 刷新）。
 * 已下载 → 「去生图页」；未下载 → 有源显示下载（多源弹选择），无源显示
 * 「请本地导入」→ 跳模型目录页（不提供死按钮——锋利）。
 */
export const ImageGenCatalogRow: React.FC<ImageGenCatalogRowProps> = ({
  entry,
  isDownloaded,
}) => {
  const theme = useTheme();
  const l10n = useContext(L10nContext);
  const styles = createStyles(theme);
  const navigation = useNavigation();

  const [sourceVisible, setSourceVisible] = useState(false);

  const sources = getAvailableSources(entry);
  const isDownloading = modelStore.isCatalogEntryDownloading(entry.id);
  const hasSource = sources.length > 0;

  const handleDownload = useCallback(() => {
    if (sources.length > 1) {
      setSourceVisible(true);
      return;
    }
    modelStore.downloadCatalogEntry(entry.id, sources[0]);
  }, [entry.id, sources]);

  const handleSourceSelect = useCallback(
    (source: DownloadSource) => {
      setSourceVisible(false);
      modelStore.downloadCatalogEntry(entry.id, source);
    },
    [entry.id],
  );

  const handleGoImageGen = useCallback(() => {
    navigation.navigate(ROUTES.IMAGE_GEN as never);
  }, [navigation]);

  // 无在线源条目（自制 ONNX 等）：引导本地导入 → 模型目录页（目录页展示
  // AIOS 目录位置，用户自行放入文件后回模型页下拉刷新即现）
  const handleGoModelDirs = useCallback(() => {
    navigation.navigate(ROUTES.MODEL_DIRS as never);
  }, [navigation]);

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{entry.displayName}</Text>
        {entry.role ? (
          <Text style={styles.rowRole}>{entry.role}</Text>
        ) : null}
        <Text style={styles.rowRole}>
          {entry.file.name}
          {entry.extras?.length ? ` +${entry.extras.length}` : ''}
        </Text>
      </View>
      <View style={styles.rowActions}>
        {isDownloaded ? (
          <Button
            testID={`catalog-imagegen-open-${entry.id}`}
            mode="contained-tonal"
            compact
            onPress={handleGoImageGen}>
            {l10n.models.imageGenCatalog.goImageGen}
          </Button>
        ) : isDownloading ? (
          <Button mode="outlined" compact loading disabled>
            {l10n.models.imageGenCatalog.downloading}
          </Button>
        ) : hasSource ? (
          <Button
            testID={`catalog-imagegen-download-${entry.id}`}
            mode="outlined"
            compact
            disabled={isDownloading}
            onPress={handleDownload}>
            {l10n.models.imageGenCatalog.download}
          </Button>
        ) : (
          <TouchableOpacity
            testID={`catalog-imagegen-nosource-${entry.id}`}
            accessibilityRole="button"
            onPress={handleGoModelDirs}>
            <Text style={styles.noSource}>
              {l10n.models.downloadSource.localImport}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <DownloadSourceSheet
        visible={sourceVisible}
        sources={sources}
        onDismiss={() => setSourceVisible(false)}
        onSelect={handleSourceSelect}
      />
    </View>
  );
};
