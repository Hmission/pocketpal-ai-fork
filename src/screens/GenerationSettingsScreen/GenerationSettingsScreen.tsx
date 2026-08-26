import React, {useContext, useState} from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';

import {observer} from 'mobx-react-lite';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../../hooks/useTheme';
import {useStaggerEntry} from '../../hooks/useStaggerEntry';
import {HFTokenSheet} from '../../components';
import {L10nContext} from '../../utils';
import {modelStore, uiStore, hfStore, searchProviderStore} from '../../store';
import {
  getAllowedCacheTypeKOptions,
  getAllowedCacheTypeVOptions,
} from '../../utils/flashAttnCompatibility';
import {createStyles} from './styles';
import {useGpuDeviceOptions} from './hooks/useGpuDeviceOptions';
import {useContextSizeInput} from './hooks/useContextSizeInput';
import {ModelInitCard} from './components/ModelInitCard';
import {MemoryCard} from './components/MemoryCard';
import {ModelLoadingCard} from './components/ModelLoadingCard';
import {InternetSearchCard} from './components/InternetSearchCard';
import {ApiSettingsCard} from './components/ApiSettingsCard';
import {CacheStorageCard} from './components/CacheStorageCard';
import {ExportOptionsCard} from './components/ExportOptionsCard';

// 设置分组卡片错峰入场（DESIGN_SPEC §5：一次性、不循环；JS driver）
const StaggeredCard = ({index, children}: {index: number; children: any}) => {
  const entry = useStaggerEntry(index, 60);
  return <Animated.View style={entry}>{children}</Animated.View>;
};

