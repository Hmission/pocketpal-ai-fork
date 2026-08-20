import React, {useCallback, useContext, useState} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Text, Button, TextInput as PaperTextInput} from 'react-native-paper';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';

import {useTheme} from '../../../hooks';
import {L10nContext} from '../../../utils';
import {Sheet} from '../../../components';
import {fetchModelDetail, isValidModelScopeRepoId} from '../../../api/modelscope';
import {HuggingFaceModel, ModelFile} from '../../../utils/types';
import {getLLMFiles, formatBytes} from '../../../utils';
import {modelStore} from '../../../store';

import {createStyles} from './styles';

interface ModelScopeAddSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * ModelScope（魔搭）repo 直达添加：输入/粘贴 repo id → 详情 + 文件列表 →
 * 选 GGUF 文件 → 复用 downloadHFModel 链路下载（modelFile.url 已指向
 * ModelScope resolve URL，源跟随来源）。全文搜索无公开 API，不做爬虫。
 */
export const ModelScopeAddSheet: React.FC<ModelScopeAddSheetProps> = ({
  visible,
  onDismiss,
}) => {
  const theme = useTheme();
  const l10n = useContext(L10nContext);
  const styles = createStyles(theme);

  const [repoId, setRepoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<HuggingFaceModel | null>(null);

  const reset = useCallback(() => {
    setRepoId('');
    setLoading(false);
    setError(null);
    setModel(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onDismiss();
  }, [reset, onDismiss]);

  const handleLookup = useCallback(async () => {
    if (!isValidModelScopeRepoId(repoId)) {
      setError(l10n.models.modelScopeAdd.invalidRepoId);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hfModel = await fetchModelDetail(repoId);
      if (!getLLMFiles(hfModel.siblings ?? []).length) {
        setError(l10n.models.modelScopeAdd.noGgufFiles);
        setModel(null);
        return;
      }
      setModel(hfModel);
    } catch (e) {
      console.warn('[ModelScopeAdd] lookup failed:', e);
      setError(l10n.models.modelScopeAdd.lookupFailed);
      setModel(null);
    } finally {
      setLoading(false);
    }
  }, [repoId, l10n]);

  const handleDownloadFile = useCallback(
    (file: ModelFile) => {
      if (!model) {
        return;
      }
      modelStore.downloadHFModel(model, file, {enableVision: true});
      handleClose();
    },
    [model, modelStore, handleClose],
  );

  const renderFile = ({item}: {item: ModelFile}) => (
    <TouchableOpacity
      testID={`modelscope-file-${item.rfilename}`}
      accessibilityRole="button"
      style={styles.fileRow}
      onPress={() => handleDownloadFile(item)}>
      <View style={styles.fileText}>
        <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
          {item.rfilename}
        </Text>
        <Text style={styles.fileSize}>{formatBytes(item.size ?? 0)}</Text>
      </View>
      <Button mode="outlined" compact>
        {l10n.models.modelCard.buttons.download}
      </Button>
    </TouchableOpacity>
  );

  return (
    <Sheet
      isVisible={visible}
      title={l10n.models.modelScopeAdd.title}
      snapPoints={['70%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableContentPanningGesture={false}
      onClose={handleClose}
      showCloseButton={true}>
      <View style={styles.content}>
        <PaperTextInput
          testID="modelscope-repo-input"
          mode="outlined"
          label={l10n.models.modelScopeAdd.repoLabel}
          placeholder={l10n.models.modelScopeAdd.repoPlaceholder}
          value={repoId}
          onChangeText={setRepoId}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Button
          testID="modelscope-lookup-button"
          mode="contained"
          loading={loading}
          disabled={loading || !repoId.trim()}
          onPress={handleLookup}
          style={styles.lookupButton}>
          {l10n.models.modelScopeAdd.lookup}
        </Button>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {model ? (
          <>
            <Text style={styles.modelTitle}>{model.id}</Text>
            <Text style={styles.sectionTitle}>
              {l10n.models.modelScopeAdd.filesTitle}
            </Text>
          </>
        ) : null}
      </View>
      {model ? (
        <BottomSheetFlatList
          data={getLLMFiles(model.siblings ?? [])}
          keyExtractor={(item: ModelFile) => item.rfilename}
          renderItem={renderFile}
          renderScrollComponent={props => (
            <Sheet.ScrollView bottomOffset={100} {...props} />
          )}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </Sheet>
  );
};
