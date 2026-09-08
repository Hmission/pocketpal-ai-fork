import React from 'react';

import {chatSessionStore, modelStore} from '../store';
import {
  routeTask,
  TaskKind,
  isCaptionIntent,
  resolveTaskEngine,
  type TaskEngineTier,
} from '../store/taskRouter';
import {serverStore} from '../store/ServerStore';
import {testConnection} from '../api/openaiClient/connection';
import {isAnchorFresh} from '../services/aiosCore/wakeCheck';
import {emit} from '../debug/eventStream';
import {
  runImageTaskCard,
  runEditImageTaskCard,
  runCaptionTaskCard,
} from '../services/chatImageTask';
import {
  findModelForTask,
  listModelsForTask,
  candidateNote,
} from '../store/modelCapabilityRegistry';
import {getModelDisplayNameWithParams} from '../utils/modelDisplayNames';
import {engineStatus} from '../store/engineStatus';
import {promptWriter} from '../services/promptWriter';
import {extractAndSaveMemories} from '../services/aiosMemory';
import {appendConversation} from '../services/aiosMemory/conversationLog';
import {buildButlerContext} from '../services/aiosMemory/butlerContext';
import {classifyIntent} from '../services/aiosMemory/rituals';
import {awaitEngineReady} from '../utils/engineReady';
import {askModelSwitch} from '../components/ui/ModelSwitchDialog';
import {user, assistant} from '../utils/chat';
import {L10nContext} from '../utils';
import {MessageType, Model} from '../utils/types';
import {
  resolveWritingRecovery,
  setPendingWorkspaceContext,
} from '../services/workspace/recovery';

/**
 * useChatScheduler — 任务驱动调度（豆包式闭环，只判不执原则，SPEC §9.3）：
 *   image   → 聊天内联闭环（runImageTaskCard：卡片→加载→出图→回写），不跳转页面；
 *             出图后引擎驻留不卸载，「再来一张/重试」秒级复用
 *   chitchat → 管家直答（启动即就绪闭环；用户已显式加载大模型则尊重主权用当前模型）
 *   write/code → 能力注册表推荐专用模型：当前模型≠推荐时弹窗确认
 *             （[加载推荐] / [继续当前] / 会话内记住，决策可见 + 用户主权）
 *   play（P8 玩具工坊）→ 同 code 选型（玩具匠=代码模型，PLAY_SPEC §2.2）
 *   adventure（P12 城主）→ 同 write 选型（城主=写作模型，ADVENTURE_SPEC §2.3）
 * 返回 wrappedSendPress，供 ChatScreen 作为 ChatView onSendPress。
 */

/**
 * 懒切换选模（SPEC §9.3）：chitchat 直接归零——闲聊由管家直答（新语义），
 * 不自动恢复大模型；write/code 走能力注册表推荐（含 MODEL_MATRIX 默认映射）。
 */
export function pickResumeModel(task: TaskKind): Model | null {
  if (task === 'chitchat') {
    return null;
  }
  return findModelForTask(task);
}

/** 统一调度错误卡（SPEC §3.3 error 叙事：TaskErrorCard 渲染）。
 * 锋利化（2026-08-21）：title/detail 收口到渲染端按 code l10n 单点生成，
 * 本层只存 code/retryText/可选模型名（避免文案散落调度层）。 */
async function insertTaskError(
  code: 'no_model' | 'load_failed' | 'busy',
  retryText: string,
  modelName?: string,
): Promise<void> {
  await chatSessionStore.addMessageToCurrentSession({
    id: `err-${Date.now()}`,
    author: assistant,
    createdAt: Date.now(),
    text: retryText,
    type: 'text',
    metadata: {taskError: {code, retryText, modelName}},
  } as MessageType.Text);
}

/** 加载候选模型（selectModel 内部 engineMutex.acquire('chat') 自动释放互斥引擎），
 * 加载完成 + 引擎就绪双保险后才放行。失败插对应错误卡（显式失败，不静默）。 */