export const GenerationSettingsScreen: React.FC = observer(() => {
  const l10n = useContext(L10nContext);
  const theme = useTheme();
  const styles = createStyles(theme);

  // ── R3-P1 拆分：2 hooks 承载状态/effect；Screen 仅保留装配 + 外点（closeToken→菜单自关） ──
  const gpuOptions = useGpuDeviceOptions();
  const contextSizeInput = useContextSizeInput();
  const [showHfTokenDialog, setShowHfTokenDialog] = useState(false);
  const [closeToken, setCloseToken] = useState(0);
  const handleOutsidePress = () => {
    contextSizeInput.resetContextSizeInput();
    setCloseToken(c => c + 1);
  };
  // 派生值：observer 渲染期读取→追踪；卡片为纯展示
  const p = modelStore.contextInitParams;
  const currentFlashAttnType =
    p.flash_attn_type ?? (Platform.OS === 'ios' ? 'auto' : 'off');
  const cacheTypeKOptions = getAllowedCacheTypeKOptions(
    currentFlashAttnType,
    gpuOptions.currentBackend,
  );
  const cacheTypeVOptions = getAllowedCacheTypeVOptions(
    currentFlashAttnType,
    gpuOptions.currentBackend,
  );
  const cacheTypesEnabled = !!p.flash_attn_type && p.flash_attn_type !== 'off';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <TouchableWithoutFeedback onPress={handleOutsidePress} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <StaggeredCard index={0}>
            <ModelInitCard
              l10n={l10n}
              theme={theme}
              styles={styles}
              deviceOptions={gpuOptions.deviceOptions}
              gpuSupported={gpuOptions.gpuSupported}
              currentDeviceId={gpuOptions.getCurrentDeviceId()}
              onDeviceSelect={gpuOptions.handleDeviceSelect}
              nGpuLayers={p.n_gpu_layers}
              onNGPULayersChange={value =>
                modelStore.setNGPULayers(Math.round(value))
              }
              minContextSize={modelStore.MIN_CONTEXT_SIZE}
              contextSize={contextSizeInput.contextSize}
              isValidInput={contextSizeInput.isValidInput}
              contextSizeRef={contextSizeInput.inputRef}
              onContextSizeChange={contextSizeInput.handleContextSizeChange}
              hasActiveModel={!!modelStore.activeModelId}
              activeModelName={
                modelStore.models.find(m => m.id === modelStore.activeModelId)
                  ?.name ?? ''
              }
              contextPolicy={modelStore.getContextPolicy(
                modelStore.activeModelId,
              )}
              onContextPolicyChange={value =>
                modelStore.setContextPolicy(modelStore.activeModelId!, value)
              }
              autoCompaction={modelStore.contextAutoCompaction}
              onAutoCompactionChange={value =>
                modelStore.setContextAutoCompaction(value)
              }
              closeToken={closeToken}
              maxThreads={modelStore.max_threads}
              nCtx={p.n_ctx}
              nBatch={p.n_batch}
              onNBatchChange={value => modelStore.setNBatch(Math.round(value))}
              nUBatch={p.n_ubatch}
              onNUBatchChange={value =>
                modelStore.setNUBatch(Math.round(value))
              }
              nThreads={p.n_threads}
              onNThreadsChange={value =>
                modelStore.setNThreads(Math.round(value))
              }
              imageMaxTokens={p.image_max_tokens}
              onImageMaxTokensChange={value =>
                modelStore.setImageMaxTokens(Math.round(value))
              }
              flashAttnType={currentFlashAttnType}
              onFlashAttnChange={value => modelStore.setFlashAttnType(value)}
              cacheTypesEnabled={cacheTypesEnabled}
              cacheTypeK={p.cache_type_k}
              cacheTypeKOptions={cacheTypeKOptions}
              onKeyCacheSelect={value => modelStore.setCacheTypeK(value)}
              cacheTypeV={p.cache_type_v}
              cacheTypeVOptions={cacheTypeVOptions}
              onValueCacheSelect={value => modelStore.setCacheTypeV(value)}
            />
          </StaggeredCard>
          <StaggeredCard index={1}>
            <MemoryCard
              l10n={l10n}
              styles={styles}
              useMlock={p.use_mlock}
              onUseMlockChange={value => modelStore.setUseMlock(value)}
              useMmap={p.use_mmap}
              onUseMmapChange={value =>
                modelStore.setUseMmap(value ? 'true' : 'false')
              }
              noExtraBufts={p.no_extra_bufts}
              onNoExtraBuftsChange={value => modelStore.setNoExtraBufts(!value)}
            />
          </StaggeredCard>
          <StaggeredCard index={2}>
            <ModelLoadingCard
              l10n={l10n}
              styles={styles}
              autoOffloadLoad={modelStore.useAutoRelease}
              onAutoOffloadChange={value =>
                modelStore.updateUseAutoRelease(value)
              }
              autoNavigateToChat={uiStore.autoNavigatetoChat}
              onAutoNavigateChange={value =>
                uiStore.setAutoNavigateToChat(value)
              }
            />
          </StaggeredCard>
          <StaggeredCard index={4}>
            <InternetSearchCard
              l10n={l10n}
              styles={styles}
              searchEnabled={searchProviderStore.hasConsentedToSearch}
              onConsentChange={value => searchProviderStore.setConsent(value)}
              resultCount={searchProviderStore.resultCount}
              onResultCountChange={value =>
                searchProviderStore.setResultCount(Math.round(value))
              }
            />
          </StaggeredCard>
          <StaggeredCard index={5}>
            <ApiSettingsCard
              l10n={l10n}
              styles={styles}
              isTokenPresent={hfStore.isTokenPresent}
              useHfToken={hfStore.useHfToken}
              onUseHfTokenChange={value => hfStore.setUseHfToken(value)}
              onSetTokenPress={() => setShowHfTokenDialog(true)}
            />
          </StaggeredCard>
          {Platform.OS === 'ios' && (
            <StaggeredCard index={6}>
              <CacheStorageCard l10n={l10n} styles={styles} />
            </StaggeredCard>
          )}

          <StaggeredCard index={7}>
            <ExportOptionsCard l10n={l10n} theme={theme} styles={styles} />
          </StaggeredCard>
        </ScrollView>
      </TouchableWithoutFeedback>
      <HFTokenSheet
        isVisible={showHfTokenDialog}
        onDismiss={() => setShowHfTokenDialog(false)}
        onSave={() => setShowHfTokenDialog(false)}
      />
    </SafeAreaView>
  );
});
