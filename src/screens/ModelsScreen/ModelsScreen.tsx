import React, {useState, useContext, useEffect} from 'react';
import {FlatList, RefreshControl, Platform, View, Text} from 'react-native';

import {reaction, computed} from 'mobx';
import {v4 as uuidv4} from 'uuid';
import 'react-native-get-random-values';
import {observer} from 'mobx-react-lite';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {pick, types} from '@react-native-documents/picker';
import {Portal, Snackbar} from 'react-native-paper';

import {useTheme} from '../../hooks/useTheme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {infoDialog} from '../../components/ui/InfoDialog';

// B55②：服务器多选列表与文件冲突三选一自系统 Alert → Sheet（
// SearchableSelectSheet 复用 + Sheet 内嵌动作行）
import {SearchableSelectSheet} from '../../components/SearchableSelectSheet';
import {Sheet} from '../../components/Sheet';
import {Pressable} from '../../components/ui/primitives/Pressable';

import {FABGroup} from './FABGroup';
import {ModelCard} from './ModelCard';
import {createStyles} from './styles';
import {HFModelSearch} from './HFModelSearch';
import {ModelAccordion} from './ModelAccordion';
import {ImageGenCatalogRow} from './ImageGenCatalogRow';
import {ModelScopeAddSheet} from './ModelScopeAddSheet';
import {
  DownloadErrorDialog,
  ErrorSnackbar,
  ModelSettingsSheet,
  ModelErrorReportSheet,
  RemoteModelSheet,
  ServerDetailsSheet,
} from '../../components';

import {uiStore, modelStore, hfStore, UIStore, serverStore} from '../../store';

import {L10nContext} from '../../utils';
import {Model, ModelOrigin} from '../../utils/types';
import {ErrorState} from '../../utils/errors';