async function loadCandidate(
  candidate: Model,
  retryText: string,
): Promise<'proceed' | 'abort'> {
  engineStatus.setPhase('chat', 'loading', `加载 ${candidate.name}…`);
  try {
    await modelStore.selectModel(candidate);
  } catch (e) {
    console.error('[Scheduler] selectModel failed:', e);
    engineStatus.setError('chat', '对话模型加载失败');
    await insertTaskError('load_failed', retryText, candidate.name);
    return 'abort';
  }
  if (!modelStore.engine) {
    engineStatus.setError('chat', '对话模型加载失败');
    await insertTaskError('load_failed', retryText, candidate.name);
    return 'abort';
  }
  // 时差双保险之一：native context 收尾轮询等待，避免撞 busy 报错
  const ready = await awaitEngineReady();
  if (!ready) {
    engineStatus.setError('chat', '引擎忙碌，请稍后重试');
    await insertTaskError('busy', retryText);
    return 'abort';
  }
  // 加载完成，状态归隐（避免残留；模型状态由顶栏胶囊展示，B18 §16.1）
  engineStatus.setPhase('chat', 'idle');
  return 'proceed';
}

/**
 * §18.7 弹窗内加载版本：加载失败抛错（弹窗显示失败态，不插错误卡），
 * 成功静默。供 askModelSwitch 的 onLoad 钩子使用——加载期遮罩保持阻塞。
 */
async function loadCandidateForDialog(
  candidate: Model,
  _retryText: string,
): Promise<void> {
  engineStatus.setPhase('chat', 'loading', `加载 ${candidate.name}…`);
  try {
    await modelStore.selectModel(candidate);
  } catch (e) {
    console.error('[Scheduler] selectModel failed:', e);
    engineStatus.setError('chat', '对话模型加载失败');
    throw new Error((e as Error)?.message ?? '未知错误');
  }
  if (!modelStore.engine) {
    engineStatus.setError('chat', '对话模型加载失败');
    throw new Error('引擎未就绪');
  }
  const ready = await awaitEngineReady();
  if (!ready) {
    engineStatus.setError('chat', '引擎忙碌，请稍后重试');
    throw new Error('模型刚加载完仍在收尾');
  }
  engineStatus.setPhase('chat', 'idle');
}

/** 管家直答（启动即就绪闭环）：插用户消息 + 思考卡 → 管家回复回写。
 * L1 记忆读侧闭环（2026-08-21）：回复前组装 buildButlerContext 注入
 * （今日状态/记忆/召回/意图语气），并对齐会话意图状态机（D1 修复）。
 * onReplied（PHONE_SPEC §18）：管家直答不经 token 流，没有回合回调可发，
 * 因此改由**产生回复的一方**显式声明——旧写法让 ChatScreen 扫消息数组反推，
 * 构成第二判定源。必须在回写之后调，否则会拿到占位文案。 */
