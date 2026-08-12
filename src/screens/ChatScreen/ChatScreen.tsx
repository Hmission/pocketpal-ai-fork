import React, {useRef, ReactNode, useState} from 'react';

import {observer} from 'mobx-react';
import {runInAction} from 'mobx';

import {
  Bubble,
  ChatView,
  ErrorSnackbar,
  ModelErrorReportSheet,
} from '../../components';
import {PalSheet} from '../../components/PalsSheets';

import {useChatSession} from '../../hooks';
import {usePendingMessage} from '../../hooks/useDeepLinking';
import {Pal} from '../../types/pal';

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
import {MessageType} from '../../utils/types';
import {ErrorState} from '../../utils/errors';
import {user, assistant} from '../../utils/chat';
import {chatSessionStore as chatStoreForImg} from '../../store';
import {routeTask} from '../../store/taskRouter';
import {runInlineImageTask} from '../../services/chatImageTask';
import {ActiveTaskBanner} from '../../components/ActiveTaskBanner/ActiveTaskBanner';
import {findModelForTask} from '../../store/modelCapabilityRegistry';
import {engineStatus} from '../../store/engineStatus';
import {promptWriter} from '../../services/promptWriter';

import {VideoPalScreen} from './VideoPalScreen';

const renderBubble = ({
  child,
  message,
  nextMessageInGroup,
  scale,
}: {
  child: ReactNode;
  message: MessageType.Any;
  nextMessageInGroup: boolean;
  scale?: any;
}) => (
  <Bubble
    child={child}
    message={message}
    nextMessageInGroup={nextMessageInGroup}
    scale={scale}
  />
);

