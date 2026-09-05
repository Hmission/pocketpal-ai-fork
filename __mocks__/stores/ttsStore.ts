import {makeAutoObservable} from 'mobx';

type DownloadState = 'not_installed' | 'downloading' | 'ready' | 'error';

class MockTTSStore {
  // Mirror the real store shape: `isTTSAvailable` is derived from
  // `deviceMeetsMemory` and `userTTSOverride`. Tests should mutate the inputs.
  deviceMeetsMemory = false;
  userTTSOverride: boolean | null = null;
  get isTTSAvailable(): boolean {
    if (this.userTTSOverride === true) {
      return true;
    }
    if (this.userTTSOverride === false) {
      return false;
    }
    return this.deviceMeetsMemory;
  }

  // 播报门镜像（W1a 门合并）：与真 store 同一口径——设备/音色/引擎三判一处。
  // 真 store 靠 `Engine.requiresModelFile` 能力位分流，测试替身拿不到引擎注册表
  // （它会拉原生模块），此处用同语义的名单镜像；**新增引擎须同步这一行**。
  private static readonly MODEL_FILE_ENGINES = [
    'kitten',
    'kokoro',
    'supertonic',
  ];
  /** 镜像 `__mocks__/external/@pocketpalai` 的 getAvailableVoices 非空→可用。 */
  osTTSReady: boolean | null = true;

  engineIsReady(engine: string): boolean {
    if (!MockTTSStore.MODEL_FILE_ENGINES.includes(engine)) {
      return this.osTTSReady === true;
    }
    const state =
      engine === 'supertonic'
        ? this.supertonicDownloadState
        : engine === 'kokoro'
          ? this.kokoroDownloadState
          : this.kittenDownloadState;
    return state === 'ready';
  }

  voiceBlock(voice: any): 'device' | 'noVoice' | 'engine' | null {
    if (!this.isTTSAvailable) {
      return 'device';
    }
    if (voice == null) {
      return 'noVoice';
    }
    return this.engineIsReady(voice.engine) ? null : 'engine';
  }

  get speakBlock(): 'device' | 'noVoice' | 'engine' | null {
    return this.voiceBlock(this.currentVoice);
  }

  canSpeakVoice(voice: any): boolean {
    return this.voiceBlock(voice) === null;
  }

  get canSpeak(): boolean {
    return this.speakBlock === null;
  }

  /** 播报入口（镜像真 store 的单一决策点）：可播 / 去 setup / 不显示。 */
  get speakEntry(): 'speak' | 'setup' | null {
    const block = this.speakBlock;
    if (block === null) {
      return 'speak';
    }
    return block === 'noVoice' ? 'setup' : null;
  }

  /** 运行期播报问题（镜像真 store 字段；用例直接赋值）。 */
  speakIssue: 'lang' | 'failed' | null = null;

  playbackState:
    | {mode: 'idle'}
    | {mode: 'streaming'; messageId: string}
    | {mode: 'playing'; messageId: string} = {mode: 'idle'};
  autoSpeakEnabled = false;
  currentVoice: any = null;
  isSetupSheetOpen = false;
  lastSpokenMessageId: string | null = null;

  supertonicDownloadState: DownloadState = 'not_installed';
  supertonicDownloadProgress = 0;
  supertonicDownloadError: string | null = null;
  supertonicSteps: 1 | 2 | 3 | 5 | 10 = 3;
  supertonicLanguage: string = 'na';

  kokoroDownloadState: DownloadState = 'not_installed';
  kokoroDownloadProgress = 0;
  kokoroDownloadError: string | null = null;

  kittenDownloadState: DownloadState = 'not_installed';
  kittenDownloadProgress = 0;
  kittenDownloadError: string | null = null;

  init: jest.Mock;
  play: jest.Mock;
  preview: jest.Mock;
  isPreviewingVoice: jest.Mock;
  stop: jest.Mock;
  setAutoSpeak: jest.Mock;
  setUserTTSOverride: jest.Mock;
  setCurrentVoice: jest.Mock;
  setSupertonicSteps: jest.Mock;
  setSupertonicLanguage: jest.Mock;
  openSetupSheet: jest.Mock;
  closeSetupSheet: jest.Mock;
  onAssistantMessageStart: jest.Mock;
  onAssistantMessageChunk: jest.Mock;
  onAssistantMessageComplete: jest.Mock;
  downloadSupertonic: jest.Mock;
  retryDownload: jest.Mock;
  deleteSupertonic: jest.Mock;
  downloadKokoro: jest.Mock;
  retryKokoroDownload: jest.Mock;
  deleteKokoro: jest.Mock;
  downloadKitten: jest.Mock;
  retryKittenDownload: jest.Mock;
  deleteKitten: jest.Mock;

  constructor() {
    makeAutoObservable(this, {
      init: false,
      play: false,
      preview: false,
      isPreviewingVoice: false,
      stop: false,
      setAutoSpeak: false,
      setUserTTSOverride: false,
      setCurrentVoice: false,
      setSupertonicSteps: false,
      setSupertonicLanguage: false,
      openSetupSheet: false,
      closeSetupSheet: false,
      onAssistantMessageStart: false,
      onAssistantMessageChunk: false,
      onAssistantMessageComplete: false,
      downloadSupertonic: false,
      retryDownload: false,
      deleteSupertonic: false,
      downloadKokoro: false,
      retryKokoroDownload: false,
      deleteKokoro: false,
      downloadKitten: false,
      retryKittenDownload: false,
      deleteKitten: false,
    });
    this.init = jest.fn().mockResolvedValue(undefined);
    this.play = jest.fn().mockResolvedValue(undefined);
    this.preview = jest.fn().mockResolvedValue(undefined);
    this.isPreviewingVoice = jest.fn().mockReturnValue(false);
    this.stop = jest.fn().mockResolvedValue(undefined);
    this.setAutoSpeak = jest.fn();
    this.setUserTTSOverride = jest.fn();
    this.setCurrentVoice = jest.fn();
    this.setSupertonicSteps = jest.fn();
    this.setSupertonicLanguage = jest.fn();
    this.openSetupSheet = jest.fn();
    this.closeSetupSheet = jest.fn();
    this.onAssistantMessageStart = jest.fn();
    this.onAssistantMessageChunk = jest.fn();
    this.onAssistantMessageComplete = jest.fn();
    this.downloadSupertonic = jest.fn().mockResolvedValue(undefined);
    this.retryDownload = jest.fn().mockResolvedValue(undefined);
    this.deleteSupertonic = jest.fn().mockResolvedValue(undefined);
    this.downloadKokoro = jest.fn().mockResolvedValue(undefined);
    this.retryKokoroDownload = jest.fn().mockResolvedValue(undefined);
    this.deleteKokoro = jest.fn().mockResolvedValue(undefined);
    this.downloadKitten = jest.fn().mockResolvedValue(undefined);
    this.retryKittenDownload = jest.fn().mockResolvedValue(undefined);
    this.deleteKitten = jest.fn().mockResolvedValue(undefined);
  }
}

export const mockTTSStore = new MockTTSStore();
