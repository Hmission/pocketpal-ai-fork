import React, {useContext} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Text} from 'react-native-paper';

import {useTheme} from '../../../hooks';
import {L10nContext} from '../../../utils';
import {Sheet} from '../../../components';
import {DownloadSource} from '../../../utils/downloadSources';

import {createStyles} from './styles';

interface DownloadSourceSheetProps {
  visible: boolean;
  sources: DownloadSource[];
  onDismiss: () => void;
  onSelect: (source: DownloadSource) => void;
}

/**
 * 下载源选择（HF / ModelScope 双源）：catalog 条目声明多源时，下载前弹此
 * sheet 由用户选择；单源/自搜添加条目不弹（源跟随来源，不增加困惑）。
 */
export const DownloadSourceSheet: React.FC<DownloadSourceSheetProps> = ({
  visible,
  sources,
  onDismiss,
  onSelect,
}) => {
  const theme = useTheme();
  const l10n = useContext(L10nContext);
  const styles = createStyles(theme);

  const renderRow = (source: DownloadSource) => {
    const isHf = source === 'hf';
    const label = isHf
      ? l10n.models.downloadSource.hf
      : l10n.models.downloadSource.modelscope;
    const description = isHf
      ? l10n.models.downloadSource.hfDescription
      : l10n.models.downloadSource.modelscopeDescription;
    return (
      <TouchableOpacity
        key={source}
        testID={`download-source-${source}`}
        accessibilityRole="button"
        style={styles.row}
        onPress={() => onSelect(source)}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowDescription}>{description}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Sheet
      isVisible={visible}
      title={l10n.models.downloadSource.title}
      snapPoints={['35%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onDismiss}
      showCloseButton={true}>
      <View style={styles.content}>
        {sources.includes('hf') && renderRow('hf')}
        {sources.includes('modelscope') && renderRow('modelscope')}
      </View>
    </Sheet>
  );
};