export const ChatScreen: React.FC = observer(() => {
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

  // State for pal sheet
  const [isPalSheetVisible, setIsPalSheetVisible] = useState(false);

  // State for model error report sheet
  const [isErrorReportVisible, setIsErrorReportVisible] = useState(false);
  const [errorToReport, setErrorToReport] = useState<ErrorState | null>(null);

  const {handleSendPress, handleStopPress} = useChatSession(
    currentMessageInfo,
    user,
    assistant,
  );

  // 任务驱动调度（调度叙事）：
  // - image → 聊天内联闭环（加载引擎→出图→插入图片/错误卡片），不跳转页面
  // - write/code → chat 引擎未加载时按能力注册表自动选模型加载，再走常规聊天
  // - chitchat → chat 引擎未加载且管家就绪时，由常驻管家直接回答（启动即就绪）
  const wrappedSendPress = React.useCallback(
    async (message: MessageType.PartialText) => {
      const text = message.text.trim();
      const signal = routeTask(text);
      console.info(
        `[Scheduler] task=${signal.task} engine=${modelStore.engine ? 'chat' : 'none'} butler=${promptWriter.isLoaded ? 'ready' : 'off'}`,
      );

      if (signal.task === 'image') {
        // 1. 记录用户消息（无会话时自动建会话）
        await chatStoreForImg.addMessageToCurrentSession({
          id: `u-${Date.now()}`,
          author: user,
          createdAt: Date.now(),
          text,
          type: 'text',
        } as MessageType.Text);
        const sessionId = chatStoreForImg.activeSessionId;
        if (!sessionId) {
          return;
        }

        // 2. 任务卡片占位（实时进度由 ActiveTaskBanner 展示）
        const imgCardMsg = {
          id: `imgtask-${Date.now()}`,
          author: assistant,
          createdAt: Date.now(),
          text: `🎨 正在准备生成「${signal.payload}」…`,
          type: 'text',
          metadata: {imageTask: true},
        } as MessageType.Text;
        await chatStoreForImg.addMessageToCurrentSession(imgCardMsg);
        // DB 可能覆写消息 id → 插入后读回真实 id，保证后续 update 命中
        const cardId =
          chatStoreForImg.currentSessionMessages[0]?.id ?? imgCardMsg.id;

        // 3. 内联执行：加载引擎（如需）→ 出图
        const result = await runInlineImageTask(signal.payload);
        if (result.uri) {
          await chatStoreForImg.updateMessage(cardId, sessionId, {
            text: `🎨 已为你生成：${signal.payload}`,
            imageUris: [result.uri],
          });
        } else {
          await chatStoreForImg.updateMessage(cardId, sessionId, {
            text: `⚠️ 生图未完成：${result.error ?? '未知错误'}`,
          });
        }
        return;
      }

      // write/code：chat 引擎未加载 → 按能力注册表自动选模型加载（任务驱动）
      if (
        (signal.task === 'write' || signal.task === 'code') &&
        !modelStore.engine
      ) {
        const candidate = findModelForTask(signal.task);
        if (!candidate) {
          await chatStoreForImg.addMessageToCurrentSession({
            id: `sys-${Date.now()}`,
            author: assistant,
            createdAt: Date.now(),
            text: '⚠️ 写作/代码任务需要更强的对话模型，但未找到可用模型。请先到模型页下载。',
            type: 'text',
            metadata: {system: true},
          } as MessageType.Text);
          return;
        }
        engineStatus.setPhase('chat', 'loading', `加载 ${candidate.name}…`);
        await modelStore.selectModel(candidate);
        if (!modelStore.engine) {
          engineStatus.setError('chat', '对话模型加载失败');
          await chatStoreForImg.addMessageToCurrentSession({
            id: `sys-${Date.now()}`,
            author: assistant,
            createdAt: Date.now(),
            text: `⚠️ 模型「${candidate.name}」加载失败，可到模型页排查。`,
            type: 'text',
            metadata: {system: true},
          } as MessageType.Text);
          return;
        }
        // 加载完成，状态归隐（避免残留；模型状态由 SessionStatusBar 既有区展示）
        engineStatus.setPhase('chat', 'idle');
      }

      // chitchat：chat 引擎未加载且管家就绪 → 常驻管家直接回答（启动即就绪闭环）
      if (
        signal.task === 'chitchat' &&
        !modelStore.engine &&
        promptWriter.isLoaded
      ) {
        await chatStoreForImg.addMessageToCurrentSession({
          id: `u-${Date.now()}`,
          author: user,
          createdAt: Date.now(),
          text,
          type: 'text',
        } as MessageType.Text);
        const sessionId = chatStoreForImg.activeSessionId;
        if (!sessionId) {
          return;
        }
        const butlerCardMsg = {
          id: `butler-${Date.now()}`,
          author: assistant,
          createdAt: Date.now(),
          text: '🐦 八哥思考中…',
          type: 'text',
          metadata: {butler: true},
        } as MessageType.Text;
        await chatStoreForImg.addMessageToCurrentSession(butlerCardMsg);
        // DB 可能覆写消息 id → 插入后读回真实 id，保证后续 update 命中
        const cardId =
          chatStoreForImg.currentSessionMessages[0]?.id ?? butlerCardMsg.id;
        const reply = await promptWriter.chat(text);
        await chatStoreForImg.updateMessage(cardId, sessionId, {
          text:
            reply ?? '抱歉，八哥暂时没想到怎么回答。可到模型页加载更强的对话模型。',
        });
        return;
      }

      handleSendPress(message);
    },
    [handleSendPress],
  );

  // Handle deep linking for message prefill
  const {pendingMessage, clearPendingMessage} = usePendingMessage();

  // Callback handler for opening pal sheet
  const handleOpenPalSheet = React.useCallback((_pal: Pal) => {
    setIsPalSheetVisible(true);
  }, []);

  const handleClosePalSheet = React.useCallback(() => {
    setIsPalSheetVisible(false);
  }, []);

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
  // NOTE: SessionStatusBar is rendered inside ChatHeader (once). Adding
  // another instance here caused it to render twice — a duplicate status
  // strip overlapping the system status bar area on Android.
  return (
    <>
      <ChatView
        headerAccessory={<ActiveTaskBanner />}
        renderBubble={renderBubble}
        messages={chatSessionStore.currentSessionMessages}
        activePal={activePal}
        onSendPress={wrappedSendPress}
        onStopPress={handleStopPress}
        onPalSettingsSelect={handleOpenPalSheet}
        user={user}
        isStopVisible={modelStore.inferencing}
        isStreaming={modelStore.isStreaming}
        sendButtonVisibilityMode="always"
        showImageUpload={true}
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
          placeholder: !modelStore.engine
            ? modelStore.isContextLoading
              ? l10n.chat.loadingModel
              : promptWriter.isLoaded
                ? '口袋八哥已就绪，输入即可聊天'
                : l10n.chat.modelNotLoaded
            : l10n.chat.typeYourMessage,
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
      {activePal && (
        <PalSheet
          isVisible={isPalSheetVisible}
          onClose={handleClosePalSheet}
          pal={activePal}
        />
      )}
    </>
  );
});
