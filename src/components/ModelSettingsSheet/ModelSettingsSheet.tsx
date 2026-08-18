import React, {useState, useEffect, memo, useContext} from 'react';
import {Button, Text, Divider, Switch, Chip} from 'react-native-paper';

import {ModelSettings} from '../../screens/ModelsScreen/ModelSettings';
import {Sheet} from '../Sheet';
import {ProjectionModelSelector} from '../ProjectionModelSelector';
import {Model, ModelOrigin} from '../../utils/types';
import {modelStore, serverStore} from '../../store';
import {chatTemplates} from '../../utils/chat';
import {
  resolveReasoningCapability,
  EFFORT_LEVELS,
  DEFAULT_EFFORT_VALUES,
  orderEffortValues,
} from '../../utils/reasoningCapability';

import {styles} from './styles';
import {View} from 'react-native';
import {L10nContext, SkillKey} from '../../utils';

// §18.7 用途标签：多选 chips（写作/代码）；玩具复用 code 选型，
// 不增第三枚同构 chip（锋利不臃肿）。写入 model.capabilities，
// 保存时保留非用途键（capabilities 也承载自动探测能力声明）。
const USAGE_TAGS: Array<{key: SkillKey; label: string}> = [
  {key: 'rewriting', label: '写作'},
  {key: 'code', label: '代码'},
];
const USAGE_TAG_KEYS = USAGE_TAGS.map(t => t.key);

interface ModelSettingsSheetProps {
  isVisible: boolean;
  onClose: () => void;
  model?: Model;
}