async function butlerReply(
  text: string,
  l10n: (typeof import('../locales'))['l10n'][keyof (typeof import('../locales'))['l10n']],
  onReplied?: (cardId: string, finalText: string) => Promise<void>,
): Promise<boolean> {
  // 意图状态机对齐：已有会话意图沿用，无则 classify + 落库（与 useChatSession 同源）
  let sessionIntent = chatSessionStore.activeSessionIntent;
  if (!sessionIntent) {
    sessionIntent = classifyIntent(text);
    await chatSessionStore.setSessionIntent(sessionIntent);
  }
  // 记忆读侧注入（fire-and-forget 组装，失败静默回退纯人设——不阻塞主链）
  const systemExtra = await buildButlerContext(text, sessionIntent);
  await chatSessionStore.addMessageToCurrentSession({
    id: `u-${Date.now()}`,
    author: user,
    createdAt: Date.now(),
    text,
    type: 'text',
  } as MessageType.Text);
  const sessionId = chatSessionStore.activeSessionId;
  if (!sessionId) {
    return false;
  }
  const butlerCardMsg = {
    id: `butler-${Date.now()}`,
    author: assistant,
    createdAt: Date.now(),
    text: l10n.chat.butlerThinking,
    type: 'text',
    // userText 落卡：butler 卡片升级入口（L2）取出重发同一问题
    metadata: {butler: true, modelName: '管家小鸡', userText: text},
  } as MessageType.Text;
  await chatSessionStore.addMessageToCurrentSession(butlerCardMsg);
  // DB 可能覆写消息 id → 插入后读回真实 id，保证后续 update 命中
  const cardId =
    chatSessionStore.currentSessionMessages[0]?.id ?? butlerCardMsg.id;
  // B41 跑分感：管家直答绕过 agent 状态机，这里手动点亮「思考中」态，
  // 让 PendingIndicator 遥测卡（内存/CPU/温度 + 迷你折线）亮起（跑分是本体）。
  chatSessionStore.setAgentUiState({
    status: 'prefill',
    pendingTalentNames: [],
    hitMaxTurns: false,
    reasoningPhase: false,
  });
  chatSessionStore.markAgentRunStarted();
  const reply = await promptWriter.chat(text, systemExtra);
  const finalText =
    reply ?? '抱歉，小黄鸡暂时没想到怎么回答。可到模型页加载更强的对话模型。';
  await chatSessionStore.updateMessage(cardId, sessionId, {
    text: finalText,
  });
  // 回合声明（PHONE_SPEC §18.3）：位置不能提前——回写未完成就声明，播报会读到占位文案。
  if (onReplied) {
    await onReplied(cardId, finalText);
  }
  // B41：管家答完，复位状态机熄灭遥测卡（与 agent run_finished 同源收尾）。
  chatSessionStore.setAgentUiState({
    status: 'done',
    pendingTalentNames: [],
    hitMaxTurns: false,
    reasoningPhase: false,
  });
  chatSessionStore.clearAgentRun();
  // AIOS 记忆（P2 真机复测 2026-08-17 修复）：管家直答绕过了 useChatSession 的
  // run_finished 钩子（提取/对话日志都挂在那里）→ 此处补接，否则管家模式记忆永不落盘。
  // G4-1：管家路径永远本地引擎，provenance 固定为 'local'（解析兜底则函数内自动覆盖）
  try {
    setTimeout(() => {
      void extractAndSaveMemories(text, finalText, {provenance: 'local'});
      void appendConversation(text, finalText);
    }, 1200);
  } catch (e) {
    console.warn('[Scheduler] butler memory hook failed:', e);
  }
  return true;
}

/**
 * 任务模型解析（write/code/play，SPEC §9.3 → §18.7 多候选）：候选列表弹窗单选，
 * 选择写入会话偏好（会话级记住，不跨会话）。
 *   'proceed' → 模型已就绪，可发送；'abort' → 用户取消/失败，不发送
 */
async function resolveTaskModel(
  task: 'write' | 'code' | 'play',
  text: string,
): Promise<'proceed' | 'abort'> {
  const candidates = listModelsForTask(task);
  const recommended = candidates[0];
  const remembered = chatSessionStore.taskModelChoice[task];
  const toDialogCandidates = () =>
    candidates.map(c => ({
      id: c.id,
      // 中文简称（选择器卡片同款单一事实源）：候选行/加载态不甩完整文件名
      name: getModelDisplayNameWithParams(c),
      size: c.size,
      // §18.7 一句话推荐说明（MODEL_MATRIX 定位 / 大小档位）
      note: candidateNote(c),
    }));

  // 场景 A：chat 引擎已加载（用户显式加载过大模型）——尊重主权
  if (modelStore.engine) {
    const current = modelStore.activeModel;
    // 零弹窗：候选空 / 当前即推荐 / 记住继续当前 / 当前即记住项
    if (!recommended || (current && current.id === recommended.id)) {
      return 'proceed';
    }
    if (remembered === '__current__') {
      return 'proceed';
    }
    if (remembered) {
      const rememberedModel = candidates.find(c => c.id === remembered);
      if (rememberedModel) {
        if (current && current.id === remembered) {
          return 'proceed';
        }
        // 会话内已显式选过的模型，直接加载不再问
        return loadCandidate(rememberedModel, text);
      }
    }
    const result = await askModelSwitch({
      task,
      candidates: toDialogCandidates(),
      canKeepCurrent: true,
      // §18.7 弹窗内加载：遮罩保持（交互阻塞），完成/失败自动关
      onLoad: async (modelId: string) => {
        const chosen = candidates.find(c => c.id === modelId) ?? recommended!;
        chatSessionStore.setTaskModelChoice(task, chosen.id);
        await loadCandidateForDialog(chosen, text);
      },
    });
    if (result.choice === 'load') {
      const chosen =
        candidates.find(c => c.id === result.modelId) ?? recommended;
      chatSessionStore.setTaskModelChoice(task, chosen.id);
      return 'proceed';
    }
    if (result.choice === 'current') {
      chatSessionStore.setTaskModelChoice(task, '__current__');
      return 'proceed';
    }
    return 'abort'; // cancel：用户放弃切换，消息不发送
  }

  // 场景 B：chat 引擎未加载——候选模型加载（弹窗确认）
  if (!recommended) {
    await insertTaskError('no_model', text);
    return 'abort';
  }
  // 记住的模型仍在候选 → 直接加载（会话内显式选择不再问）
  if (remembered && remembered !== '__current__') {
    const rememberedModel = candidates.find(c => c.id === remembered);
    if (rememberedModel) {
      return loadCandidate(rememberedModel, text);
    }
  }
  const result = await askModelSwitch({
    task,
    candidates: toDialogCandidates(),
    // 场景 B 无当前模型：不显示「继续当前」死按钮（锋利不臃肿）
    canKeepCurrent: false,
    // §18.7 弹窗内加载：遮罩保持（交互阻塞），完成/失败自动关
    onLoad: async (modelId: string) => {
      const chosen = candidates.find(c => c.id === modelId) ?? recommended;
      chatSessionStore.setTaskModelChoice(task, chosen.id);
      await loadCandidateForDialog(chosen, text);
    },
  });
  if (result.choice === 'load') {
    const chosen = candidates.find(c => c.id === result.modelId) ?? recommended;
    chatSessionStore.setTaskModelChoice(task, chosen.id);
    return 'proceed';
  }
  return 'abort'; // 无当前模型可选「继续当前」→ 取消
}

