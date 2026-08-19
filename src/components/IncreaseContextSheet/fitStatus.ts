import type {ContextInitParams, Model} from '../../utils/types';
import {getModelMemoryRequirement} from '../../utils/memoryEstimator';
import {CONTEXT_LADDER} from '../../utils/bannerVariantResolver';

export type FitStatus = 'fits' | 'tight' | 'wont_fit';

interface FitStatusDeps {
  // Memory required to load the model at a candidate n_ctx, via the same
  // estimator the load path uses.
  memBytesFor: (nCtx: number) => number;
  // Calibrated ceiling below which a load is considered safe.
  ceiling: number;
  // Total device RAM; 0 collapses the "tight" zone to fits-or-won't.
  totalMemory: number;
}

// Pure, store-free three-zone fit classifier. Caller injects the estimator and
// the memory bounds so this stays free of MobX / device dependencies.
export const makeFitStatusFor =
  ({memBytesFor, ceiling, totalMemory}: FitStatusDeps) =>
  (nCtx: number): FitStatus => {
    const req = memBytesFor(nCtx);
    if (req <= ceiling) {
      return 'fits';
    }
    if (totalMemory > 0 && req <= totalMemory) {
      return 'tight';
    }
    return 'wont_fit';
  };

// Gate for the banner's increase CTA: true iff at least one ladder tier above
// the current size, within the model's trained cap, fits the device. Mirrors
// the sheet's ladder filter so the CTA never opens a sheet with no real stop.
export const hasFittingUpgrade = (
  ladder: readonly number[],
  currentNCtx: number,
  modelMaxCtx: number,
  fitStatusFor: (nCtx: number) => FitStatus,
): boolean =>
  ladder.some(
    tier =>
      tier > currentNCtx &&
      tier <= modelMaxCtx &&
      fitStatusFor(tier) === 'fits',
  );

// 从 Model 直接判定是否存在可行扩窗档（内存估算注入同一 estimator）。
// 单事实源：ChatView 的 canIncreaseContext CTA 门控与 useChatSession 的
// 预算决策机（canExpand）共用——扩窗可行性两处永远一致。
export const hasModelUpgradeFitting = (
  model: Model,
  projectionModel: Model | undefined,
  currentNCtx: number,
  contextInitParams: ContextInitParams,
  ceiling: number,
): boolean => {
  const modelMaxCtx =
    model.ggufMetadata?.context_length ??
    CONTEXT_LADDER[CONTEXT_LADDER.length - 1];
  const fitStatusFor = makeFitStatusFor({
    memBytesFor: nCtx => {
      try {
        return getModelMemoryRequirement(model, projectionModel, {
          ...contextInitParams,
          n_ctx: nCtx,
        });
      } catch {
        return Number.POSITIVE_INFINITY;
      }
    },
    ceiling,
    totalMemory: 0,
  });
  return hasFittingUpgrade(
    CONTEXT_LADDER,
    currentNCtx,
    modelMaxCtx,
    fitStatusFor,
  );
};
