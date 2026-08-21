import React, {useRef, useEffect} from 'react';
import {
  Animated,
  View,
  Keyboard,
  Pressable,
  TouchableOpacity,
  Text as RNText,
} from 'react-native';
import {observer} from 'mobx-react';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {useWaveDots} from '../../screens/ImageGenScreen/hooks/useWaveDots';
import {modelStore} from '../../store';
import {CustomBackdrop} from '../Sheet/CustomBackdrop';
import {getModelSkills, Model} from '../../utils';
import {
  getModelDisplayNameWithParams,
  isChatSelectable,
  isButlerModel,
  getModelNote,
} from '../../utils/modelDisplayNames';
import {promptWriter} from '../../services/promptWriter';
import {SkillsDisplay} from '../SkillsDisplay';

interface ChatPalModelPickerSheetProps {
  isVisible: boolean;
  chatInputHeight: number;
  onClose: () => void;
  onModelSelect?: (modelId: string) => void;
}

const ObservedSkillsDisplay = observer(({model}) => {
  const hasProjectionModelWarning =
    model.supportsMultimodal &&
    model.visionEnabled &&
    modelStore.getProjectionModelStatus(model).state === 'missing';

  const toggleVision = async () => {
    if (!model.supportsMultimodal) {
      return;
    }
    try {
      await modelStore.setModelVisionEnabled(
        model.id,
        !modelStore.getModelVisionPreference(model),
      );
    } catch (error) {
      console.error('Failed to toggle vision setting:', error);
      // The error is already handled in setModelVisionEnabled (vision state is reverted)
      // We could show a toast/snackbar here if needed
    }
  };
  const visionEnabled = modelStore.getModelVisionPreference(model);

  return (
    <SkillsDisplay
      model={model}
      hasProjectionModelWarning={hasProjectionModelWarning}
      onVisionPress={toggleVision}
      onProjectionWarningPress={() =>
        model.defaultProjectionModel &&
        modelStore.checkSpaceAndDownload(model.defaultProjectionModel)
      }
      visionEnabled={visionEnabled}
    />
  );
});

/**
 * 聊天模型选择器（单 Tab · 仅模型）。
 *
 * 条目显示「中文简称（参数量_量化档）」，如「面壁 MiniCPM（4B_Q4）」——
 * 单一事实源 getModelDisplayNameWithParams（modelDisplayNames）。
 * PAL 切换收敛至设置页 PalsHub，本组件不再承担伙伴选择职责。
 */
