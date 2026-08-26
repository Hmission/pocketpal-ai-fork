import {useEffect, useRef, useState} from 'react';
import {Keyboard, TextInput as RNTextInput} from 'react-native';

import {debounce} from 'lodash';
import {useIsFocused} from '@react-navigation/native';

import {modelStore} from '../../../store';

/**
 * Context Size 输入状态（R3-P1 从 GenerationSettingsScreen 原样迁出）：
 * contextSize/isValidInput/debouncedUpdateStore 防抖 + isFocused 回焦同步，
 * 零行为变化——纯剪切-粘贴。
 */
export const useContextSizeInput = () => {
  const isFocused = useIsFocused();
  const [contextSize, setContextSize] = useState(
    modelStore.getModelNCtx(modelStore.activeModelId).toString(),
  );
  const [isValidInput, setIsValidInput] = useState(true);
  const inputRef = useRef<RNTextInput>(null);
  const debouncedUpdateStore = useRef(
    debounce((value: number) => {
      // n_ctx 每模型独立（2026-08-18）：有活动模型写该模型覆盖，无则写全局默认
      const modelId = modelStore.activeModelId;
      if (modelId) {
        modelStore.setModelNCtx(modelId, value);
      } else {
        modelStore.setNContext(value);
      }
    }, 500),
  ).current;

  useEffect(() => {
    setContextSize(
      modelStore.getModelNCtx(modelStore.activeModelId).toString(),
    );
  }, []);

  // Re-sync the displayed context size when the screen regains focus or the
  // global n_ctx changes elsewhere (e.g. the chat banner's increase-context
  // flow). Skipped while the input is actively edited so it never fights typing.
  const configuredNCtx = modelStore.getModelNCtx(modelStore.activeModelId);
  useEffect(() => {
    if (isFocused && !inputRef.current?.isFocused()) {
      setContextSize(configuredNCtx.toString());
      setIsValidInput(true);
    }
  }, [isFocused, configuredNCtx]);

  useEffect(() => {
    return () => {
      debouncedUpdateStore.cancel();
    };
  }, [debouncedUpdateStore]);

  const handleContextSizeChange = (text: string) => {
    setContextSize(text);
    const value = parseInt(text, 10);
    if (!isNaN(value) && value >= modelStore.MIN_CONTEXT_SIZE) {
      setIsValidInput(true);
      debouncedUpdateStore(value);
    } else {
      setIsValidInput(false);
    }
  };

  // Outside press：收键盘 + 回显原值（§18.6 与显示/保存同源）
  const resetContextSizeInput = () => {
    Keyboard.dismiss();
    inputRef.current?.blur();
    setContextSize(
      modelStore.getModelNCtx(modelStore.activeModelId).toString(),
    );
    setIsValidInput(true);
  };

  return {
    contextSize,
    isValidInput,
    inputRef,
    handleContextSizeChange,
    resetContextSizeInput,
  };
};