/** 义肢健康探活（v1.2 G-6 抽取）：serverStore 配置 + Keychain key + testConnection。 */
async function probeLimbHealth(model: Model): Promise<boolean> {
  const server = serverStore.servers.find(s => s.id === model.serverId);
  if (!server) {
    return false;
  }
  try {
    const apiKey = await serverStore.getApiKey(server.id);
    const probe = await testConnection(
      server.url,
      apiKey,
      server.requestTimeoutMs,
    );
    return probe.ok;
  } catch {
    return false;
  }
}

/** 显式降级告知（limb_offline 语义落 UI，CP-APP-015 同词面）：不静默本地硬扛。 */
async function insertLimbOfflineNotice(
  reason: 'offline' | 'probe_failed' = 'offline',
): Promise<void> {
  const text =
    reason === 'probe_failed'
      ? '义肢探测失败，请检查服务器 URL 和 API 密钥配置。本轮由本地代答。'
      : '义肢离线，本轮由本地代答（可稍后重试或检查电脑端服务）。';
  await chatSessionStore.addMessageToCurrentSession({
    id: `limb-${Date.now()}`,
    author: assistant,
    createdAt: Date.now(),
    text,
    type: 'text',
    metadata: {limbOfflineNotice: true, reason},
  } as MessageType.Text);
}

/**
 * 义肢终裁（v1.2 G-6）：分级函数唯一真源。
 * 资格面短路：未配义肢=配置缺席（≠故障），静默降级本地，不告知不打扰。
 * G2-3：配了义肢但无可用模型时区分两种情况：
 *   - 探活失败（URL/密钥错）→ 返回 limb_offline，调用方显示诊断告知
 *   - 探活成功但用户未选模型 → 静默 local-zero
 */
async function resolveLimbTier(
  task: TaskKind,
  text: string,
): Promise<TaskEngineTier> {
  if (modelStore.remoteModels.length === 0) {
    // 未配任何服务器：配置缺席，静默不扰
    if (serverStore.servers.length === 0) {
      return 'local-zero';
    }
    // 配了服务器但无可用模型：探一次服务器，失败则返回 limb_offline（调用方显式告知）
    const firstServer = serverStore.servers[0];
    try {
      const apiKey = await serverStore.getApiKey(firstServer.id);
      const probe = await testConnection(
        firstServer.url,
        apiKey,
        firstServer.requestTimeoutMs,
      );
      if (!probe.ok) {
        // 探活失败：URL 或密钥有误，不静默当作“没配”——返回 limb_offline 让调用方诊断告知
        return 'limb_offline';
      }
    } catch {
      return 'limb_offline';
    }
    // 探活成功但用户未选模型：静默 local-zero
    return 'local-zero';
  }
  const online = await probeLimbHealth(modelStore.remoteModels[0]);
  return resolveTaskEngine(task, text, online);
}

