import React, {useRef, ReactNode, useState} from 'react';
import {View, NativeModules} from 'react-native';

import {observer} from 'mobx-react';
import {runInAction} from 'mobx';
import {useNavigation} from '@react-navigation/native';

import {
  AssistantAuthorRow,
  Bubble,
  ChatView,
  ErrorSnackbar,
  ModelErrorReportSheet,
} from '../../components';

import {useChatSession} from '../../hooks/useChatSession';
import {useTheme} from '../../hooks/useTheme';
import {usePendingMessage} from '../../hooks/useDeepLinking';

import {
  modelStore,
  chatSessionStore,
  palStore,
  serverStore,
  uiStore,
  ttsStore,
} from '../../store';
import {hasVideoCapability} from '../../utils/pal-capabilities';

import {L10nContext} from '../../utils';
import {resolveReasoningCapability} from '../../utils/reasoningCapability';
import {MessageType, Theme} from '../../utils/types';
import {ErrorState} from '../../utils/errors';
import {user, assistant} from '../../utils/chat';
import {
  isTaskActionCard,
  isTaskErrorCard,
  isGeneratingTaskCard,
} from '../../utils/messageCards';
import {useChatScheduler} from '../../hooks/useChatScheduler';
import {BenchmarkHudBar} from '../../components/BenchmarkHudBar';
import {registerChatSender} from '../../debug';
import {ActiveTaskBanner} from '../../components/ActiveTaskBanner/ActiveTaskBanner';
import {ImageTaskActions} from '../../components/ImageTaskActions/ImageTaskActions';
import {ImageTaskProgress} from '../../components/ImageTaskProgress/ImageTaskProgress';
import {TaskErrorCard} from '../../components/TaskErrorCard/TaskErrorCard';
import {ButlerUpgradeRow} from '../../components/ButlerUpgradeRow/ButlerUpgradeRow';
import {TextMessage} from '../../components/TextMessage';
import {promptWriter} from '../../services/promptWriter';
import {imageGenStore} from '../../store';
import {engineStatus} from '../../store/engineStatus';
import {ROUTES} from '../../utils/navigationConstants';
import {PhoneCallOverlay} from '../../components/PhoneCallOverlay/PhoneCallOverlay';
import {
  PhoneCallSession,
  type PhoneCallErrorCode,
  type PhoneCallStatus,
} from '../../services/phoneCall/session';
import {audioStore} from '../../store/audioStore';
import {
  getModelDisplayName,
  BUTLER_DISPLAY_NAME,
} from '../../utils/modelDisplayNames';
import {useElapsed} from '../../hooks/useElapsed';
import {usePerfTrace} from '../../hooks/usePerfTrace';
import {audioLevel} from '../../services/phoneCall/audioLevel';
import {setInCall, isInCall} from '../../services/phoneCall/inCall';
import {audioRecorder} from '../../services/audio/recorder';
import {nightTaskRegistry} from '../../store/nightTaskRegistry';
import {activateKeepAwake, deactivateKeepAwake} from '../../utils/keepAwake';

import {VideoPalScreen} from './VideoPalScreen';

// B18 §17 / §18.1：模型徽章 + 意图胶囊已抽离至 AssistantAuthorRow（单一事实源），
// ChatScreen.renderBubble 与 Message.renderAssistantTurn 共用。本文件不再内联。

// 导出供 renderBubble 门控测试（防回归）：assistant_turn 徽章行由
// Message.renderAssistantTurn turn 级渲染，此处仅非 turn 消息渲染。
export const renderBubble = ({
  child,
  message,
  nextMessageInGroup,
  scale,
  theme: _theme,
}: {
  child: ReactNode;
  message: MessageType.Any;
  nextMessageInGroup: boolean;
  scale?: any;
  theme: Theme;
}) => {
  return (
    <View>
      {/* task-6ad §20.1：徽章/意图改走单一事实源 AssistantAuthorRow。
          assistant_turn 已由 Message.renderAssistantTurn 在 turn 级顶部渲染一次
          （思考卡之前），此处仅 text/image/file 等非 turn 消息渲染——
          若对 turn 内容块也渲染，每个内容块都会多出一行徽章（N+1 重复）。 */}
      {message.type !== 'assistant_turn' ? (
        <AssistantAuthorRow message={message} />
      ) : null}
      <Bubble
        child={child}
        message={message}
        nextMessageInGroup={nextMessageInGroup}
        scale={scale}
      />
    </View>
  );
};