export const ChatPalModelPickerSheet = observer(
  ({
    isVisible,
    onClose,
    onModelSelect,
    chatInputHeight,
  }: ChatPalModelPickerSheetProps) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    const bottomSheetRef = useRef<BottomSheet>(null);

    // Dismiss keyboard when sheet becomes visible
    useEffect(() => {
      if (isVisible) {
        Keyboard.dismiss();
      }
    }, [isVisible]);

    // Close sheet when keyboard opens
    useEffect(() => {
      const keyboardDidShowListener = Keyboard.addListener(
        'keyboardDidShow',
        () => {
          if (isVisible) {
            onClose();
          }
        },
      );

      return () => {
        keyboardDidShowListener.remove();
      };
    }, [isVisible, onClose]);

    // B18 §16.2 加载进度行（生图页 ModelPickerPanel 同范式：已耗时 Xs）。
    // 本地计时单点：isContextLoading 起表，1s tick；结束归零。
    const [loadStartedAt, setLoadStartedAt] = React.useState<number | null>(
      null,
    );
    const [nowTs, setNowTs] = React.useState(Date.now());
    useEffect(() => {
      if (modelStore.isContextLoading) {
        setLoadStartedAt(prev => prev ?? Date.now());
        const id = setInterval(() => setNowTs(Date.now()), 1000);
        return () => clearInterval(id);
      }
      setLoadStartedAt(null);
      return undefined;
    }, [modelStore.isContextLoading]);
    const loadElapsedS = loadStartedAt
      ? Math.max(0, Math.round((nowTs - loadStartedAt) / 1000))
      : 0;

    // 三点波浪动效（与生图任务卡 ImageTaskProgress 同款）：
    // 加载期跳动提示，用户能感知加载在进行而非卡死。
    const waveDots = useWaveDots(modelStore.isContextLoading);

    // 加载收尾自动关 sheet（进度行使命完成）；state 驱动以触发 effect 重跑
    const [pendingClose, setPendingClose] = React.useState(false);
    useEffect(() => {
      if (!modelStore.isContextLoading && pendingClose) {
        setPendingClose(false);
        onClose();
      }
    }, [modelStore.isContextLoading, pendingClose, onClose]);

    const handleModelSelect = React.useCallback(
      async (model: (typeof modelStore.availableModels)[0]) => {
        try {
          onModelSelect?.(model.id);
          modelStore.selectModel(model);
          // B18 §16.2：加载期间 sheet 驻留（进度行可见），加载收尾后自动关闭；
          // 已加载模型纯选择 = isContextLoading 恒 false → 下一帧即关。
          setPendingClose(true);
        } catch (e) {
          console.log(`Error: ${e}`);
        }
      },
      [onModelSelect],
    );

    // B18 §16.2：卡片化（生图页 ModelPickerPanel 同范式）——
    // 简称 + 徽章［已加载/管家驻场］+ 入选说明 + 行内加载/卸载 + 进度行。
    // 管家卡卸载禁用（核心链路）；视觉开关（SkillsDisplay）保留。
    const renderModelItem = React.useCallback(
      (model: Model) => {
        const isActiveModel = model.id === modelStore.activeModelId;
        const butler = isButlerModel(model);
        const butlerResident = butler && promptWriter.isLoaded;
        const note = getModelNote(model);
        const loadingThis =
          modelStore.isContextLoading && modelStore.loadingModel?.id === model.id;
        const modelSkills = getModelSkills(model)
          .flatMap(skill => skill.labelKey)
          .join(', ');
        return (
          <Pressable
            key={model.id}
            testID={`picker-card-${model.id}`}
            accessibilityRole="button"
            onPress={() => handleModelSelect(model)}
            style={[styles.card, isActiveModel && styles.cardActive]}>
            <View style={styles.cardTitleRow}>
              <RNText style={styles.itemTitle} numberOfLines={1}>
                {getModelDisplayNameWithParams(model)}
              </RNText>
              {butlerResident ? (
                <RNText style={styles.badgeResident}>管家驻场</RNText>
              ) : isActiveModel ? (
                <RNText style={styles.badgeLoaded}>已加载</RNText>
              ) : null}
            </View>
            {note ? (
              <RNText style={styles.cardNote} numberOfLines={2}>
                {note}
              </RNText>
            ) : null}
            {modelSkills ? <ObservedSkillsDisplay model={model} /> : null}
            <View style={styles.cardActionRow}>
              {butler ? (
                // 管家卡禁卸（核心链路）：加载新模型自动卸载管家之外的聊天模型，
                // 管家本体常驻不占槽；脚注已注明单槽语义。
                <RNText style={styles.actionDisabled}>卸载禁用</RNText>
              ) : loadingThis ? (
                <View style={styles.loadingWrap}>
                  <View style={styles.loadingRow}>
                    {waveDots.map((dot, i) => (
                      <Animated.View
                        key={i}
                        style={[
                          styles.loadingDot,
                          {
                            transform: [
                              {
                                translateY: dot.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -6],
                                }),
                              },
                            ],
                            opacity: dot.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.45, 1],
                            }),
                          },
                        ]}
                      />
                    ))}
                    <RNText style={styles.actionDisabled}>
                      正在加载 · 已耗时 {loadElapsedS}s
                    </RNText>
                  </View>
                  {/* 无确定进度（模型加载无 step 上报）：2% 底条，与生图页加载期语义一致 */}
                  <View style={styles.loadingTrack}>
                    <View style={[styles.loadingFill, {width: '2%'}]} />
                  </View>
                </View>
              ) : isActiveModel ? (
                // 卸载 = 独立动作（不触发选择），stopPropagation 隔卡片 onPress
                <TouchableOpacity
                  testID={`picker-unload-${model.id}`}
                  disabled={modelStore.isContextLoading}
                  onPress={e => {
                    e.stopPropagation();
                    modelStore.releaseContext(true);
                  }}>
                  <RNText style={[styles.actionText, styles.actionTextUnload]}>
                    卸载
                  </RNText>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  testID={`picker-load-${model.id}`}
                  disabled={modelStore.isContextLoading}
                  onPress={e => {
                    e.stopPropagation();
                    handleModelSelect(model);
                  }}>
                  <RNText style={styles.actionText}>加载</RNText>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        );
      },
      [styles, handleModelSelect, loadElapsedS, waveDots],
    );

    // If the snapPoints not memoized, the sheet gets closed when the tab is changed for the first time.
    const snapPoints = React.useMemo(() => ['70%'], []);

    return (
      <BottomSheet
        ref={bottomSheetRef}
        // index={-1} // remove this line to make it visible by default
        onClose={onClose}
        enablePanDownToClose
        snapPoints={snapPoints} // Dynamic sizing is not working properly in all situations, like keyboard open/close android/ios ...
        enableDynamicSizing={false}
        backdropComponent={isVisible ? CustomBackdrop : undefined} // on android we need this check to ensure it doenst' block interaction
        backgroundStyle={{
          backgroundColor: theme.colors.background,
        }}
        handleIndicatorStyle={{
          backgroundColor: theme.colors.primary,
        }}
        // Add these props to better handle gestures
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        // Disable accessible so Appium/e2e tests can access child elements on iOS.
        // Without this, BottomSheet sets accessible={true} which collapses all
        // children from the accessibility tree. Same fix as Sheet.tsx.
        // See: https://github.com/gorhom/react-native-bottom-sheet/issues/1141
        accessible={false}>
        <BottomSheetScrollView
          contentContainerStyle={{paddingBottom: chatInputHeight + 66}}>
          {modelStore.availableModels
            .filter(isChatSelectable)
            .map(renderModelItem)}
          {/* B18 单槽脚注（大王裁定标注） */}
          <RNText style={styles.sheetFootnote}>
            聊天模型单槽：加载新模型会自动卸载当前模型；管家常驻不占槽。
          </RNText>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);