/**
 * 义肢主权弹窗（v1.2 G-6 纯化）：仅处理「已判 limb」的确认切换。
 *   - 已在义肢引擎 → proceed（义肢直答，不重复弹窗）
 *   - askModelSwitch('limb')：load→义肢已加载 proceed；current→本地 proceed；cancel→abort
 */
async function maybeRouteLimb(): Promise<'proceed' | 'pass' | 'abort'> {
  const recommended = modelStore.remoteModels[0];
  const current = modelStore.activeModel;
  if (
    current &&
    current.origin === 'remote' &&
    current.serverId === recommended.serverId
  ) {
    return 'proceed';
  }
  const result = await askModelSwitch({
    task: 'limb',
    candidates: modelStore.remoteModels.map(m => ({
      id: m.id,
      name: getModelDisplayNameWithParams(m),
      size: m.size,
    })),
    canKeepCurrent: true,
    onLoad: async (modelId: string) => {
      const chosen =
        modelStore.remoteModels.find(r => r.id === modelId) ?? recommended;
      await modelStore.setRemoteModel(chosen);
    },
  });
  if (result.choice === 'load' || result.choice === 'current') {
    return 'proceed';
  }
  return 'abort';
}

export const useChatScheduler = (
  handleSendPress: (message: MessageType.PartialText) => void | Promise<void>,
  onButlerReplied?: (cardId: string, finalText: string) => Promise<void>,
) => {
  const l10n = React.useContext(L10nContext);

  /** L2 用户主权升级（2026-08-21）：butler 卡片「换个更聪明的模型」点按 →
   * chat 任务族选型加载 → 成功自动重发同一问题（大模型路径，记忆/工具链完整）。
   * 失败复用错误卡显式引导；引擎驻留不卸载（防抖动，后续闲聊直达大模型）。 */
  const upgradeButlerReply = React.useCallback(
    async (userText: string) => {
      const candidate = findModelForTask('chat');
      if (!candidate) {
        await insertTaskError('no_model', userText);
        return;
      }
      const decision = await loadCandidate(candidate, userText);
      if (decision === 'abort') {
        return;
      }
      // 自动重发：用户点升级的意图就是「要更好的回答」，重发是意图的自然延续
      await handleSendPress({text: userText} as MessageType.PartialText);
    },
    [handleSendPress],
  );

  const wrappedSendPress = React.useCallback(
    async (message: MessageType.PartialText, editSourceUri?: string | null) => {
      const text = message.text.trim();

      // 编辑闭环（P5 豆包式）：显式编辑源图（图片编辑按钮/全屏查看器/任务卡下沉）
      // + 文本指令 → 聊天内编辑任务卡，零跳转。编辑意图=显式按钮动作，不走关键词路由；
      // 空指令已由 ChatInput 拦截（轻提示补描述）；预填前缀「图片编辑：」在此剥离（指令纯净）。
      if (editSourceUri) {
        const instruction = text.replace(/^图片编辑[:：]\s*/, '') || text;
        await chatSessionStore.addMessageToCurrentSession({
          id: `u-${Date.now()}`,
          author: user,
          createdAt: Date.now(),
          text,
          type: 'text',
          imageUris: [editSourceUri],
        } as MessageType.Text);
        if (!chatSessionStore.activeSessionId) {
          return;
        }
        await runEditImageTaskCard(editSourceUri, instruction);
        return;
      }

      // 反推闭环（创作工坊 v4，IMAGEGEN_UI_SPEC §7.1）：图片消息 + 反推意图词。
      // 路由专工：isCaptionIntent 仅在图片上下文生效（taskRouter 注释），
      // 与生图页反推同源能力（同一 runCaptionTask 任务化入画廊）。
      if (message.imageUris?.length && isCaptionIntent(text)) {
        await chatSessionStore.addMessageToCurrentSession({
          id: `u-${Date.now()}`,
          author: user,
          createdAt: Date.now(),
          text,
          type: 'text',
          imageUris: message.imageUris,
        } as MessageType.Text);
        if (!chatSessionStore.activeSessionId) {
          return;
        }
        await runCaptionTaskCard(message.imageUris[0], text);
        return;
      }

      const signal = routeTask(text);
      console.info(
        `[Scheduler] task=${signal.task} engine=${modelStore.engine ? 'chat' : 'none'} butler=${promptWriter.isLoaded ? 'ready' : 'off'}`,
      );

      if (signal.task === 'image') {
        // 门禁软检查（v1.2 G-4）：会话锚过期仅打点不卡读（照 gate-guard 软提醒语义）
        if (!(await isAnchorFresh())) {
          emit('app', 'gate.stale', {task: 'image'});
        }
        // 1. 记录用户消息（无会话时自动建会话）
        await chatSessionStore.addMessageToCurrentSession({
          id: `u-${Date.now()}`,
          author: user,
          createdAt: Date.now(),
          text,
          type: 'text',
        } as MessageType.Text);
        if (!chatSessionStore.activeSessionId) {
          return;
        }
        // 2. 卡片闭环（插卡→加载→出图→回写；驻留引擎时秒级出图）
        await runImageTaskCard(signal.payload);
        return;
      }

      // Wave E（AIOS_CORE_SPEC v1.2 G-6）：义肢双策略——分级函数唯一真源。
      // ① 意图短路：非深度意图零探活开销；② 资格面短路：未配义肢=配置缺席（≠故障），静默本地代答不打扰；
      // ③ 已配义肢：探活后交分级函数终裁（limb=弹窗主权 / limb_offline=显式告知 / local=本地链路）。
      let limbTier: TaskEngineTier = 'local-zero';
      if (resolveTaskEngine(signal.task, text, true) === 'limb') {
        limbTier = await resolveLimbTier(signal.task, text);
        if (limbTier === 'limb') {
          const limbDecision = await maybeRouteLimb();
          if (limbDecision === 'abort') {
            return;
          }
        } else if (limbTier === 'limb_offline') {
          // G2-3 区分原因：无远程模型时返回 limb_offline = 探活失败；有模型 = 义肢临时离线
          await insertLimbOfflineNotice(
            modelStore.remoteModels.length === 0 ? 'probe_failed' : 'offline',
          );
        }
      }

      // chitchat：chat 引擎未加载 → 管家直答（启动即就绪闭环，SPEC §9.3）。
      // 删除旧「从未有过聊天模型」补丁条件——闲聊永远优先管家（快、省内存）；
      // 用户已显式加载大模型（chat 引擎在）则尊重主权走常规发送（下方兜底）。
      if (signal.task === 'chitchat' && !modelStore.engine) {
        if (!promptWriter.isLoaded) {
          // 管家未就绪：懒加载一次（启动即就绪补全）；仍失败 → 错误卡引导
          const ok = await promptWriter.ensureLoaded();
          if (!ok) {
            await insertTaskError('no_model', text);
            return;
          }
        }
        await butlerReply(text, l10n, onButlerReplied);
        return;
      }

      // write/code：任务模型解析（弹窗确认 + 会话级记住）
      // play（P8 玩具工坊）：同构——玩具匠=代码模型选型，弹窗文案区分「玩具」任务
      // adventure（P12 城主）：同构——城主=写作模型选型，弹窗文案沿用「写作」
      if (
        (signal.task === 'write' ||
          signal.task === 'code' ||
          signal.task === 'play' ||
          signal.task === 'adventure') &&
        // 深度意图已由义肢决策接管（limb），不再弹任务模型选型（单决策点不双弹窗）
        limbTier !== 'limb'
      ) {
        // WORKSPACE_SPEC（2026-08-21）：写作恢复链路——「继续写 X」命中项目 →
        // 读框架文档注入下次组装（setPendingWorkspaceContext 单次消费）；
        // 未命中静默放行（模型可自主 init，不新增兜底）。
        if (signal.task === 'write') {
          try {
            const recovery = await resolveWritingRecovery(text);
            if (recovery) {
              setPendingWorkspaceContext(recovery);
            }
          } catch (e) {
            console.warn('[Scheduler] writing recovery failed:', e);
          }
        }
        const decision = await resolveTaskModel(
          signal.task === 'adventure' ? 'write' : signal.task,
          text,
        );
        if (decision === 'abort') {
          return;
        }
        handleSendPress(message);
        return;
      }

      // 兜底（chitchat 且 chat 引擎已加载——用户显式加载了大模型）：尊重主权直接发送
      handleSendPress(message);
    },
    [handleSendPress, l10n, onButlerReplied],
  );

  return {wrappedSendPress, upgradeButlerReply};
};
