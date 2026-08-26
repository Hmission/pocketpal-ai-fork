import React, {useCallback, useState, useEffect, useMemo} from 'react';
import {
  Linking,
  View,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';

import {observer} from 'mobx-react-lite';
import {useNavigation} from '@react-navigation/native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {ROUTES} from '../../../utils/navigationConstants';
import {Progress} from '../../../components/ui/Progress';
import {
  Card,
  Icon,
  Button,
  IconButton,
  Text,
  TouchableRipple,
  Snackbar,
  Switch,
  HelperText,
} from 'react-native-paper';

import {ProjectionModelSelector, MemoryRequirement} from '../../../components';

import {useTheme, useMemoryCheck, useStorageCheck} from '../../../hooks';

import {createStyles} from './styles';
import {confirmDialog} from '../../../components/ui/ConfirmDialog';
import {infoDialog} from '../../../components/ui/InfoDialog';

import {uiStore, modelStore, serverStore} from '../../../store';
import {t} from '../../../locales';

import {guardBeforeDownload} from '../../../utils/downloadGuard';
import {getAvailableSources} from '../../../utils/downloadSources';
import {catalogEntryByFilename} from '../../../utils/modelCatalog';
import {DownloadSourceSheet} from '../DownloadSourceSheet';
import type {DownloadSource} from '../../../utils/downloadSources';

import {
  Model,
  ModelOrigin,
  ModelType,
  RootDrawerParamList,
} from '../../../utils/types';
import {
  getModelSizeString,
  L10nContext,
  checkModelFileIntegrity,
  getModelSkills,
  formatNumber,
} from '../../../utils';

import {
  LinkExternalIcon,
  TrashIcon,
  SettingsIcon,
  CpuChipIcon,
  EyeIcon,
  ChatIcon,
  XIcon,
  ChevronSelectorVerticalIcon,
  ChevronSelectorExpandedVerticalIcon,
} from '../../../assets/icons';

type ChatScreenNavigationProp = DrawerNavigationProp<RootDrawerParamList>;

interface ModelCardProps {
  model: Model;
  activeModelId?: string;
  onFocus?: () => void;
  onOpenSettings?: () => void;
  onOpenServerDetails?: (serverId: string) => void;
}

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const ModelCard: React.FC<ModelCardProps> = observer(
  ({model, activeModelId, onOpenSettings, onOpenServerDetails}) => {
    const l10n = React.useContext(L10nContext);
    const theme = useTheme();
    const styles = createStyles(theme);

    const navigation = useNavigation<ChatScreenNavigationProp>();

    const [snackbarVisible, setSnackbarVisible] = useState(false); // Snackbar visibility
    const [integrityError, setIntegrityError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [downloadSourceVisible, setDownloadSourceVisible] = useState(false);

    // Resolve projection model for memory check (same logic as ModelStore.checkMemoryAndConfirm)
    // Resolve projection model for memory check (same logic as ModelStore.checkMemoryAndConfirm)
    const projectionModelForCheck = useMemo(
      () => {
        if (
          model.supportsMultimodal &&
          modelStore.getModelVisionPreference(model) &&
          model.defaultProjectionModel
        ) {
          return modelStore.models.find(
            m => m.id === model.defaultProjectionModel,
          );
        }
        return undefined;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- MobX observable tracked by observer()
      [model, modelStore.models],
    );

    const {memoryWarning, shortMemoryWarning, multimodalWarning} =
      useMemoryCheck(model, projectionModelForCheck);
    const {isOk: storageOk, message: storageNOkMessage} = useStorageCheck(
      model,
      {
        enablePeriodicCheck: true,
        checkInterval: 10000,
      },
    );

    const isActiveModel = activeModelId === model.id;
    const isDownloaded = model.isDownloaded;
    const isDownloading = modelStore.isDownloading(model.id);
    const isHfModel = model.origin === ModelOrigin.HF;
    const isRemoteModel = model.origin === ModelOrigin.REMOTE;
    const cardId = model.filename || model.id;

    const modelCaps = modelStore.capsFor(model);
    const visionLabel =
      modelCaps.vision === 'yes'
        ? l10n.models.modelCard.labels.visionSupported
        : modelCaps.vision === 'no'
          ? l10n.models.modelCard.labels.visionNotSupported
          : l10n.models.modelCard.labels.visionUnknown;

    // Check projection model status for downloaded vision models
    const projectionModelStatus = modelStore.getProjectionModelStatus(model);
    const hasProjectionModelWarning =
      isDownloaded &&
      model.supportsMultimodal &&
      modelStore.getModelVisionPreference(model) && // Only show warning when vision is enabled
      projectionModelStatus.state === 'missing';

    // Check integrity when model is downloaded (skip remote models — no local file)
    useEffect(() => {
      if (isDownloaded && !isRemoteModel) {
        checkModelFileIntegrity(model).then(({errorMessage}) => {
          setIntegrityError(errorMessage);
        });
      } else {
        setIntegrityError(null);
      }
    }, [isDownloaded, isRemoteModel, model]);

    const handleDelete = useCallback(async () => {
      if (model.isDownloaded) {
        // Special handling for projection models
        if (model.modelType === ModelType.PROJECTION) {
          const canDeleteResult = modelStore.canDeleteProjectionModel(model.id);

          if (!canDeleteResult.canDelete) {
            // Show error dialog with specific reason
            let message =
              canDeleteResult.reason ||
              l10n.models.multimodal.cannotDeleteTitle;

            if (
              canDeleteResult.reason === 'Projection model is currently active'
            ) {
              message = l10n.models.multimodal.cannotDeleteActive;
            } else if (
              canDeleteResult.dependentModels &&
              canDeleteResult.dependentModels.length > 0
            ) {
              const modelNames = canDeleteResult.dependentModels
                .map(m => m.name)
                .join(', ');
              message = `${l10n.models.multimodal.cannotDeleteInUse}\n\n${l10n.models.multimodal.dependentModels} ${modelNames}`;
            }

            infoDialog({
              title: l10n.models.multimodal.cannotDeleteTitle,
              message,
              buttonText: l10n.common.ok,
            });
            return;
          }

          // Show projection-specific confirmation dialog
          const okProjection = await confirmDialog({
            title: l10n.models.multimodal.deleteProjectionTitle,
            message: l10n.models.multimodal.deleteProjectionMessage,
            confirmText: l10n.common.delete,
            cancelText: l10n.common.cancel,
            destructive: true,
          });
          if (okProjection) {
            try {
              await modelStore.deleteModel(model);
            } catch (error) {
              console.error('Failed to delete projection model:', error);
              infoDialog({
                title: l10n.models.multimodal.cannotDeleteTitle,
                message:
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
                buttonText: l10n.common.ok,
              });
            }
          }
        } else {
          // Standard model deletion
          const okDelete = await confirmDialog({
            title: l10n.models.modelCard.alerts.deleteTitle,
            message: l10n.models.modelCard.alerts.deleteMessage,
            confirmText: l10n.common.delete,
            cancelText: l10n.common.cancel,
            destructive: true,
          });
          if (okDelete) {
            await modelStore.deleteModel(model);
          }
        }
      }
    }, [model, l10n]);

    const openHuggingFaceUrl = useCallback(() => {
      if (model.hfUrl) {
        Linking.openURL(model.hfUrl).catch(err => {
          console.error('Failed to open URL:', err);
          setSnackbarVisible(true);
        });
      }
    }, [model.hfUrl]);

    const handleRemove = useCallback(async () => {
      const ok = await confirmDialog({
        title: l10n.models.modelCard.alerts.removeTitle,
        message: l10n.models.modelCard.alerts.removeMessage,
        confirmText: l10n.models.modelCard.buttons.remove,
        cancelText: l10n.common.cancel,
        destructive: true,
      });
      if (ok) {
        modelStore.removeModelFromList(model);
      }
    }, [model, l10n]);

    const handleWarningPress = () => {
      setSnackbarVisible(true);
    };

    // 无在线源条目（MiniCPM 管家 / DreamLite 等自制产物）：引导本地导入，
    // 跳转模型目录页——目录页展示 AIOS 目录位置，用户自行放入文件后
    // 回模型页下拉刷新即现（锋利：不造死按钮，不给猜的 URL）。
    const handleLocalImport = useCallback(() => {
      navigation.navigate(ROUTES.MODEL_DIRS as never);
    }, [navigation]);

    // 下载前置守卫链（守卫 hook 指南针）：权限 → 源 → 状态 → 存储，任一失败
    // 显式返回原因；通过后 catalog 条目多源（HF/ModelScope）弹源选择，单源直下。
    const handleDownloadPress = useCallback(async () => {
      const guard = await guardBeforeDownload(model);
      if (!guard.ok) {
        if (guard.reason === 'no-source') {
          // 无在线源条目：提示而非死按钮
          setSnackbarVisible(true);
        } else if (guard.reason === 'storage') {
          setSnackbarVisible(true);
        }
        // permission：ensureStorageAccess 已弹引导；downloaded/downloading：幂等忽略
        return;
      }
      const entry = catalogEntryByFilename(model.filename);
      const sources = entry ? getAvailableSources(entry) : [];
      if (sources.length > 1) {
        setDownloadSourceVisible(true);
        return;
      }
      modelStore.checkSpaceAndDownload(model.id);
    }, [model]);

    const handleDownloadSourceSelect = useCallback(
      (source: DownloadSource) => {
        setDownloadSourceVisible(false);
        modelStore.checkSpaceAndDownload(model.id, source);
      },
      [model.id],
    );

    const handleProjectionWarningPress = useCallback(() => {
      if (model.defaultProjectionModel) {
        // Try to download the missing projection model
        modelStore.checkSpaceAndDownload(model.defaultProjectionModel);
      }
      // Note: If no default projection model, user can manually select one in the vision controls
    }, [model.defaultProjectionModel]);

    const handleVisionToggle = useCallback(
      async (enabled: boolean) => {
        try {
          await modelStore.setModelVisionEnabled(model.id, enabled);
        } catch (error) {
          console.error('Failed to toggle vision setting:', error);
          // The error is already handled in setModelVisionEnabled (vision state is reverted)
        }
      },
      [model.id],
    );

    const handleProjectionModelSelect = useCallback(
      (projectionModelId: string) => {
        modelStore.setDefaultProjectionModel(model.id, projectionModelId);
      },
      [model.id],
    );

    // Helper function to get model type icon - updated sizes
    const getModelTypeIcon = () => {
      if (modelCaps.vision === 'yes') {
        return (
          <EyeIcon
            width={16}
            height={16}
            stroke={theme.colors.iconModelTypeVision}
          />
        );
      }
      // Default to chat icon for text models
      return (
        <ChatIcon
          width={16}
          height={16}
          stroke={theme.colors.iconModelTypeText}
        />
      );
    };

    // Helper function to get status dot
    const getStatusDot = () => {
      if (!isDownloaded) {
        return null;
      }
      return (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isActiveModel
                ? theme.colors.bgStatusActive
                : theme.colors.bgStatusIdle,
            },
          ]}
        />
      );
    };

    // Helper function to toggle expanded state with smooth LayoutAnimation
    const toggleExpanded = useCallback(() => {
      LayoutAnimation.configureNext({
        duration: 300,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.scaleXY,
        },
      });
      setIsExpanded(!isExpanded);
    }, [isExpanded]);

    const handleRemoteDelete = useCallback(async () => {
      if (!model.serverId || !model.remoteModelId) {
        return;
      }
      const sName = model.serverName || 'Remote';
      const ok = await confirmDialog({
        title: l10n.common.delete,
        message: t(l10n.settings.removeRemoteModel, {
          modelName: model.name,
          serverName: sName,
        }),
        confirmText: l10n.common.delete,
        cancelText: l10n.common.cancel,
        destructive: true,
      });
      if (ok) {
        if (isActiveModel) {
          modelStore.manualReleaseContext();
        }
        serverStore.removeUserSelectedModel(
          model.serverId!,
          model.remoteModelId!,
        );
        serverStore.removeServerIfOrphaned(model.serverId!);
      }
    }, [model, l10n, isActiveModel]);

    const renderActionButtons = () => {
      // Remote models: load/offload + settings (reasoning override) + delete
      if (isRemoteModel) {
        return (
          <View style={styles.actionButtonsRow}>
            {renderModelLoadButton()}
            <TouchableOpacity
              testID="settings-button"
              onPress={onOpenSettings}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={l10n.models.modelCard.buttons.settings}>
              <SettingsIcon
                width={16}
                height={16}
                stroke={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
            <TouchableOpacity
              testID="delete-button"
              onPress={handleRemoteDelete}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={l10n.common.delete}>
              <TrashIcon width={16} height={16} stroke={theme.colors.error} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="expand-details-button"
              onPress={toggleExpanded}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={
                isExpanded
                  ? l10n.models.modelCard.accessibility.collapseDetails
                  : l10n.models.modelCard.accessibility.expandDetails
              }>
              {isExpanded ? (
                <ChevronSelectorExpandedVerticalIcon
                  width={16}
                  height={16}
                  stroke={theme.colors.onSurfaceVariant}
                />
              ) : (
                <ChevronSelectorVerticalIcon
                  width={16}
                  height={16}
                  stroke={theme.colors.onSurfaceVariant}
                />
              )}
            </TouchableOpacity>
          </View>
        );
      }

      if (isDownloading) {
        // Downloading state - show cancel button
        return (
          <View style={styles.actionButtonsRow}>
            <Button
              testID="cancel-button"
              icon="close"
              mode="outlined"
              onPress={() => modelStore.cancelDownload(model.id)}
              style={[
                styles.primaryActionButton,
                {
                  backgroundColor: theme.colors.errorContainer,
                  borderColor: theme.colors.error,
                },
              ]}
              textColor={theme.colors.error}>
              {l10n.common.cancel}
            </Button>
          </View>
        );
      }

      if (!isDownloaded) {
        // Not downloaded state
        const hasNoSource = !model.downloadUrl;
        return (
          <View style={styles.actionButtonsRow}>
            <Button
              testID="download-button"
              icon="download"
              mode="outlined"
              onPress={hasNoSource ? handleLocalImport : handleDownloadPress}
              disabled={!storageOk || isDownloading}
              style={[
                styles.primaryActionButton,
                storageOk && !hasNoSource
                  ? {
                      backgroundColor: theme.colors.btnDownloadBg,
                      borderColor: theme.colors.btnDownloadBorder,
                    }
                  : {
                      backgroundColor: theme.colors.surfaceDim,
                      borderColor: theme.colors.outline,
                    },
              ]}
              textColor={theme.colors.btnDownloadText}>
              {hasNoSource
                ? l10n.models.downloadSource.localImport
                : l10n.models.modelCard.buttons.download}
            </Button>

            <TouchableOpacity
              testID="settings-button"
              onPress={onOpenSettings}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={l10n.models.modelCard.buttons.settings}>
              <SettingsIcon
                width={16}
                height={16}
                stroke={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {isHfModel && (
              <TouchableOpacity
                testID="remove-model-button"
                onPress={handleRemove}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={l10n.models.modelCard.buttons.remove}>
                <XIcon width={20} height={20} stroke={theme.colors.error} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              testID="expand-details-button"
              onPress={toggleExpanded}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={
                isExpanded
                  ? l10n.models.modelCard.accessibility.collapseDetails
                  : l10n.models.modelCard.accessibility.expandDetails
              }>
              {isExpanded ? (
                <ChevronSelectorExpandedVerticalIcon
                  width={16}
                  height={16}
                  stroke={theme.colors.onSurfaceVariant}
                />
              ) : (
                <ChevronSelectorVerticalIcon
                  width={16}
                  height={16}
                  stroke={theme.colors.onSurfaceVariant}
                />
              )}
            </TouchableOpacity>
          </View>
        );
      }

      // Downloaded state - soft blue styling
      return (
        <View style={styles.actionButtonsRow}>
          {renderModelLoadButton()}

          <TouchableOpacity
            testID="settings-button"
            onPress={onOpenSettings}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={l10n.models.modelCard.buttons.settings}>
            <SettingsIcon
              width={16}
              height={16}
              stroke={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          <TouchableOpacity
            testID="delete-button"
            onPress={() => handleDelete()}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={l10n.common.delete}>
            <TrashIcon width={16} height={16} stroke={theme.colors.error} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="expand-details-button"
            onPress={toggleExpanded}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded
                ? l10n.models.modelCard.accessibility.collapseDetails
                : l10n.models.modelCard.accessibility.expandDetails
            }>
            {isExpanded ? (
              <ChevronSelectorExpandedVerticalIcon
                width={16}
                height={16}
                stroke={theme.colors.onSurfaceVariant}
              />
            ) : (
              <ChevronSelectorVerticalIcon
                width={16}
                height={16}
                stroke={theme.colors.onSurfaceVariant}
              />
            )}
          </TouchableOpacity>
        </View>
      );
    };

    const renderModelLoadButton = () => {
      if (
        modelStore.isContextLoading &&
        modelStore.loadingModel?.id === model.id
      ) {
        return (
          <Button
            testID="loading-indicator"
            disabled={true}
            loading={true}
            style={[
              styles.primaryActionButton,
              {
                backgroundColor: theme.colors.btnPrimaryBg,
                borderColor: theme.colors.btnPrimaryBorder,
              },
            ]}
            textColor={theme.colors.btnPrimaryText}>
            {''}
          </Button>
        );
      }

      const handlePress = async () => {
        if (isActiveModel) {
          modelStore.manualReleaseContext();
        } else {
          try {
            await modelStore.selectModel(model);
            if (uiStore.autoNavigatetoChat) {
              navigation.navigate('Chat');
            }
          } catch (e) {
            console.log(`Error: ${e}`);
          }
        }
      };

      const getButtonText = () => {
        if (isActiveModel) {
          return l10n.models.modelCard.buttons.offload;
        }
        return l10n.models.modelCard.buttons.load;
      };

      const getButtonStyle = () => {
        if (isActiveModel) {
          return {
            backgroundColor: theme.colors.btnReadyBg,
            borderColor: theme.colors.btnReadyBorder,
          };
        }
        return {
          backgroundColor: theme.colors.btnPrimaryBg,
          borderColor: theme.colors.btnPrimaryBorder,
        };
      };

      const getTextColor = () => {
        if (isActiveModel) {
          return theme.colors.btnReadyText;
        }
        return theme.colors.btnPrimaryText;
      };

      return (
        <Button
          testID={isActiveModel ? 'offload-button' : 'load-button'}
          accessibilityLabel={isActiveModel ? 'Offload model' : 'Load model'}
          icon={isActiveModel ? 'eject' : 'play-circle-outline'}
          //mode="contained-tonal"
          onPress={handlePress}
          style={[styles.primaryActionButton, getButtonStyle()]}
          textColor={getTextColor()}>
          {getButtonText()}
        </Button>
      );
    };

    return (
      <>
        <Card elevation={0} style={styles.card} testID={`model-card-${cardId}`}>
          {/* Compact Header */}
          <View style={styles.compactHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View
                  style={styles.modelTypeIcon}
                  {...(isRemoteModel && {
                    accessible: true,
                    accessibilityLabel: `${l10n.models.modelCard.labels.vision}: ${visionLabel}`,
                    testID: `model-card-vision-${cardId}`,
                  })}>
                  {getModelTypeIcon()}
                </View>
                <Text
                  variant="titleSmall"
                  style={styles.compactModelName}
                  numberOfLines={1}
                  ellipsizeMode="middle">
                  {model.name}
                </Text>
              </View>
              <View style={styles.headerRight}>
                {isRemoteModel ? (
                  <TouchableOpacity
                    testID="server-link"
                    onPress={() => {
                      if (model.serverId && onOpenServerDetails) {
                        onOpenServerDetails(model.serverId);
                      }
                    }}
                    style={styles.serverLink}>
                    <Icon
                      source="cloud-outline"
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.serverLinkText}>
                      {model.serverName || 'Remote'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.sizeInfo}>
                    <CpuChipIcon
                      width={10}
                      height={10}
                      stroke={theme.colors.onSurfaceVariant}
                    />
                    <Text style={styles.sizeInfoText}>
                      {getModelSizeString(model, isActiveModel, l10n)}
                    </Text>
                  </View>
                )}
                {getStatusDot()}
              </View>
            </View>
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            {/* Storage Error Display */}
            {!isRemoteModel && !storageOk && !isDownloaded && (
              <HelperText
                testID="storage-error-text"
                type="error"
                visible={!storageOk}
                padding="none"
                style={styles.storageErrorText}>
                {storageNOkMessage}
              </HelperText>
            )}

            {/* Display warnings */}
            {!isRemoteModel &&
              (shortMemoryWarning || multimodalWarning) &&
              isDownloaded && (
                <TouchableRipple
                  testID="memory-warning-button"
                  onPress={handleWarningPress}
                  style={styles.warningContainer}>
                  <View style={styles.warningContent}>
                    <IconButton
                      icon="alert-circle-outline"
                      iconColor={theme.colors.error}
                      size={theme.iconSize.m}
                      style={styles.warningIcon}
                    />
                    <Text style={styles.warningText}>
                      {shortMemoryWarning || multimodalWarning}
                    </Text>
                  </View>
                </TouchableRipple>
              )}

            {!isRemoteModel && integrityError && (
              <TouchableRipple
                testID="integrity-warning-button"
                style={styles.warningContainer}>
                <View style={styles.warningContent}>
                  <IconButton
                    icon="alert-circle-outline"
                    iconColor={theme.colors.error}
                    size={theme.iconSize.m}
                    style={styles.warningIcon}
                  />
                  <Text style={styles.warningText}>{integrityError}</Text>
                </View>
              </TouchableRipple>
            )}

            {/* Download Progress（B57：paper ProgressBar 清零 → ui/Progress height=8） */}
            {isDownloading && (
              <View style={styles.downloadProgressContainer}>
                <Progress
                  testID="download-progress-bar"
                  height={8}
                  value={model.progress}
                  color={theme.colors.tertiary}
                />
                {model.downloadSpeed && (
                  <Text style={styles.downloadSpeed}>
                    {model.downloadSpeed}
                  </Text>
                )}
              </View>
            )}

            {/* Action Buttons Section */}
            <View style={styles.actionButtonsContainer}>
              {renderActionButtons()}
            </View>

            {isExpanded && (
              <View style={styles.detailsContent}>
                {/* Full Model Name */}
                <View style={styles.fullModelNameContainer}>
                  <Text style={styles.fullModelNameLabel}>
                    {l10n.models.modelCard.labels.modelName}
                  </Text>
                  <Text style={styles.fullModelNameText} selectable={true}>
                    {model.name}
                  </Text>
                </View>

                {/* Memory Requirement */}
                {model.isDownloaded && !isRemoteModel && (
                  <MemoryRequirement
                    model={model}
                    projectionModel={projectionModelForCheck}
                  />
                )}

                {/* Description - matching updated React example */}
                {model.capabilities && model.capabilities.length > 0 && (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionText}>
                      {getModelSkills(model)
                        .map(
                          skill =>
                            l10n.models.modelCapabilities[
                              skill.labelKey as keyof typeof l10n.models.modelCapabilities
                            ] || skill.labelKey,
                        )
                        .join(', ')}{' '}
                      {l10n.models.modelCard.labels.capabilities}
                    </Text>
                  </View>
                )}

                {/* Vision Toggle for multimodal models */}
                {model.supportsMultimodal && (
                  <View style={styles.visionToggleContainer}>
                    <View
                      testID="vision-skill-touchable"
                      style={styles.visionToggleHeader}>
                      <View style={styles.visionToggleLeft}>
                        <EyeIcon
                          width={16}
                          height={16}
                          stroke={
                            modelStore.getModelVisionPreference(model)
                              ? theme.colors.tertiary
                              : theme.colors.onSurfaceVariant
                          }
                        />
                        <Text style={styles.visionToggleLabel}>
                          {l10n.models.modelCard.labels.vision}
                        </Text>
                      </View>
                      <Switch
                        value={modelStore.getModelVisionPreference(model)}
                        onValueChange={handleVisionToggle}
                        disabled={
                          !projectionModelStatus.isAvailable &&
                          !modelStore.getModelVisionPreference(model) &&
                          model.isDownloaded
                        }
                      />
                    </View>
                    {!projectionModelStatus.isAvailable &&
                      !modelStore.getModelVisionPreference(model) &&
                      model.isDownloaded && (
                        <Text style={styles.visionHelpText}>
                          {l10n.models.modelCard.labels.requiresProjectionModel}
                        </Text>
                      )}
                  </View>
                )}

                {/* Projection Models Management for multimodal models */}
                {model.supportsMultimodal &&
                  modelStore.getModelVisionPreference(model) && (
                    <View style={styles.projectionModelsContainer}>
                      <ProjectionModelSelector
                        model={model}
                        onProjectionModelSelect={handleProjectionModelSelect}
                        showDownloadActions={model.isDownloaded}
                        initialExpanded={true}
                      />
                    </View>
                  )}

                {/* Technical Details Grid - 2x2 layout */}
                <View style={styles.technicalDetailsGrid}>
                  {/* Parameters */}
                  {model.params > 0 && (
                    <View style={styles.technicalDetailCard}>
                      <Text style={styles.technicalDetailLabel}>
                        {l10n.models.modelDescription.parameters}
                      </Text>
                      <Text style={styles.technicalDetailValue}>
                        {formatNumber(model.params, 2, true, false)}
                      </Text>
                    </View>
                  )}

                  {/* Context Length */}
                  {modelCaps.contextLength && (
                    <View
                      style={styles.technicalDetailCard}
                      testID={`model-card-context-length-${cardId}`}>
                      <Text style={styles.technicalDetailLabel}>
                        {l10n.models.modelCard.labels.contextLength}
                      </Text>
                      <Text style={styles.technicalDetailValue}>
                        {modelCaps.contextLength.toLocaleString()}
                      </Text>
                    </View>
                  )}

                  {/* Architecture */}
                  {(model.hfModel?.specs?.gguf?.architecture ||
                    model.ggufMetadata?.architecture) && (
                    <View style={styles.technicalDetailCard}>
                      <Text style={styles.technicalDetailLabel}>
                        {l10n.models.modelCard.labels.architecture}
                      </Text>
                      <Text style={styles.technicalDetailValue}>
                        {model.hfModel?.specs?.gguf?.architecture ||
                          model.ggufMetadata?.architecture}
                      </Text>
                    </View>
                  )}

                  {/* Author */}
                  {model.author && !isRemoteModel && (
                    <View style={styles.technicalDetailCard}>
                      <Text style={styles.technicalDetailLabel}>
                        {l10n.models.modelCard.labels.author}
                      </Text>
                      <Text style={styles.technicalDetailValue}>
                        {model.author}
                      </Text>
                    </View>
                  )}

                  {/* Vision */}
                  {isRemoteModel && (
                    <View
                      style={styles.technicalDetailCard}
                      testID={`model-card-vision-capability-${cardId}`}
                      accessible={true}
                      accessibilityLabel={`${l10n.models.modelCard.labels.vision}: ${visionLabel}`}>
                      <Text style={styles.technicalDetailLabel}>
                        {l10n.models.modelCard.labels.vision}
                      </Text>
                      <Text style={styles.technicalDetailValue}>
                        {visionLabel}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Projection model warning */}
                {hasProjectionModelWarning && (
                  <TouchableOpacity
                    testID="projection-warning-badge"
                    onPress={handleProjectionWarningPress}
                    style={styles.warningButton}
                    activeOpacity={0.7}>
                    <Text style={styles.warningButtonText}>
                      {l10n.models.modelCard.labels.downloadProjectionModel}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* HuggingFace Link */}
                {model.hfUrl && (
                  <TouchableOpacity
                    testID="open-huggingface-url"
                    onPress={openHuggingFaceUrl}
                    style={styles.hfLinkButton}
                    activeOpacity={0.7}>
                    <View style={styles.hfLinkContent}>
                      <LinkExternalIcon
                        width={16}
                        height={16}
                        stroke={theme.colors.primary}
                      />
                      <Text style={styles.hfLinkText}>
                        {
                          l10n.models.modelCard.labels
                            .viewModelCardOnHuggingFace
                        }
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </Card>
        {/* Snackbar to show full memory warning */}
        <Snackbar
          testID="memory-warning-snackbar"
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={Snackbar.DURATION_MEDIUM}
          action={{
            label: l10n.common.dismiss,
            onPress: () => {
              setSnackbarVisible(false);
            },
          }}>
          {memoryWarning ||
            multimodalWarning ||
            (hasProjectionModelWarning &&
              l10n.models.multimodal.projectionMissingWarning)}
        </Snackbar>
        {/* 下载源选择（多源条目：HF/ModelScope） */}
        <DownloadSourceSheet
          visible={downloadSourceVisible}
          sources={(() => {
            const entry = catalogEntryByFilename(model.filename);
            return entry ? getAvailableSources(entry) : [];
          })()}
          onDismiss={() => setDownloadSourceVisible(false)}
          onSelect={handleDownloadSourceSelect}
        />
      </>
    );
  },
);
