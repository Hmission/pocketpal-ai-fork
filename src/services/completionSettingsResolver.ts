/**
 * completionSettingsResolver — ChatSession 完成参数解析纯函数（R3-P1-B）
 *
 * 自 ChatSessionStore 原样迁出的五层优先级链（行为零变化）：
 * System Defaults → Global User Settings → Pal-Specific Settings（含
 * PACT tools 注入）→ 无会话 thinking override → Session-Specific Settings
 * （仅显式 custom）。palStore 依赖作为参数注入保持纯函数可测面；
 * ChatSessionStore 保留同名薄委托（外部 API 零变化）。
 */
import type {CompletionParams} from '../utils/completionTypes';
import {defaultCompletionParams} from '../utils/completionSettingsVersions';
import {deriveToolSchemas} from './talents';
import type {Pal} from '../types/pal';
import type {SessionMetaData} from '../store/ChatSessionStore';

/** PalStore 最小注入面（pals 列表 + AIOS 兜底查询） */
export interface PalStoreLike {
  pals: Pal[];
  getAiosPal: () => Pal | undefined;
}

/** resolveCompletionSettings 注入面（原 store 字段逐一对应） */
export interface CompletionSettingsResolverDeps {
  globalSettings: CompletionParams;
  sessions: SessionMetaData[];
  palStore: PalStoreLike;
  thinkingOverride: boolean | undefined;
  reasoningEffort: string | undefined;
}

// System defaults（与 ChatSessionStore 模块级等值；service 自持避免
// store→service→store 运行时环，构造逻辑剪切原样保留）
const defaultCompletionSettings = {...defaultCompletionParams};
delete defaultCompletionSettings.prompt;
delete defaultCompletionSettings.stop;

/**
 * Resolves completion settings according to the precedence hierarchy:
 * System Defaults → Global User Settings → Pal-Specific Settings → Session-Specific Settings (only if explicitly modified)
 */
export async function resolveCompletionSettings(
  deps: CompletionSettingsResolverDeps,
  sessionId?: string,
  palId?: string,
): Promise<CompletionParams> {
  // Start with system defaults
  let resolvedSettings: CompletionParams = {...defaultCompletionSettings};

  // Apply global user settings
  resolvedSettings = {
    ...resolvedSettings,
    ...deps.globalSettings,
  };

  // Apply pal-specific settings if available
  if (palId) {
    // Use in-memory pal store as the source of truth (avoids cache invalidation issues)
    const pal = deps.palStore.pals.find(p => p.id === palId);
    const palSettings = pal?.completionSettings;

    if (palSettings) {
      resolvedSettings = {
        ...resolvedSettings,
        ...palSettings,
      };
    }

    // Inject tool schemas from pact.talents (PACT → completionSettings.tools)
    const talentNames = pal?.pact?.talents?.map(t => t.name);
    if (talentNames && talentNames.length > 0) {
      const tools = deriveToolSchemas(talentNames);
      if (tools.length > 0) {
        resolvedSettings = {
          ...resolvedSettings,
          tools,
        };
      }
    }
  }

  // No-session-only: apply user's explicit thinking override last so it
  // wins over pal's enable_thinking. Overlays the local enable_thinking flag
  // AND the reasoning carrier (so the remote wire path honors the on/off
  // intent for the first message of the new chat, not just local thinking).
  // Does NOT touch any other field, and does NOT affect tool availability.
  if (!sessionId && deps.thinkingOverride !== undefined) {
    resolvedSettings = {
      ...resolvedSettings,
      enable_thinking: deps.thinkingOverride,
      reasoning: {
        ...resolvedSettings.reasoning,
        enabled: deps.thinkingOverride,
        effort: deps.reasoningEffort,
      },
    };
  }

  // Apply session-specific settings based on explicit user choice
  if (sessionId) {
    const session = deps.sessions.find(s => s.id === sessionId);

    if (session?.settingsSource === 'custom') {
      // User explicitly chose custom settings - use session settings.
      // Preserve PACT-derived tools — custom settings control generation
      // params (temperature, etc.) but pact.talents is the source of truth
      // for tool availability.
      const pactTools = resolvedSettings.tools;
      resolvedSettings = session.completionSettings;
      if (pactTools) {
        resolvedSettings = {...resolvedSettings, tools: pactTools};
      }
    }
  }

  return resolvedSettings;
}

/**
 * Gets the effective completion settings for the current context
 */
export async function getCurrentCompletionSettings(
  deps: CompletionSettingsResolverDeps & {
    activeSessionId: string | null;
    newChatPalId: string | undefined;
  },
): Promise<CompletionParams> {
  const activePalId = deps.activeSessionId
    ? deps.sessions.find(s => s.id === deps.activeSessionId)?.activePalId
    : deps.newChatPalId;

  return resolveCompletionSettings(
    {
      globalSettings: deps.globalSettings,
      sessions: deps.sessions,
      palStore: deps.palStore,
      thinkingOverride: deps.thinkingOverride,
      reasoningEffort: deps.reasoningEffort,
    },
    deps.activeSessionId || undefined,
    // 无显式 Pal 时兜底 AIOS 女妖——与 useChatSession 系统提示词兜底对仗：
    // pact.talents 是工具可用性的唯一事实源，否则灵魂注入了、手被砍了，
    // play/adventure 等工具任务静默退化为纯聊天（2026-08-19 K90 真机实证）。
    activePalId ?? deps.palStore.getAiosPal()?.id,
  );
}