export const ModelSettingsSheet: React.FC<ModelSettingsSheetProps> = memo(
  ({isVisible, onClose, model}) => {
    const [tempModelName, setTempModelName] = useState(model?.name || '');
    const [tempChatTemplate, setTempChatTemplate] = useState(
      model?.chatTemplate || chatTemplates.default,
    );
    const [tempStopWords, setTempStopWords] = useState<string[]>(
      model?.stopWords || [],
    );
    // §18.7 用途标签选中集（仅用途键；种子自 model.capabilities）
    const [usageSet, setUsageSet] = useState<SkillKey[]>(() =>
      USAGE_TAG_KEYS.filter(k => model?.capabilities?.includes(k)),
    );
    const l10n = useContext(L10nContext);

    // Remote models have no local-only settings (chat template, stop words,
    // tokens) — only the reasoning override applies to them.
    const isRemote = model?.origin === ModelOrigin.REMOTE;

    // Reasoning override (seeded from the resolver so the controls show the
    // effective state). Axis-1 is reasoning yes/no; axis-2 graded effort + set.
    const seedReasoning = () =>
      resolveReasoningCapability(model, serverStore.remoteReasoning);
    const [isReasoningModel, setIsReasoningModel] = useState(
      () => seedReasoning().isReasoning === 'yes',
    );
    const [supportsEffort, setSupportsEffort] = useState(
      () => seedReasoning().supportsEffort,
    );
    // Selected effort levels (subset of EFFORT_LEVELS), persisted ordered
    // low→medium→high so the pill cycle stays consistent.
    const [effortSet, setEffortSet] = useState<string[]>(() =>
      orderEffortValues(seedReasoning().effortValues),
    );
    // Whether the user touched any reasoning control this session. A save
    // persists a source:'user' override only when dirty, so an unrelated save
    // (e.g. rename) never overwrites a 'detected'/'unknown'/'learned' capability.
    const [reasoningDirty, setReasoningDirty] = useState(false);

    const onIsReasoningModelChange = (value: boolean) => {
      setReasoningDirty(true);
      setIsReasoningModel(value);
    };
    const onSupportsEffortChange = (value: boolean) => {
      setReasoningDirty(true);
      setSupportsEffort(value);
      // Pre-select the standard subset on first enable so the chips read as
      // togglable (selected/unselected contrast) instead of an all-blank row.
      if (value && effortSet.length === 0) {
        setEffortSet(DEFAULT_EFFORT_VALUES);
      }
    };
    const onEffortLevelToggle = (level: string) => {
      setReasoningDirty(true);
      setEffortSet(prev =>
        orderEffortValues(
          prev.includes(level)
            ? prev.filter(v => v !== level)
            : [...prev, level],
        ),
      );
    };

    const onUsageTagToggle = (key: SkillKey) => {
      setUsageSet(prev => {
        const next = prev.includes(key)
          ? prev.filter(k => k !== key)
          : [...prev, key];
        // 固定顺序（写作/代码），渲染稳定
        return USAGE_TAG_KEYS.filter(k => next.includes(k));
      });
    };

    // Reset temp settings when model changes
    useEffect(() => {
      if (model) {
        setTempModelName(model.name);
        setTempChatTemplate(model.chatTemplate);
        setTempStopWords(model.stopWords || []);
        const cap = resolveReasoningCapability(
          model,
          serverStore.remoteReasoning,
        );
        setIsReasoningModel(cap.isReasoning === 'yes');
        setSupportsEffort(cap.supportsEffort);
        setEffortSet(orderEffortValues(cap.effortValues));
        setReasoningDirty(false);
        setUsageSet(USAGE_TAG_KEYS.filter(k => model.capabilities?.includes(k)));
      }
    }, [model]);

    const handleSettingsUpdate = (name: string, value: any) => {
      setTempChatTemplate(prev => {
        const newTemplate =
          name === 'name' ? chatTemplates[value] : {...prev, [name]: value};
        return newTemplate;
      });
    };

    const handleModelNameChange = (name: string) => {
      setTempModelName(name);
    };

    const handleSaveSettings = () => {
      if (model) {
        if (!isRemote) {
          modelStore.updateModelName(model.id, tempModelName);
          modelStore.updateModelChatTemplate(model.id, tempChatTemplate);
          modelStore.updateModelStopWords(model.id, tempStopWords);
          // §18.7 用途标签：保留非用途键（自动探测能力声明），合并用户选择
          const preserved = (model.capabilities ?? []).filter(
            c => !USAGE_TAG_KEYS.includes(c),
          );
          modelStore.updateModelCapabilities(model.id, [
            ...preserved,
            ...usageSet,
          ]);
        }
        // Persist a source:'user' reasoning override only when the user
        // actually touched a reasoning control. Otherwise leave the existing
        // capability (detected/unknown/learned) intact.
        if (reasoningDirty) {
          const effortValues = orderEffortValues(effortSet);
          modelStore.setReasoningOverride(model.id, {
            isReasoning: isReasoningModel ? 'yes' : 'no',
            source: 'user',
            supportsEffort: isReasoningModel && supportsEffort,
            effortValues:
              isReasoningModel && supportsEffort ? effortValues : [],
            effortSource: isReasoningModel && supportsEffort ? 'user' : 'none',
          });
        }
        onClose();
      }
    };

    const handleCancelSettings = () => {
      if (model) {
        // Reset to store values
        setTempModelName(model.name);
        setTempChatTemplate(model.chatTemplate);
        setTempStopWords(model.stopWords || []);
      }
      onClose();
    };

    const handleReset = () => {
      if (model && !isRemote) {
        // Reset to model default values
        modelStore.resetModelName(model.id);
        modelStore.resetModelChatTemplate(model.id);
        modelStore.resetModelStopWords(model.id);
        setTempModelName(model.name);
        setTempChatTemplate(model.chatTemplate);
        setTempStopWords(model.stopWords || []);
      }
    };

    if (!model) {
      return null;
    }

    return (
      <Sheet
        isVisible={isVisible}
        onClose={handleCancelSettings}
        title={l10n.components.modelSettingsSheet.modelSettings}
        displayFullHeight>
        <Sheet.ScrollView
          bottomOffset={16}
          contentContainerStyle={styles.sheetScrollViewContainer}>
          {/* Chat template, stop words and token settings are local-only and
              don't apply to remote models. */}
          {!isRemote && (
            <ModelSettings
              modelName={tempModelName}
              chatTemplate={tempChatTemplate}
              stopWords={tempStopWords}
              onChange={handleSettingsUpdate}
              onStopWordsChange={value => setTempStopWords(value || [])}
              onModelNameChange={handleModelNameChange}
            />
          )}

          {/* §18.7 用途标签：写作/代码多选，任务选型（listModelsForTask）最高优先 */}
          {!isRemote && (
            <>
              <Divider style={styles.multimodalDivider} />
              <Text style={styles.multimodalSectionTitle}>用途</Text>
              <Text variant="bodySmall" style={styles.reasoningHelp}>
                打标签后，对应任务切换模型时优先推荐该模型。
              </Text>
              <View style={styles.effortChipsRow}>
                {USAGE_TAGS.map(tag => (
                  <Chip
                    key={tag.key}
                    testID={`usage-chip-${tag.key}`}
                    selected={usageSet.includes(tag.key)}
                    showSelectedCheck
                    onPress={() => onUsageTagToggle(tag.key)}>
                    {tag.label}
                  </Chip>
                ))}
              </View>
            </>
          )}

          {/* Multimodal Settings Section */}
          {model.supportsMultimodal && (
            <>
              <Divider style={styles.multimodalDivider} />
              <Text style={styles.multimodalSectionTitle}>
                {l10n.models.multimodal.settings}
              </Text>
              <ProjectionModelSelector
                model={model}
                onProjectionModelSelect={projectionModelId => {
                  modelStore.setDefaultProjectionModel(
                    model.id,
                    projectionModelId,
                  );
                }}
              />
            </>
          )}

          {/* Reasoning override (axis 1 + axis 2). Manual escape hatch when
              detection is wrong or impossible (remote models). */}
          <Divider style={styles.multimodalDivider} />
          <Text style={styles.multimodalSectionTitle}>
            {l10n.components.modelSettingsSheet.reasoningSection}
          </Text>
          <View style={styles.reasoningRow}>
            <Text>{l10n.components.modelSettingsSheet.isReasoningModel}</Text>
            <Switch
              testID="reasoning-is-reasoning-switch"
              value={isReasoningModel}
              onValueChange={onIsReasoningModelChange}
            />
          </View>
          <Text variant="bodySmall" style={styles.reasoningHelp}>
            {l10n.components.modelSettingsSheet.isReasoningModelHelp}
          </Text>
          {isReasoningModel && (
            <>
              <View style={styles.reasoningRow}>
                <Text>{l10n.components.modelSettingsSheet.supportsEffort}</Text>
                <Switch
                  testID="reasoning-supports-effort-switch"
                  value={supportsEffort}
                  onValueChange={onSupportsEffortChange}
                />
              </View>
              {supportsEffort && (
                <>
                  <Text variant="bodySmall" style={styles.reasoningHelp}>
                    {l10n.components.modelSettingsSheet.effortValues}
                  </Text>
                  <View style={styles.effortChipsRow}>
                    {EFFORT_LEVELS.map(level => (
                      <Chip
                        key={level}
                        testID={`effort-chip-${level}`}
                        selected={effortSet.includes(level)}
                        showSelectedCheck
                        onPress={() => onEffortLevelToggle(level)}>
                        {l10n.components.modelSettingsSheet.effortLevels[level]}
                      </Chip>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </Sheet.ScrollView>
        <Sheet.Actions>
          <View style={styles.secondaryButtons}>
            {!isRemote && (
              <Button mode="text" onPress={handleReset}>
                {l10n.common.reset}
              </Button>
            )}
            <Button mode="text" onPress={handleCancelSettings}>
              {l10n.common.cancel}
            </Button>
          </View>
          <Button mode="contained" onPress={handleSaveSettings}>
            {l10n.components.modelSettingsSheet.saveChanges}
          </Button>
        </Sheet.Actions>
      </Sheet>
    );
  },
);
