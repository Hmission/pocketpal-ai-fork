import React, {useRef, ReactNode, useState} from 'react';
import {View} from 'react-native';

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

import {useChatSession} from '../../hooks';
import {useTheme} from '../../hooks';
import {usePendingMessage} from '../../hooks/useDeepLinking';

import {
  modelStore,
  chatSessionStore,
  palStore,
  serverStore,
  uiStore,
} from '../../store';
import {hasVideoCapability} from '../../utils/pal-capabilities';

import {L10nContext} from '../../utils';
import {resolveReasoningCapability} from '../../utils/reasoningCapability';
import {MessageType, Theme} from '../../utils/types';
import {ErrorState} from '../../utils/errors';
import {user, assistant} from '../../utils/chat';
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
import {imageGenStore} from '../../store/imageGenStore';
import {engineStatus} from '../../store/engineStatus';
import {ROUTES} from '../../utils/navigationConstants';

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
  theme,
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
  const meta = (message.metadata ?? {}) as {
    imageTask?: boolean;
    imageTaskFailed?: boolean;
    editTask?: boolean;
    editTaskFailed?: boolean;
    taskError?: unknown;
    butler?: boolean;
    userText?: string;
  };
  const imageUris = (message as {imageUris?: string[]}).imageUris;
  // 生图任务卡（imageTask）/ 编辑任务卡（editTask，P5）/ 调度错误卡（taskError）共用动作槽
  const hasTask = !!meta.imageTask || !!meta.editTask;
  const hasError = !!meta.taskError;
  // 生成中占位卡（未回写图片/失败标记）→ 内嵌生成动效（三点波浪+进度+耗时）；
  // 回写成功/失败后 → 动作条（再来一张/编辑图片/继续编辑/重试）
  const generating =
    hasTask &&
    !(meta.imageTaskFailed || meta.editTaskFailed) &&
    !(imageUris && imageUris.length > 0);
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

  // 任务卡「编辑图片」改道：pendingEditSource（原跳生图页深链）→ 聊天内下沉输入框
  React.useEffect(() => {
    if (imageGenStore.pendingEditSource) {
      const uri = imageGenStore.pendingEditSource;
      runInAction(() => {
        imageGenStore.pendingEditSource = null;
      });
      setEditSourceUri(uri);
    }
  }, [imageGenStore.pendingEditSource]);

  // 会话切换/新建时清空编辑源图（会话内临时态，防泄漏到下一会话，锋利不臃肿）
  React.useEffect(() => {
    setEditSourceUri(null);
  }, [chatSessionStore.activeSessionId]);

  const {handleSendPress, handleStopPress} = useChatSession(
    currentMessageInfo,
    user,
    assistant,
  );

  // 任务驱动调度（调度叙事，实现在 hooks/useChatScheduler）：
  // - image → 聊天内联闭环（加载引擎→出图→插入图片/错误卡片），不跳转页面
  // - write/code → chat 引擎未加载时按能力注册表自动选模型加载，再走常规聊天
  // - chitchat → chat 引擎未加载且管家就绪时，由常驻管家直接回答（启动即就绪）
  // - upgradeButlerReply → 用户主权升级（L2 2026-08-21）：管家卡片「换个更聪明的模型」
  const {wrappedSendPress, upgradeButlerReply} = useChatScheduler(handleSendPress);

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

  const [thinkingEnabled, setThinkingEnabled] = useState(true);
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
        setThinkingEnabled(settings.enable_thinking ?? true);
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
    </>
  );
});
