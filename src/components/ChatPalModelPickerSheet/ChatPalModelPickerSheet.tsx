import React, {useRef, useEffect} from 'react';
import {View, Pressable, Keyboard} from 'react-native';
import {observer} from 'mobx-react';
import {Text} from 'react-native-paper';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {modelStore} from '../../store';
import {CustomBackdrop} from '../Sheet/CustomBackdrop';
import {getModelSkills, Model} from '../../utils';
import {
  getModelDisplayNameWithParams,
  isChatSelectable,
} from '../../utils/modelDisplayNames';
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

    const handleModelSelect = React.useCallback(
      async (model: (typeof modelStore.availableModels)[0]) => {
        try {
          onModelSelect?.(model.id);
          onClose();
          modelStore.selectModel(model);
        } catch (e) {
          console.log(`Error: ${e}`);
        }
      },
      [onModelSelect, onClose],
    );

    const renderModelItem = React.useCallback(
      (model: Model) => {
        const isActiveModel = model.id === modelStore.activeModelId;
        const modelSkills = getModelSkills(model)
          .flatMap(skill => skill.labelKey)
          .join(', ');
        return (
          <Pressable
            key={model.id}
            style={[styles.listItem, isActiveModel && styles.activeListItem]}
            onPress={() => handleModelSelect(model)}>
            <View style={styles.itemContent}>
              <Text
                style={[
                  styles.itemTitle,
                  isActiveModel && styles.activeItemTitle,
                ]}>
                {getModelDisplayNameWithParams(model)}
              </Text>
              {modelSkills && <ObservedSkillsDisplay model={model} />}
            </View>
          </Pressable>
        );
      },
      [styles, handleModelSelect],
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
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);