// 生图任务卡片（生成中动效 / 再来一张·编辑图片·重试动作条）：收进气泡内部动作槽
// （ADR-0003 同构，不再悬浮卡片外）；驻留引擎秒级复用，走
// runImageTaskCard / pendingEditSource 单链路。
// 调度错误卡（TaskErrorCard，P0 净化）：懒切换失败统一 danger 卡 + 重试/去模型页。
// 管家升级行（ButlerUpgradeRow，L2 2026-08-21）：butler 卡片「换个更聪明的模型」。
const renderTextMessage = (
  message: MessageType.Text,
  messageWidth: number,
  showName: boolean,
  handlers?: {
    onRetry: (text: string) => void;
    onGoModels: () => void;
    onButlerUpgrade: (text: string) => void;
  },
) => {
  // 卡片标记名与判定统一走 utils/messageCards（单一清单，与通话字幕过滤同源）。
  // butler / userText 不是卡片标记而是卡片载荷（升级入口要取原文重发），仍本地读。
  const meta = (message.metadata ?? {}) as {
    butler?: boolean;
    userText?: string;
  };
  const hasTask = isTaskActionCard(message);
  const hasError = isTaskErrorCard(message);
  // 生成中占位卡（未回写图片/失败标记）→ 内嵌生成动效（三点波浪+进度+耗时）；
  // 回写成功/失败后 → 动作条（再来一张/编辑图片/继续编辑/重试）
  const generating = isGeneratingTaskCard(message);
  return (
    <TextMessage
      // ChatView 插槽传 Text；TextMessage 只消费 text/metadata/author，
      // derived 字段运行时不需要，cast 到 DerivedText 通过类型检查
      message={message as MessageType.DerivedText}
      messageWidth={messageWidth}
      showName={showName}
      actions={
        hasTask ? (
          generating ? (
            <ImageTaskProgress />
          ) : (
            <ImageTaskActions message={message as MessageType.Text} />
          )
        ) : hasError ? (
          <TaskErrorCard
            message={message as MessageType.Text}
            onRetry={handlers?.onRetry}
            onGoModels={handlers?.onGoModels}
          />
        ) : meta.butler ? (
          <ButlerUpgradeRow
            userText={meta.userText ?? ''}
            onUpgrade={handlers?.onButlerUpgrade ?? (() => {})}
          />
        ) : undefined
      }
    />
  );
};

