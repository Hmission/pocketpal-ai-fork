import {View, TouchableOpacity} from 'react-native';
import React, {useContext, useEffect, useState} from 'react';

import {observer} from 'mobx-react';
import {Text} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {CircularActivityIndicator} from '../CircularActivityIndicator';

import {useTheme} from '../../hooks/useTheme';
import {infoDialog} from '../ui/InfoDialog';
import {confirmDialog} from '../ui/ConfirmDialog';

import {createStyles} from './styles';

import {modelStore} from '../../store';

import {Model} from '../../utils/types';
import {L10nContext, formatBytes} from '../../utils';

interface ProjectionModelSelectorProps {
  model: Model;
  onProjectionModelSelect?: (projectionModelId: string) => void;
  showDownloadActions?: boolean; // Controls whether to show download/delete buttons
  context?: 'search' | 'modelsList'; // Context for data source selection
  availableProjectionModels?: Model[]; // For search context - models from HF repository
  initialExpanded?: boolean; // Controls initial expanded state
}

/**
 * Component for displaying and managing projection models for a vision LLM
 */
export const ProjectionModelSelector = observer(
  ({
    model,
    onProjectionModelSelect,
    showDownloadActions = true,
    context = 'modelsList',
    availableProjectionModels,
    initialExpanded = false,
  }: ProjectionModelSelectorProps) => {
    const theme = useTheme();
    const l10n = useContext(L10nContext);
    const styles = createStyles(theme);

    const [expanded, setExpanded] = useState(initialExpanded);
    const [compatibleModels, setCompatibleModels] = useState<Model[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
      model.defaultProjectionModel,
    );

    // Get compatible projection models based on context
    useEffect(() => {
      let projectionModels: Model[] = [];

      if (context === 'search' && availableProjectionModels) {
        // Use provided models from HF repository for search context
        projectionModels = availableProjectionModels;
      } else {
        // Use store-based lookup for downloaded models context
        projectionModels = modelStore.getCompatibleProjectionModels(model.id);
      }

      setCompatibleModels(projectionModels);

      // Auto-expand if there are models to show - better UX!
      if (projectionModels.length > 0) {
        setExpanded(true);
      }
    }, [model.id, context, availableProjectionModels]);

    const handleSelectModel = (projectionModelId: string) => {
      setSelectedModelId(projectionModelId);
      if (onProjectionModelSelect) {
        onProjectionModelSelect(projectionModelId);
      }

      // If this is the active model, we need to reload the context with the new projection model
      if (modelStore.activeModelId === model.id) {
        const projectionModel = modelStore.models.find(
          m => m.id === projectionModelId,
        );
        if (projectionModel && projectionModel.isDownloaded) {
          // 切换投影模型需重载上下文——二元确认（B52③：Alert → confirmDialog）
          void confirmDialog({
            title: l10n.models.multimodal.reloadModelTitle,
            message: l10n.models.multimodal.reloadModelMessage,
            confirmText: l10n.models.multimodal.reload,
            cancelText: l10n.common.cancel,
          }).then(async ok => {
            if (!ok) {
              return;
            }
            // Get the projection model path
            const projModelPath =
              await modelStore.getModelFullPath(projectionModel);
            if (projModelPath) {
              // Reload the model with the new projection model
              modelStore.initContext(model, projModelPath);
            }
          });
        }
      }
    };

    const handleDownloadModel = (projectionModel: Model) => {
      modelStore.checkSpaceAndDownload(projectionModel.id);
    };

    const handleDeleteModel = (projectionModel: Model) => {
      // Check if model is currently active - this is the only case we prevent deletion
      if (modelStore.activeModelId === projectionModel.id) {
        infoDialog({
          title: l10n.models.multimodal.cannotDeleteTitle,
          message: l10n.models.multimodal.cannotDeleteActive,
          buttonText: l10n.common.ok,
        });
        return;
      }

      // Get dependent models for warning message (manual deletion always allowed)
      const dependentModels = modelStore.getDownloadedLLMsUsingProjectionModel(
        projectionModel.id,
      );

      let message = l10n.models.multimodal.deleteProjectionMessage;
      if (dependentModels.length > 0) {
        const modelNames = dependentModels.map(m => m.name).join(', ');
        message = `${l10n.models.multimodal.deleteProjectionMessage}\n\n${l10n.models.multimodal.dependentModels} ${modelNames}\n\n${l10n.models.multimodal.visionWillBeDisabled}`;
      }

      // 删除投影模型确认（B52③：Alert → confirmDialog，destructive 语义保留）
      void confirmDialog({
        title: l10n.models.multimodal.deleteProjectionTitle,
        message,
        confirmText: l10n.common.delete,
        cancelText: l10n.common.cancel,
        destructive: true,
      }).then(async ok => {
        if (!ok) {
          return;
        }
        try {
          // Disable vision for dependent models before deletion
          dependentModels.forEach(dependentModel => {
            modelStore.setModelVisionEnabled(dependentModel.id, false);
          });

          await modelStore.deleteModel(projectionModel);
        } catch (error) {
          console.error('Failed to delete projection model:', error);
          infoDialog({
            title: l10n.models.multimodal.cannotDeleteTitle,
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            buttonText: l10n.common.ok,
          });
        }
      });
    };

    const toggleExpanded = () => {
      setExpanded(!expanded);
    };

    if (!model.supportsMultimodal) {
      return null;
    }

    return (
      <View testID="projection-model-selector" style={styles.container}>
        {/* Optional Header - only show if there are multiple models or user needs to collapse */}
        {compatibleModels.length > 1 && (
          <TouchableOpacity
            testID="projection-model-selector-header"
            style={styles.header}
            onPress={toggleExpanded}
            activeOpacity={0.7}>
            <Text style={styles.headerTitle}>
              {l10n.models.multimodal.projectionModels}
            </Text>
            <Icon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={theme.iconSize.s}
              color={theme.colors.onSurfaceVariant}
              style={styles.chevronIcon}
            />
          </TouchableOpacity>
        )}

        {/* Clean Content - auto-expanded for better UX */}
        {expanded && (
          <View style={styles.content}>
            {compatibleModels.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon
                  name="image-off-outline"
                  size={theme.iconSize.l}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text style={styles.emptyText}>
                  {l10n.models.multimodal.noCompatibleModels}
                </Text>
              </View>
            ) : (
              <View style={styles.modelsList}>
                {/* Show title for context when there's only one model */}
                {compatibleModels.length === 1 && (
                  <Text style={styles.singleModelTitle}>
                    {l10n.models.multimodal.projectionModels}
                  </Text>
                )}

                {compatibleModels.map(projModel => {
                  const isSelected = selectedModelId === projModel.id;

                  return (
                    <View
                      testID="projection-model-item"
                      key={projModel.id}
                      style={[
                        styles.modelItem,
                        isSelected && styles.selectedModelItem,
                      ]}>
                      <View style={styles.modelInfo}>
                        <Text
                          style={[
                            styles.modelName,
                            isSelected && styles.selectedModelName,
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail">
                          {projModel.name}
                        </Text>
                        <Text style={styles.modelSize}>
                          {formatBytes(projModel.size)}
                        </Text>
                      </View>

                      <View style={styles.modelActions}>
                        {showDownloadActions ? (
                          // Full download/delete actions for ModelCard context
                          <>
                            {projModel.isDownloaded ? (
                              <View style={styles.downloadedActions}>
                                <TouchableOpacity
                                  testID="select-projection-model-button"
                                  onPress={() =>
                                    handleSelectModel(projModel.id)
                                  }
                                  style={[
                                    styles.selectArea,
                                    isSelected && styles.selectedArea,
                                  ]}
                                  activeOpacity={0.7}>
                                  <Icon
                                    name={
                                      isSelected
                                        ? 'check-circle'
                                        : 'circle-outline'
                                    }
                                    size={theme.iconSize.m}
                                    color={
                                      isSelected
                                        ? theme.colors.tertiary
                                        : theme.colors.onSurfaceVariant
                                    }
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  testID="delete-projection-model-button"
                                  onPress={() => handleDeleteModel(projModel)}
                                  style={styles.deleteArea}
                                  activeOpacity={0.7}>
                                  <Icon
                                    name="delete-outline"
                                    size={theme.iconSize.s}
                                    color={theme.colors.error}
                                  />
                                </TouchableOpacity>
                              </View>
                            ) : projModel.progress > 0 ? (
                              <View style={styles.downloadProgress}>
                                <CircularActivityIndicator
                                  size={20}
                                  color={theme.colors.primary}
                                />
                                <Text style={styles.progressText}>
                                  {Math.round(projModel.progress)}%
                                </Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                testID="download-projection-model-button"
                                onPress={() => handleDownloadModel(projModel)}
                                style={styles.downloadArea}
                                activeOpacity={0.7}>
                                <Icon
                                  name="download"
                                  size={theme.iconSize.s}
                                  color={theme.colors.primary}
                                />
                              </TouchableOpacity>
                            )}
                          </>
                        ) : (
                          // Selection only for VisionDownloadSheet context
                          <TouchableOpacity
                            testID="select-projection-model-button"
                            onPress={() => handleSelectModel(projModel.id)}
                            style={[
                              styles.selectArea,
                              isSelected && styles.selectedArea,
                            ]}
                            activeOpacity={0.7}>
                            <Icon
                              name={
                                isSelected ? 'check-circle' : 'circle-outline'
                              }
                              size={theme.iconSize.m}
                              color={
                                isSelected
                                  ? theme.colors.tertiary
                                  : theme.colors.onSurfaceVariant
                              }
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  },
);
