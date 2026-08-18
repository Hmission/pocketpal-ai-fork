import {Appearance} from 'react-native';

import {makePersistable} from 'mobx-persist-store';
import {makeAutoObservable, runInAction} from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  l10n,
  supportedLanguages as localesSupportedLanguages,
  type AvailableLanguage,
} from '../locales';
import {ErrorState} from '../utils/errors';
import {
  INITIAL_ONBOARDING_STATE,
  type OnboardingState,
  type OnboardingStep,
  type TopicKey,
} from './onboarding/types';

export class UIStore {
  static readonly GROUP_KEYS = {
    READY_TO_USE: 'ready_to_use',
    AVAILABLE_TO_DOWNLOAD: 'available_to_download',
  } as const;

  pageStates = {
    modelsScreen: {
      filters: [] as string[],
      expandedGroups: {
        [UIStore.GROUP_KEYS.READY_TO_USE]: true,
      },
    },
  };

  // This is a flag to auto-navigate to the chat page after loading a model
  autoNavigatetoChat = true;

  // v3.8 修复：支持 'system' 模式 + Appearance 监听器跟随系统色彩
  colorScheme: 'light' | 'dark' | 'system' = 'system';
  // 系统当前色彩（由 Appearance.addEventListener 实时更新）
  _systemColorScheme: 'light' | 'dark' =
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

  /** 计算：'system' 模式解析为实际 light/dark */
  get resolvedColorScheme(): 'light' | 'dark' {
    return this.colorScheme === 'system'
      ? this._systemColorScheme
      : this.colorScheme;
  }

  // Current selected language (default to Chinese; user can switch in settings)
  _language: AvailableLanguage = 'zh';

  // List of supported languages (derived from locales registry)
  get supportedLanguages(): readonly AvailableLanguage[] {
    return localesSupportedLanguages;
  }

  displayMemUsage = false;

  // P4 智能体仪式：自检开关（重要回复跑两遍：生成→自检→修正）
  selfCheckEnabled = false;

  iOSBackgroundDownloading = true;

  // 卸载后保留聊天记录（共享存储快照开关，默认开）：
  // 关 = 停止快照导出并删除已有快照（用户主动清数据语义）。
  persistUserData = true;

  benchmarkShareDialog = {
    shouldShow: true,
  };

  // Warning state for chat-related warnings (like multimodal warnings)
  chatWarning: ErrorState | null = null;

  // Models for which the tool-compatibility banner has already been shown.
  // Persisted so each model warns at most once per device.
  toolCompatWarnedModels: string[] = [];

  // Onboarding flow gating: persisted; default false on a fresh install.
  // Once flipped true, the OnboardingStack never re-mounts in this app
  // lifetime.
  hasCompletedOnboarding: boolean = false;

  // Frozen at onboarding completion; consumed by future Homepage
  // pal-suggestion surfaces. Never re-edited after the single write in
  // `completeOnboarding`.
  onboardingTopicsSnapshot: TopicKey[] = [];

  // Per-session, in-memory only. Reset on completion. Not persisted.
  onboardingState: OnboardingState = {...INITIAL_ONBOARDING_STATE};

  // Per-modelId dismissal of the download banner. Per-session — once the
  // download completes, the entry can be cleared so a fresh ready-to-load
  // state isn't pre-dismissed.
  dismissedDownloadIds: string[] = [];

  hasWarnedToolCompat(modelId: string): boolean {
    return this.toolCompatWarnedModels.includes(modelId);
  }

  markToolCompatWarned(modelId: string) {
    runInAction(() => {
      if (!this.toolCompatWarnedModels.includes(modelId)) {
        this.toolCompatWarnedModels.push(modelId);
      }
    });
  }

  showError(message: string) {
    // TODO: Implement error display logic (e.g., toast, alert, etc.)
    console.error(message);
  }

  setChatWarning(warning: ErrorState | null) {
    runInAction(() => {
      this.chatWarning = warning;
    });
  }

  clearChatWarning() {
    runInAction(() => {
      this.chatWarning = null;
    });
  }

