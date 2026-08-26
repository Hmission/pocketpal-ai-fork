/**
 * reasoningMethods — ModelStore 推理能力方法组（models 域拆分 · 批次4 P3）
 *
 * 推理能力观察记录与手动覆盖（本地模型持久化 + 远端委托 ServerStore）。
 * 实现自 ModelStore.ts 原样迁出（行为零变化）；挂载方式见 projectionMethods.ts 头注。
 */
import {runInAction} from 'mobx';

import type {modelStore as modelStoreInstance} from '../ModelStore';
import {serverStore} from '../ServerStore';
import {ReasoningCapability} from '../../utils/reasoningCapability';

/** ModelStore 实例类型（类未导出，从单例推导；type-only import 无运行时环） */
type ModelStore = typeof modelStoreInstance;

export function applyReasoningMethods(store: ModelStore): void {
  store.recordReasoningObserved = (modelId: string): void => {
    const localModel = store.models.find(m => m.id === modelId);
    if (!localModel) {
      // Not a persisted local model → remote; delegate to ServerStore.
      serverStore.recordRemoteReasoningObserved(modelId);
      return;
    }
    const existing = localModel.reasoning;
    if (existing?.source === 'user' || existing?.isReasoning === 'yes') {
      return;
    }
    runInAction(() => {
      localModel.reasoning = {
        isReasoning: 'yes',
        source: 'learned',
        supportsEffort: existing?.supportsEffort ?? false,
        effortValues: existing?.effortValues ?? [],
        effortSource: existing?.effortSource ?? 'none',
      };
      localModel.supportsThinking = true;
    });
  };

  /**
   * Manual model-card override. Top of precedence; routes remote ids to
   * ServerStore, local to the persisted Model.
   */
  store.setReasoningOverride = (
    modelId: string,
    cap: ReasoningCapability,
  ): void => {
    const localModel = store.models.find(m => m.id === modelId);
    if (!localModel) {
      serverStore.setRemoteReasoningOverride(modelId, cap);
      return;
    }
    runInAction(() => {
      localModel.reasoning = cap;
      localModel.supportsThinking = cap.isReasoning === 'yes';
    });
  };
}