export const ChatScreen: React.FC = observer(() => {
  const theme = useTheme();
  const currentMessageInfo = useRef<{
    createdAt: number;
    id: string;
    sessionId: string;
  } | null>(null);
  const l10n = React.useContext(L10nContext);

  const activePalId = chatSessionStore.activePalId;
  const activePal = activePalId
    ? palStore.pals.find(p => p.id === activePalId)
    : undefined;
  const isVideoPal = activePal && hasVideoCapability(activePal);

  // State for model error report sheet
  const [isErrorReportVisible, setIsErrorReportVisible] = useState(false);
  const [errorToReport, setErrorToReport] = useState<ErrorState | null>(null);

  // P5 编辑源图（豆包式）：三入口下沉输入框——任务卡「编辑图片」经
  // imageGenStore.pendingEditSource 交接；快捷行/全屏查看器经 onEditSourceChange 直连
  const [editSourceUri, setEditSourceUri] = useState<string | null>(null);

  // observer 本地读（MobX 惯例）：pendingEditSource 是 observable 属性，先读入 render
  // 局部变量——深链写入触发 observer 重渲染 → 局部变量刷新 → effect 重跑消费；
  // 取用即清空（runInAction），天然防重复执行。
  const pendingEditSource = imageGenStore.pendingEditSource;

  // 任务卡「编辑图片」改道：pendingEditSource（原跳生图页深链）→ 聊天内下沉输入框
  React.useEffect(() => {
    if (pendingEditSource) {
      const uri = pendingEditSource;
      runInAction(() => {
        imageGenStore.pendingEditSource = null;
      });
      setEditSourceUri(uri);
    }
  }, [pendingEditSource]);

  // 会话切换/新建时清空编辑源图（会话内临时态，防泄漏到下一会话，锋利不臃肿）
  const activeSessionId = chatSessionStore.activeSessionId;
  React.useEffect(() => {
    setEditSourceUri(null);
  }, [activeSessionId]);

  // 电话会话编排的 ref 本身必须上移到 useChatScheduler 之前（handleButlerReplied 要用它）；
  // 构造体仍留在下方，因为它依赖 wrappedSendPress。
  const phoneSessionRef = useRef<PhoneCallSession | null>(null);

  /**
   * 管家直答的回合声明（PHONE_SPEC §18.3）：谁产生回复，谁报告。
   *
   * 判「是否在通话里」读单一状态源 `isInCall()`，**不捕获 React state**：
   * 本回调要以稳定引用进 useChatScheduler 的 useCallback deps，一旦捕获
   * `phoneVisible` 就会陈旧。旧写法让 ChatScreen 扫消息数组反推，正是为了
   * 绕开这类陈旧闭包，代价是多出一个判定源——本轮把声明补到产生者那里，
   * 旁路整条删除。
   */
  const handleButlerReplied = React.useCallback(
    async (cardId: string, finalText: string) => {
      if (!isInCall()) {
        return;
      }
      phoneSessionRef.current?.notifyReplyStarted();
      try {
        await ttsStore.play(cardId, finalText, {hadReasoning: false});
      } catch (e) {
        console.warn('[ChatScreen] phone butler reply play failed:', e);
      }
      phoneSessionRef.current?.notifyReplyFinished();
    },
    [],
  );

  const {handleSendPress, handleStopPress} = useChatSession(
    currentMessageInfo,
    user,
    assistant,
    {
      // PHONE_SPEC §4.3 + §18：电话回合生命周期 → 驱动 PhoneCallSession 状态机。
      // chat 引擎路径由 token 回调声明；管家直答路径由 handleButlerReplied 声明。
      // 两条路径在一次发送里互斥（scheduler 路由决定），无需仲裁标记——旧 handledRef
      // 防的那个并发并不存在。
      onPhoneTurnStarted: () => phoneSessionRef.current?.notifyReplyStarted(),
      onPhoneTurnFinished: () => phoneSessionRef.current?.notifyReplyFinished(),
    },
  );

  // 任务驱动调度（调度叙事，实现在 hooks/useChatScheduler）：
  // - image → 聊天内联闭环（加载引擎→出图→插入图片/错误卡片），不跳转页面
  // - write/code → chat 引擎未加载时按能力注册表自动选模型加载，再走常规聊天
  // - chitchat → chat 引擎未加载且管家就绪时，由常驻管家直接回答（启动即就绪）
  // - upgradeButlerReply → 用户主权升级（L2 2026-08-21）：管家卡片「换个更聪明的模型」
  const {wrappedSendPress, upgradeButlerReply} = useChatScheduler(
    handleSendPress,
    handleButlerReplied,
  );

  // ==================== 电话模式（PHONE_SPEC §4） ====================
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<PhoneCallStatus>('idle');
  // 转写实时回显（§10.3：输入成功反馈）
  const [phoneTranscript, setPhoneTranscript] = useState('');
  // 通话时长（§10.2 打电话仪式）
  const phoneElapsed = useElapsed(phoneVisible);
  // 跑分迷你行数据（§11.7：电话模式跨回合常驻——空闲期走环境轨迹，
  // 生成期自动切回 chatTurnPerf 回合轨迹；任一时刻只一个 1Hz 采样源）。
  const phonePerfHistory = usePerfTrace(phoneVisible);

  // 引擎就绪门控（§10.3）：chat 引擎/管家任一 ready 即可通话；未就绪时取
  // 加载中引擎的 progress/stage 作进度条（engineStatus 单一事实源）。
  // observer 内直接派生（MobX 字段访问即订阅，AudioWorkshopTab B38 同款模式）。
  const phoneEngineReady =
    engineStatus.engines.chat.phase === 'ready' ||
    engineStatus.engines.prompter.phase === 'ready';
  const phoneEngineLoading = (() => {
    if (phoneEngineReady || !phoneVisible) {
      return null;
    }
    const active = [engineStatus.engines.chat, engineStatus.engines.prompter]
      .filter(e => e.phase === 'loading')
      .sort((a, b) => b.progress - a.progress)[0];
    return active
      ? {progress: active.progress, stage: active.stage}
      : {progress: -1, stage: ''};
  })();

  // PHONE_SPEC §10.4：通话中双保活——亮屏（keep awake）+ 前台服务防杀。
  // nightTask 机制同构接线（imageGenStore §7.1 同款：registry 引用计数 +
  // VideoTaskService 前后台服务；计数归零才 stop，与生图/推理共用不互相误停）。
  //
  // 同一 effect 顺便登记「此刻在通话中」（W2 单一状态源）：useChatSession 读它
  // 判定本轮要不要强制播报与通知收口——开合在此一处成对，不留第二份状态。
  React.useEffect(() => {
    if (!phoneVisible) {
      return;
    }
    setInCall(true);
    activateKeepAwake();
    // 通话也持一张自己的夜间保活票据（W2）：结束时凭票释放——旧写法裸 end()
    // 会把生图队列的保活额度一起扣掉（夜间长跑中挂断一次即失保）。
    const nightTicket = nightTaskRegistry.begin('phoneCall');
    NativeModules.VideoTaskService?.start?.().catch(() => {});
    return () => {
      setInCall(false);
      nightTaskRegistry.end(nightTicket);
      if (!nightTaskRegistry.isBusy) {
        NativeModules.VideoTaskService?.stop?.().catch(() => {});
      }
      deactivateKeepAwake();
    };
  }, [phoneVisible]);

  /** 电话错误 → chatWarning Snackbar（与聊天页既有警示同一视觉，不另造） */
  const handlePhoneError = React.useCallback(
    (code: PhoneCallErrorCode) => {
      const phoneCallL10n = l10n.components.phoneCall;
      const message =
        code === 'PERMISSION_DENIED'
          ? phoneCallL10n.permissionDenied
          : code === 'EMPTY_SPEECH'
            ? phoneCallL10n.emptySpeech
            : phoneCallL10n.failed;
      uiStore.setChatWarning({
        code: 'unknown',
        message,
        context: 'chat',
        recoverable: true,
        severity: 'warning',
      });
    },
    [l10n],
  );

  // 惰性构造会话编排（依赖四件套全注入，纯 TS 可单测；录音启停已归一到 audioRecorder）
  if (!phoneSessionRef.current) {
    phoneSessionRef.current = new PhoneCallSession({
      record: {
        // W2b：权限/互斥/原生失败全在 audioRecorder 里分好类，这里只注入 owner。
        // 通话中麦克风归电话：其他入口（输入框/工坊）抢不到会明确失败，不会互相抢走录音。
        start: () => audioRecorder.start('phone_call'),
        stop: () => audioRecorder.stop('phone_call'),
      },
      transcribe: path => audioStore.transcribeTask(path),
      send: text => {
        // PHONE_SPEC §5（W2）：不再给消息打 phoneMode 标记——电话轮判定由
        // `inCall` 单一状态源负责（覆盖全部回复路径，不靠逐路径透传）。
        return wrappedSendPress({text} as MessageType.PartialText);
      },
      stopInference: handleStopPress,
      speakStop: () => ttsStore.stop(),
      onTranscript: setPhoneTranscript,
      notify: setPhoneStatus,
      onError: handlePhoneError,
    });
  }

  /** 顶栏电话图标（PHONE_SPEC §3.1）：SenseVoice 未就绪时的点击引导 */
  const handlePhoneCallPress = React.useCallback(() => {
    if (audioStore.asrState !== 'ready') {
      uiStore.setChatWarning({
        code: 'unknown',
        message: l10n.components.phoneCall.asrNotReady,
        context: 'chat',
        recoverable: true,
        severity: 'warning',
      });
      return;
    }
    setPhoneVisible(true);
  }, [l10n]);

  /** 挂断：停播 + 打断推理 + 关闭通话界面（已落库消息保留）。
   *  右上 ✕ 随 v2.1 删除（与本函数同为退出入口，不重复设口）。 */
  const handlePhoneHangUp = React.useCallback(() => {
    setPhoneTranscript('');
    void phoneSessionRef.current?.hangUp();
    setPhoneVisible(false);
  }, []);

  // 联系人位名字（§11.2 v2.3 定案，大王：「默认显示小妖」）：pal 无名就用默认
  // 伙伴名，**不再拿会话标题当名字**（曾显示「帮我画一张画。」读着像 bug）。
  const phonePartnerName =
    activePal?.name?.trim() || l10n.components.phoneCall.defaultPartnerName;
  // 模型胶囊回落（PHONE_SPEC §11.2）：未加载聊天模型但管家驻场 → 显示管家名
  // （与顶栏胶囊三档链同一语义，不另造口径）。
  const phoneModelLabel = modelStore.activeModel
    ? getModelDisplayName(modelStore.activeModel)
    : promptWriter.isLoaded
      ? BUTLER_DISPLAY_NAME
      : '';

  // DRC 聊天发送槽（debug/E2E 构建）：ChatScreen 在岗时注册 wrappedSendPress，
  // 卸载注销——command chat.send 复用完整调度链路（意图路由/管家直答），单一事实源。
  React.useEffect(() => {
    registerChatSender(message =>
      wrappedSendPress({text: message.text} as MessageType.PartialText),
    );
    return () => registerChatSender(null);
  }, [wrappedSendPress]);

  // 调度错误卡动作（TaskErrorCard，P0 净化）：重试 = 重新走调度发送原消息；
  // 去模型页 = 排查引导（无模型/加载失败时）
  const navigation = useNavigation();
  const handleTaskErrorRetry = React.useCallback(
    (retryText: string) => {
      wrappedSendPress({text: retryText} as MessageType.PartialText);
    },
    [wrappedSendPress],
  );
  const handleTaskErrorGoModels = React.useCallback(() => {
    navigation.navigate(ROUTES.MODELS as never);
  }, [navigation]);

  // Handle deep linking for message prefill
  const {pendingMessage, clearPendingMessage} = usePendingMessage();

  // Handlers for model error report
  const handleReportModelError = React.useCallback(() => {
    if (modelStore.modelLoadError) {
      setErrorToReport(modelStore.modelLoadError);
      setIsErrorReportVisible(true);
      modelStore.clearModelLoadError();
    }
  }, []);

  const handleCloseErrorReport = React.useCallback(() => {
    setIsErrorReportVisible(false);
    setErrorToReport(null);
  }, []);

  const visionEnabled = modelStore.activeModelCaps.visionActive;

  // Resolver is the single source of truth for reasoning capability.
  // Pill is reachable whenever the model is not known to be non-reasoning
  // (fail-open on 'unknown' so remote + missed-local models are reachable).
  const reasoningCapability = resolveReasoningCapability(
    modelStore.activeModel,
    serverStore.remoteReasoning,
  );
  const thinkingSupported =
    !!modelStore.activeModel && reasoningCapability.isReasoning !== 'no';

  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<string | undefined>(
    undefined,
  );
  const activeSession = chatSessionStore.sessions.find(
    s => s.id === chatSessionStore.activeSessionId,
  );
  React.useEffect(() => {
    let cancelled = false;
    chatSessionStore.getCurrentCompletionSettings().then(settings => {
      if (!cancelled) {
        // A2（2026-09-03）：默认关思考与 completionSettingsVersions v5 一致；
        // 思考仍是用户主权，pill 可随时显式开启。
        setThinkingEnabled(settings.enable_thinking ?? false);
        setReasoningEffort(settings.reasoning?.effort);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatSessionStore.activeSessionId,
    activeSession?.settingsSource,
    activeSession?.completionSettings,
    chatSessionStore.newChatCompletionSettings,
    chatSessionStore.newChatThinkingOverride,
    chatSessionStore.newChatReasoningEffort,
    activePalId,
  ]);

  // Tool-compatibility one-time banner: when the active Pal declares
  // tools but the loaded model's jinja metadata signals no tool support
  // in any of its slots (see below), surface an inline warning.
  // Persisted per model id so the warning fires at most once.
  React.useEffect(() => {
    const palDeclaresTools =
      activePal?.pact?.talents !== undefined &&
      activePal.pact.talents.length > 0;
    if (!palDeclaresTools) {
      return;
    }
    const model = (modelStore.context as any)?.model;
    const modelId = modelStore.activeModelId;
    if (!model || !modelId) {
      return;
    }
    // Tool support surfaces in four independent places in llama.rn's
    // jinja metadata: defaultCaps.tools/toolCalls (model declares it
    // inline in the default template — Ministral, Llama 3.x, etc.) or
    // toolUse/toolUseCaps (separate tool-use template — Qwen3, etc.).
    // Any one is sufficient; only warn when all four are absent.
    const jinja = model.chatTemplates?.jinja;
    const hasToolSupport =
      !!jinja?.defaultCaps?.tools ||
      !!jinja?.defaultCaps?.toolCalls ||
      !!jinja?.toolUse ||
      !!jinja?.toolUseCaps;
    if (hasToolSupport) {
      return;
    }
    if (uiStore.hasWarnedToolCompat(modelId)) {
      return;
    }
    uiStore.setChatWarning({
      code: 'unknown',
      message: l10n.chat.toolCompatWarning,
      context: 'chat',
      recoverable: true,
      severity: 'warning',
      metadata: {modelId},
    });
    uiStore.markToolCompatWarned(modelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePalId, modelStore.activeModelId, modelStore.context]);

  // Persist the on/off intent (and optional effort) onto both the local
  // enable_thinking flag and the reasoning carrier so the remote wire path
  // (openai.ts, gated per serverType) and the local hook both see it.
  // Preserves pal overrides. No active session: stage on the new-chat
  // override field — the resolver applies it as the last layer and session
  // creation bakes it in, without touching newChatCompletionSettings.
  const persistReasoning = async (enabled: boolean, effort?: string) => {
    const currentSession = chatSessionStore.sessions.find(
      s => s.id === chatSessionStore.activeSessionId,
    );
    if (currentSession) {
      const resolvedSettings =
        await chatSessionStore.getCurrentCompletionSettings();
      await chatSessionStore.updateSessionCompletionSettings({
        ...resolvedSettings,
        enable_thinking: enabled,
        reasoning: {enabled, effort},
      });
    } else {
      runInAction(() => {
        chatSessionStore.newChatThinkingOverride = enabled;
        chatSessionStore.newChatReasoningEffort = effort;
      });
    }
  };

  // Simple on/off pill (effortless models): carries the on/off intent on the
  // reasoning carrier (effort undefined) so remote OFF is not a no-op.
  const handleThinkingToggle = async (enabled: boolean) => {
    await persistReasoning(enabled);
  };

  // Graded pill cycle: off -> values[0] -> ... -> values[n] -> off.
  const handleEffortCycle = async () => {
    const values = reasoningCapability.effortValues;
    if (values.length === 0) {
      return;
    }
    let nextEnabled: boolean;
    let nextEffort: string | undefined;
    if (!thinkingEnabled) {
      nextEnabled = true;
      nextEffort = values[0];
    } else {
      const idx = reasoningEffort ? values.indexOf(reasoningEffort) : -1;
      if (idx < 0 || idx >= values.length - 1) {
        nextEnabled = false;
        nextEffort = undefined;
      } else {
        nextEnabled = true;
        nextEffort = values[idx + 1];
      }
    }
    setThinkingEnabled(nextEnabled);
    setReasoningEffort(nextEffort);
    await persistReasoning(nextEnabled, nextEffort);
  };

  // If the active pal is a video pal, show the video pal screen
  if (isVideoPal) {
    return <VideoPalScreen activePal={activePal} />;
  }

  // Otherwise, show the regular chat view
  // NOTE: B18 §17 → §18.2——SessionStatusBar 整行已删（引擎融入顶栏胶囊、指标下沉
  // 助手卡 AssistantTurnFooter 统一指标行），顶栏下无重复状态条。
  return (
    <>
      {/* B39：套件征用本页时的基准测试 HUD（非运行态 null） */}
      <BenchmarkHudBar />
      <ChatView
        headerAccessory={<ActiveTaskBanner />}
        onPhoneCallPress={handlePhoneCallPress}
        renderBubble={args => renderBubble({...args, theme})}
        renderTextMessage={(msg, w, showName) =>
          renderTextMessage(msg, w, showName, {
            onRetry: handleTaskErrorRetry,
            onGoModels: handleTaskErrorGoModels,
            onButlerUpgrade: upgradeButlerReply,
          })
        }
        messages={chatSessionStore.currentSessionMessages}
        activePal={activePal}
        onSendPress={wrappedSendPress}
        onStopPress={handleStopPress}
        user={user}
        editSourceUri={editSourceUri}
        onEditSourceChange={setEditSourceUri}
        isStopVisible={modelStore.inferencing}
        isStreaming={modelStore.isStreaming}
        sendButtonVisibilityMode="always"
        // [已裁剪·恢复点 2026-08] 图片上传入口：大王裁定不需要。
        // 恢复加号按钮只需加回 showImageUpload={true}（组件能力完整保留）。
        isVisionEnabled={visionEnabled}
        initialInputText={pendingMessage || undefined}
        onInitialTextConsumed={clearPendingMessage}
        inputProps={{
          showThinkingToggle: thinkingSupported,
          isThinkingEnabled: thinkingEnabled,
          onThinkingToggle: handleThinkingToggle,
          supportsEffort: reasoningCapability.supportsEffort,
          effortValues: reasoningCapability.effortValues,
          reasoningEffort,
          onEffortCycle: handleEffortCycle,
        }}
        textInputProps={{
          // §18.5 placeholder 单源决策表（engineStatus 状态中枢为唯一事实源）：
          // 1 chat 引擎 loading → 加载模型；2 管家 loading → 加载管家模型；
          // 3 chat 引擎 ready → 输入消息；4 管家就绪 → 小黄鸡就绪（l10n）；
          // 5 其余 → 模型未加载。五分支同源收口 l10n，无硬编码。
          placeholder:
            engineStatus.engines.chat.phase === 'loading'
              ? l10n.chat.loadingModel
              : engineStatus.engines.prompter.phase === 'loading'
                ? l10n.chat.loadingButlerModel
                : modelStore.engine
                  ? l10n.chat.typeYourMessage
                  : promptWriter.isLoaded
                    ? l10n.chat.butlerReady
                    : l10n.chat.modelNotLoaded,
        }}
      />
      {uiStore.chatWarning && (
        <ErrorSnackbar
          error={uiStore.chatWarning}
          onDismiss={() => uiStore.clearChatWarning()}
        />
      )}
      {modelStore.modelLoadError && (
        <ErrorSnackbar
          error={modelStore.modelLoadError}
          onDismiss={() => modelStore.clearModelLoadError()}
          onReport={handleReportModelError}
        />
      )}
      <ModelErrorReportSheet
        isVisible={isErrorReportVisible}
        onClose={handleCloseErrorReport}
        error={errorToReport}
      />
      {/* PHONE_SPEC §3.2：通话 overlay（挂 ChatScreen 根节点，与 useChatSession 同实例） */}
      <PhoneCallOverlay
        visible={phoneVisible}
        status={phoneStatus}
        partnerName={phonePartnerName}
        modelLabel={phoneModelLabel}
        engineReady={phoneEngineReady}
        engineLoading={phoneEngineLoading}
        elapsedSeconds={phoneElapsed}
        transcript={phoneTranscript}
        perfHistory={phonePerfHistory}
        onStartRecording={() => {
          // 新一轮开口 = 上一轮转写作废（§11.4：本轮常驻，下一轮重置）
          setPhoneTranscript('');
          // 能量通道开测（§14.2/§14.3）：真实振幅驱动波形 + VAD 观测统计
          audioLevel.begin();
          void phoneSessionRef.current?.startRecording();
        }}
        onStopRecording={() => {
          // 先收能量统计（落 logcat 供 spike 取证），再走转写主链
          audioLevel.end();
          phoneSessionRef.current?.stopAndSend();
        }}
        onHangUp={handlePhoneHangUp}
      />
    </>
  );
});