  constructor() {
    makeAutoObservable(this);
    makePersistable(this, {
      name: 'UIStore',
      properties: [
        'pageStates',
        'colorScheme',
        'autoNavigatetoChat',
        'displayMemUsage',
        'selfCheckEnabled',
        'benchmarkShareDialog',
        'persistUserData',
        '_language',
        'toolCompatWarnedModels',
        'hasCompletedOnboarding',
        'onboardingTopicsSnapshot',
      ],
      storage: AsyncStorage,
    });

    // backwards compatibility. Removed this from the ui settings screen.
    this.iOSBackgroundDownloading = true;

    // v3.8：监听系统色彩变化，'system' 模式实时跟随（RN 0.82 API）
    Appearance.addChangeListener(({colorScheme: newScheme}) => {
      if (!newScheme || newScheme === 'unspecified') {
        return;
      }
      runInAction(() => {
        this._systemColorScheme = newScheme;
      });
    });
  }

  setValue<T extends keyof typeof this.pageStates>(
    page: T,
    key: keyof (typeof this.pageStates)[T],
    value: any,
  ) {
    runInAction(() => {
      if (this.pageStates[page]) {
        this.pageStates[page][key] = value;
      } else {
        console.error(`Page '${page}' does not exist in pageStates`);
      }
    });
  }

  setColorScheme(colorScheme: 'light' | 'dark' | 'system') {
    runInAction(() => {
      this.colorScheme = colorScheme;
    });
  }

  setSelfCheckEnabled(enabled: boolean) {
    runInAction(() => {
      this.selfCheckEnabled = enabled;
    });
  }

  setLanguage(language: AvailableLanguage) {
    runInAction(() => {
      this._language = language;
    });
  }
  get language() {
    // If the language is not in l10n, return 'en'
    // This can happen when the app removes a language from l10n
    return this._language in l10n ? this._language : 'en';
  }

  get l10n() {
    return l10n[this.language];
  }

  setAutoNavigateToChat(value: boolean) {
    runInAction(() => {
      this.autoNavigatetoChat = value;
    });
  }

  setDisplayMemUsage(value: boolean) {
    runInAction(() => {
      this.displayMemUsage = value;
    });
  }

  setiOSBackgroundDownloading(value: boolean) {
    runInAction(() => {
      this.iOSBackgroundDownloading = value;
    });
  }

  setPersistUserData(value: boolean) {
    runInAction(() => {
      this.persistUserData = value;
    });
  }

  setBenchmarkShareDialogPreference(shouldShow: boolean) {
    runInAction(() => {
      this.benchmarkShareDialog.shouldShow = shouldShow;
    });
  }

  setOnboardingStep(step: OnboardingStep) {
    runInAction(() => {
      this.onboardingState.currentStep = step;
    });
  }

  setOnboardingTopic(key: TopicKey | null) {
    runInAction(() => {
      this.onboardingState.selectedTopic = key;
    });
  }

  setOnboardingModelId(modelId: string | null) {
    runInAction(() => {
      this.onboardingState.selectedModelId = modelId;
    });
  }

  completeOnboarding({
    topic,
    modelId: _modelId,
  }: {
    topic: TopicKey | null;
    modelId: string | null;
  }) {
    runInAction(() => {
      this.hasCompletedOnboarding = true;
      // Persisted snapshot stays as `TopicKey[]` for multi-tag headroom.
      // Derive from the new scalar: null → [], else [topic].
      this.onboardingTopicsSnapshot = topic === null ? [] : [topic];
      this.onboardingState = {...INITIAL_ONBOARDING_STATE};
    });
  }

  // Test / E2E only — callers MUST gate with `__DEV__ || __E2E__`.
  resetOnboarding() {
    runInAction(() => {
      this.hasCompletedOnboarding = false;
      this.onboardingTopicsSnapshot = [];
      this.onboardingState = {...INITIAL_ONBOARDING_STATE};
    });
  }

  // User-triggered replay (About → Show intro again). Re-enters the flow
  // without nuking the persisted topic snapshot; the user's next finish
  // will overwrite it. Distinct from `resetOnboarding` (dev/E2E nuke).
  replayOnboarding() {
    runInAction(() => {
      this.hasCompletedOnboarding = false;
      this.onboardingState = {...INITIAL_ONBOARDING_STATE};
    });
  }

  isDownloadBannerDismissed(modelId: string): boolean {
    return this.dismissedDownloadIds.includes(modelId);
  }

  dismissDownloadBanner(modelId: string) {
    runInAction(() => {
      if (!this.dismissedDownloadIds.includes(modelId)) {
        this.dismissedDownloadIds.push(modelId);
      }
    });
  }

  clearDownloadBannerDismissal(modelId: string) {
    runInAction(() => {
      this.dismissedDownloadIds = this.dismissedDownloadIds.filter(
        id => id !== modelId,
      );
    });
  }
}

export const uiStore = new UIStore();