export const ModelsScreen: React.FC = observer(() => {
  const l10n = useContext(L10nContext);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [hfSearchVisible, setHFSearchVisible] = useState(false);
  const [msSearchVisible, setMsSearchVisible] = useState(false);
  const [isCopyingModel, setIsCopyingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | undefined>();
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Centralized error state tracking - derive directly from MobX stores
  const [activeError, setActiveError] = useState<ErrorState | null>(null);
  const [isShowingErrorDialog, setIsShowingErrorDialog] = useState(false);

  // Model error report sheet state
  const [isErrorReportVisible, setIsErrorReportVisible] = useState(false);
  const [errorToReport, setErrorToReport] = useState<ErrorState | null>(null);

  // Remote model / server details sheets
  const [remoteModelSheetVisible, setRemoteModelSheetVisible] = useState(false);
  const [serverDetailsSheetVisible, setServerDetailsSheetVisible] =
    useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  // B55②：服务器多选列表（SearchableSelectSheet）与文件冲突三选一（Sheet 动作行）
  const [serverPickerVisible, setServerPickerVisible] = useState(false);
  const [fileConflictResolve, setFileConflictResolve] = useState<
    ((choice: 'replace' | 'keep' | 'cancel') => void) | null
  >(null);

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);

  const filters = uiStore.pageStates.modelsScreen.filters;
  const expandedGroups = uiStore.pageStates.modelsScreen.expandedGroups;

  // Set up MobX reactions to track store changes
  useEffect(() => {
    // Create a reaction for error handling
    const errorDisposer = reaction(
      // Track these observable values
      () => ({
        hfError: hfStore.error,
        downloadError: modelStore.downloadError,
        modelLoadError: modelStore.modelLoadError,
      }),
      // React to changes
      data => {
        // First check if there's a download error that should show a dialog
        const hasDialogError =
          data.downloadError && data.downloadError.metadata?.modelId;

        setIsShowingErrorDialog(!!hasDialogError);

        // Then determine which error to show in the snackbar
        if (hasDialogError) {
          // If showing a dialog, don't show snackbar
          setActiveError(null);
        } else if (data.modelLoadError) {
          // Model load errors should show in snackbar
          setActiveError(data.modelLoadError);
        } else if (data.hfError) {
          // If we have an HF error, show it
          setActiveError(data.hfError);
        } else if (data.downloadError) {
          // For download errors without model ID, show in snackbar
          setActiveError(data.downloadError);
        } else {
          // No errors to show
          setActiveError(null);
        }
      },
    );

    // Clean up the reaction when component unmounts
    return () => {
      errorDisposer();
    };
  }, []); // Only run setup once

  const onRefresh = async () => {
    setRefreshing(true);
    await modelStore.refreshDownloadStatuses();
    await modelStore.refreshCatalogImageGenStatus();
    setRefreshing(false);
  };

  // 生图清单条目状态（挂载刷新；下载完成/前台恢复由 ModelStore 同步）
  useEffect(() => {
    modelStore.refreshCatalogImageGenStatus();
  }, []);

  const handleOpenSettings = (model: Model) => {
    setSelectedModel(model);
    setSettingsVisible(true);
  };

  const handleCloseSettings = () => {
    setSettingsVisible(false);
    setSelectedModel(undefined);
  };

  const handleAddRemoteModel = () => {
    setRemoteModelSheetVisible(true);
  };

  const handleManageServers = () => {
    const servers = serverStore.servers;
    if (servers.length === 1) {
      handleOpenServerDetails(servers[0].id);
    } else if (servers.length > 1) {
      // B55②：多服务器列表选择 → SearchableSelectSheet（替代系统 Alert 长列表）
      setServerPickerVisible(true);
    }
  };

  const handleOpenServerDetails = (serverId: string) => {
    setSelectedServerId(serverId);
    setServerDetailsSheetVisible(true);
  };

  const handleDismissError = () => {
    // Clear errors from all stores
    hfStore.clearError();
    modelStore.clearDownloadError();
    modelStore.clearModelLoadError();
  };

  const handleRetryAction = () => {
    if (activeError?.context === 'search') {
      hfStore.fetchModels();
    } else if (activeError?.context === 'download') {
      modelStore.retryDownload();
    } else if (activeError?.context === 'modelInit') {
      // Retry model initialization
      const modelId = activeError.metadata?.modelId;
      if (modelId) {
        const model = modelStore.models.find(m => m.id === modelId);
        if (model) {
          modelStore.selectModel(model);
        }
      }
    }
    handleDismissError();
  };

  const handleReportModelError = () => {
    if (activeError?.context === 'modelInit') {
      setErrorToReport(activeError);
      setIsErrorReportVisible(true);
      handleDismissError();
    }
  };

  const handleCloseErrorReport = () => {
    setIsErrorReportVisible(false);
    setErrorToReport(null);
  };

  const handleAddLocalModel = async () => {
    if (isCopyingModel) {
      return;
    }

    pick({
      type: Platform.OS === 'ios' ? 'public.data' : types.allFiles,
    })
      .then(async res => {
        let [file] = res;
        if (file) {
          // Assign a default name if file.name is null or undefined
          // Not sure if this can ever happen, though.
          let fileName =
            file.name || file.uri.split('/').pop() || `file_${uuidv4()}`;

          const permanentDir = `${RNFS.DocumentDirectoryPath}/models/local`;
          let permanentPath = `${permanentDir}/${fileName}`;
          if (!(await RNFS.exists(permanentDir))) {
            await RNFS.mkdir(permanentDir);
          }

          if (await RNFS.exists(permanentPath)) {
            // B55②：文件冲突三选一 → Sheet 动作行（替代系统 Alert 三按钮），
            // Promise 语义不变：resolve('replace'|'keep'|'cancel')
            const choice = await new Promise<'replace' | 'keep' | 'cancel'>(
              resolve => {
                setFileConflictResolve(() => resolve);
              },
            );
            setFileConflictResolve(null);

            switch (choice) {
              case 'replace':
                await RNFS.unlink(permanentPath);
                modelStore.removeModelByFullPath(permanentPath);
                break;
              case 'keep':
                let counter = 1;
                const nameParts = fileName.split('.');
                const ext = nameParts.length > 1 ? nameParts.pop() : '';
                const name = nameParts.join('.');
                do {
                  permanentPath = `${permanentDir}/${name}_${counter}.${ext}`;
                  counter++;
                } while (await RNFS.exists(permanentPath));
                break;
              case 'cancel':
                console.log('File copy cancelled by user');
                return;
            }
          }

          try {
            setIsCopyingModel(true);
            await RNFS.copyFile(file.uri, permanentPath);
            await modelStore.addLocalModel(permanentPath);
          } catch (e) {
            infoDialog({
              title: l10n.models.fileManagement.copyFailed,
              message: e instanceof Error ? e.message : String(e),
            });
          } finally {
            setIsCopyingModel(false);
          }
        }
      })
      .catch(e => console.log('No file picked, error: ', e.message));
  };

  const activeModelId = modelStore.activeModel?.id;
  const models = modelStore.displayModels;

  // useMemo uses shallow comaprison for dependencies,
  // so we use computed instead for deep comparison
  // (model state changes not-downloaded -> downloaded)
  const filteredAndSortedModels = computed(() => {
    let result = models;
    if (filters.includes('downloaded')) {
      result = result.filter(model => model.isDownloaded);
    }
    if (!filters.includes('grouped')) {
      result = result.sort((a, b) => {
        if (a.isDownloaded && !b.isDownloaded) {
          return -1;
        }
        if (!a.isDownloaded && b.isDownloaded) {
          return 1;
        }
        return 0;
      });
    }
    if (filters.includes('hf')) {
      result = result.filter(model => model.origin === ModelOrigin.HF);
    }
    return result;
  }).get();

  const getGroupDisplayName = (key: string) => {
    switch (key) {
      case UIStore.GROUP_KEYS.READY_TO_USE:
        return l10n.models.labels.availableToUse;
      case UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD:
        return l10n.models.labels.availableToDownload;
      default:
        return key;
    }
  };

  const groupedModels = computed(() => {
    if (!filters.includes('grouped')) {
      return {
        [UIStore.GROUP_KEYS.READY_TO_USE]: filteredAndSortedModels.filter(
          model => model.isDownloaded,
        ),
        [UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD]:
          filteredAndSortedModels.filter(model => !model.isDownloaded),
      };
    }

    return filteredAndSortedModels.reduce(
      (acc, item) => {
        const groupKey =
          item.origin === ModelOrigin.LOCAL || item.isLocal
            ? l10n.models.labels.localModel
            : item.type || l10n.models.labels.unknownGroup;

        if (!acc[groupKey]) {
          acc[groupKey] = [];
        }
        acc[groupKey].push(item);
        return acc;
      },
      {} as Record<string, Model[]>,
    );
  }).get();

  const toggleGroup = (type: string) => {
    const currentExpandedGroups =
      uiStore.pageStates.modelsScreen.expandedGroups;
    const updatedExpandedGroups = {
      ...currentExpandedGroups,
      [type]: !currentExpandedGroups[type],
    };
    uiStore.setValue('modelsScreen', 'expandedGroups', updatedExpandedGroups);
  };

  const renderGroupHeader = ({item: group}) => {
    const isExpanded = expandedGroups[group.type];
    const displayName = filters.includes('grouped')
      ? group.type
      : getGroupDisplayName(group.type);
    const description =
      !filters.includes('grouped') &&
      group.type === UIStore.GROUP_KEYS.AVAILABLE_TO_DOWNLOAD
        ? l10n.models.labels.useAddButtonForMore
        : undefined;
    return (
      <ModelAccordion
        group={{...group, type: displayName}}
        expanded={isExpanded}
        description={description}
        onPress={() => toggleGroup(group.type)}>
        <FlatList
          data={group.items}
          keyExtractor={subItem => subItem.id}
          renderItem={({item: subItem}) => (
            <ModelCard
              model={subItem}
              activeModelId={activeModelId}
              onOpenSettings={() => handleOpenSettings(subItem)}
              onOpenServerDetails={handleOpenServerDetails}
            />
          )}
        />
      </ModelAccordion>
    );
  };

  const flatListModels = Object.keys(groupedModels)
    .map(type => ({
      type,
      items: groupedModels[type],
    }))
    .filter(group => group.items.length > 0);

  // 生图清单区（设置-模型 = 全清单可管理）：独立于 LLM 过滤（路由专工）
  const renderImageGenSection = () => (
    <View style={styles.imageGenSection}>
      <Text style={styles.imageGenTitle}>
        {l10n.models.imageGenCatalog.title}
      </Text>
      {modelStore.catalogImageGenEntries.map(({entry, isDownloaded}) => (
        <ImageGenCatalogRow
          key={entry.id}
          entry={entry}
          isDownloaded={isDownloaded}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container} testID="models-screen">
      {/* Show Error Snackbar only if no dialog is visible */}
      {!isShowingErrorDialog && activeError && (
        <ErrorSnackbar
          error={activeError}
          onDismiss={handleDismissError}
          onRetry={handleRetryAction}
          onReport={handleReportModelError}
        />
      )}

      {/* AIOS scan status + mmproj pairing + memory estimate */}
      <View
        style={{
          paddingHorizontal: theme.spacing.m,
          paddingVertical: theme.spacing.xs,
          backgroundColor: theme.colors.surfaceVariant,
        }}>
        <Text
          style={{
            ...theme.typography.captionS,
            color: theme.colors.onSurfaceVariant,
          }}>
          AIOS 扫描: {modelStore.models.filter(m => m.isLocal).length}{' '}
          个本地模型
          {modelStore.lastScanTime
            ? ` · 最后扫描 ${new Date(modelStore.lastScanTime).toLocaleTimeString()}`
            : ''}
          {' · mmproj 配对 '}
          {
            modelStore.models.filter(
              m =>
                m.supportsMultimodal &&
                m.isDownloaded &&
                m.defaultProjectionModel,
            ).length
          }
          {'/'}
          {
            modelStore.models.filter(
              m => m.supportsMultimodal && m.isDownloaded,
            ).length
          }
          {' · 已加载 '}
          {modelStore.activeModel
            ? modelStore.activeModel.name.slice(0, 16)
            : '无'}
        </Text>
      </View>
      <FlatList
        testID="flat-list"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContainer}
        data={flatListModels}
        keyExtractor={item => item.type}
        extraData={activeModelId}
        renderItem={renderGroupHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListFooterComponent={renderImageGenSection}
      />

      {/* DownloadErrorDialog with Portal for better visibility */}
      <Portal>
        <DownloadErrorDialog
          visible={isShowingErrorDialog}
          onDismiss={() => {
            modelStore.clearDownloadError();
          }}
          error={modelStore.downloadError}
          model={
            modelStore.downloadError?.metadata?.modelId
              ? modelStore.models.find(
                  m => m.id === modelStore.downloadError?.metadata?.modelId,
                )
              : undefined
          }
          onTryAgain={modelStore.retryDownload}
        />
      </Portal>

      <HFModelSearch
        visible={hfSearchVisible}
        onDismiss={() => setHFSearchVisible(false)}
      />
      <ModelScopeAddSheet
        visible={msSearchVisible}
        onDismiss={() => setMsSearchVisible(false)}
      />
      <Snackbar
        testID="copy-model-snackbar"
        visible={isCopyingModel}
        onDismiss={() => {}}
        duration={86400000}>
        {l10n.models.fileManagement.copyingModel}
      </Snackbar>
      <FABGroup
        onAddHFModel={() => setHFSearchVisible(true)}
        onAddModelScopeModel={() => setMsSearchVisible(true)}
        onAddLocalModel={handleAddLocalModel}
        onAddRemoteModel={handleAddRemoteModel}
        onManageServers={handleManageServers}
        hasServers={serverStore.servers.length > 0}
      />
      <ModelSettingsSheet
        isVisible={settingsVisible}
        onClose={handleCloseSettings}
        model={selectedModel}
      />
      <ModelErrorReportSheet
        isVisible={isErrorReportVisible}
        onClose={handleCloseErrorReport}
        error={errorToReport}
      />
      <RemoteModelSheet
        isVisible={remoteModelSheetVisible}
        onDismiss={() => setRemoteModelSheetVisible(false)}
      />
      <ServerDetailsSheet
        isVisible={serverDetailsSheetVisible}
        onDismiss={() => {
          setServerDetailsSheetVisible(false);
          setSelectedServerId(null);
        }}
        serverId={selectedServerId}
      />
      {/* B55②：服务器多选列表（SearchableSelectSheet；选中即开详情） */}
      <SearchableSelectSheet
        isVisible={serverPickerVisible}
        onClose={() => setServerPickerVisible(false)}
        title={l10n.settings.manageServers}
        searchPlaceholder={l10n.settings.languageSearchPlaceholder}
        options={serverStore.servers.map(s => ({value: s.id, label: s.name}))}
        value=""
        onSelect={handleOpenServerDetails}
        optionTestIDPrefix="server-picker-option"
        searchTestID="server-picker-search"
      />
      {/* B55②：文件冲突三选一（替换/保留两者/取消，Promise 语义保留） */}
      <Sheet
        isVisible={fileConflictResolve !== null}
        onClose={() => {
          fileConflictResolve?.('cancel');
          setFileConflictResolve(null);
        }}
        title={l10n.models.fileManagement.fileAlreadyExists}>
        <Sheet.ScrollView>
          <Text style={styles.conflictMessage}>
            {l10n.models.fileManagement.fileAlreadyExistsMessage}
          </Text>
          <Pressable
            testID="conflict-replace-option"
            accessibilityRole="button"
            style={styles.conflictRow}
            onPress={() => fileConflictResolve?.('replace')}>
            <Text style={styles.conflictRowLabelDanger}>
              {l10n.models.fileManagement.replace}
            </Text>
          </Pressable>
          <Pressable
            testID="conflict-keep-option"
            accessibilityRole="button"
            style={styles.conflictRow}
            onPress={() => fileConflictResolve?.('keep')}>
            <Text style={styles.conflictRowLabel}>
              {l10n.models.fileManagement.keepBoth}
            </Text>
          </Pressable>
          <Pressable
            testID="conflict-cancel-option"
            accessibilityRole="button"
            style={styles.conflictRow}
            onPress={() => fileConflictResolve?.('cancel')}>
            <Text style={styles.conflictRowLabel}>{l10n.common.cancel}</Text>
          </Pressable>
        </Sheet.ScrollView>
      </Sheet>
    </View>
  );
});
