import React, {useContext} from 'react';

import {observer} from 'mobx-react';

import {BannerBar} from '../ui/BannerBar';

import {AlertIcon} from '../../assets/icons';
import {useTheme} from '../../hooks/useTheme';
import {chatSessionStore, modelStore} from '../../store';
import {L10nContext} from '../../utils';
import {MessageType, ModelOrigin} from '../../utils/types';
import {resolveBannerVariant} from '../../utils/bannerVariantResolver';
import {talentRegistry} from '../../services/talents';
import {t} from '../../locales';

interface BannerRowProps {
  messages: MessageType.Any[];
  htmlPreviewCount: number;
  // True when at least one larger context tier fits the device. Gates the
  // increase CTA's visibility (the sheet owns the actual target).
  canIncrease: boolean;
  onIncreaseContext: () => void;
  // B19 上下文治理：压缩旧消息 CTA（本地模型专属，远程见 context-remote-hedged
  // 分支不显示）。点击即显式选择「压缩」并记住策略（setContextPolicy）。
  onCompactContext: () => void;
  onNewChat: () => void;
}

// Heavy-talent name for the full-banner sub-copy: the newest assistant turn's
// first tool call whose engine declares a recommended context. Declarative
// only — never moves the banner trigger.
function deriveHeavyTalentName(
  messages: MessageType.Any[],
): string | undefined {
  const latestTurn = messages.find(m => m.type === 'assistant_turn') as
    | MessageType.AssistantTurn
    | undefined;
  for (const step of latestTurn?.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      const name = call.function?.name;
      if (name && talentRegistry.get(name)?.recommendedContextTokens != null) {
        return name;
      }
    }
  }
  return undefined;
}

/**
 * The single chat-input banner slot. Renders the one variant resolved from the
 * completion snapshot and current model state, or the existing HTML soft-cap
 * sub-case. Dismiss writes back to the store; recovery CTAs are handled by the
 * host. 渲染底座 ui/BannerBar（DESIGN_SPEC §12.3 横幅唯一底座）。
 */
export const BannerRow: React.FC<BannerRowProps> = observer(
  ({
    messages,
    htmlPreviewCount,
    canIncrease,
    onIncreaseContext,
    onCompactContext,
    onNewChat,
  }) => {
    const theme = useTheme();
    const l10n = useContext(L10nContext);

    const error = theme.colors.error;
    const isRemote = modelStore.activeModel?.origin === ModelOrigin.REMOTE;

    const effectiveNCtx = modelStore.activeModelCaps.effectiveContextLength;

    const {variant, heavyTalentName, ratio} = resolveBannerVariant(
      chatSessionStore.lastCompletionResult,
      {
        effectiveNCtx,
        isRemote,
        htmlPreviewCount,
        activeModelId: modelStore.activeModelId,
        dismissed: chatSessionStore.dismissedBannerVariants,
        heavyTalentName: deriveHeavyTalentName(messages),
      },
    );

    if (variant === 'none') {
      return null;
    }

    if (variant === 'html-soft-cap') {
      return (
        // 2026-08-26 去灰：neutral → info 语义 wash + 居中（纯文案无动作）
        <BannerBar
          testID="soft-cap-warning"
          variant="info"
          centered
          text={l10n.chat.softCapWarning}
        />
      );
    }

    if (variant === 'context-warning') {
      const progress = ratio != null ? ratio * 100 : undefined;
      return (
        <BannerBar
          testID="context-warning-banner"
          variant="warning"
          icon={<AlertIcon width={14} height={14} stroke={error} />}
          text={l10n.chat.contextWarning}
          progress={progress}
          percent={progress}
          actions={[
            ...(!isRemote
              ? [
                  {
                    label: l10n.chat.contextCompact,
                    onPress: onCompactContext,
                    testID: 'context-warning-compact',
                  },
                ]
              : []),
            ...(canIncrease
              ? [
                  {
                    label: l10n.chat.contextMoreRoom,
                    onPress: onIncreaseContext,
                    testID: 'context-warning-increase',
                  },
                ]
              : []),
            {
              label: l10n.chat.contextBannerDismiss,
              onPress: () =>
                chatSessionStore.setBannerDismissed('context-warning'),
              testID: 'context-banner-dismiss',
            },
          ]}
        />
      );
    }

    if (variant === 'context-remote-hedged') {
      return (
        <BannerBar
          testID="context-remote-hedged-banner"
          variant="info"
          centered
          text={l10n.chat.contextRemoteHedged}
          actions={[
            {
              label: l10n.chat.contextBannerDismiss,
              onPress: () =>
                chatSessionStore.setBannerDismissed('context-remote-hedged'),
              testID: 'context-banner-dismiss',
            },
          ]}
        />
      );
    }

    // context-full (dismissable per draft).
    const talentNames = l10n.components.palSheet.talentNames;
    const heavyTalentLabel = heavyTalentName
      ? (talentNames[heavyTalentName as keyof typeof talentNames] ??
        heavyTalentName)
      : undefined;
    // Remote wins over every local variant: the escalated and heavy-talent
    // copies both carry the "increase the context size" advice, but a remote
    // model has no in-app context control, so remote always gets the single
    // remote copy (no increase clause) regardless of failure count / talent.
    const fullText = isRemote
      ? l10n.chat.contextFullRemote
      : heavyTalentLabel
        ? t(l10n.chat.contextFullHeavyTalent, {talent: heavyTalentLabel})
        : chatSessionStore.consecutiveFullFailures >= 2
          ? l10n.chat.contextFullEscalated
          : l10n.chat.contextFull;

    const progress = ratio != null ? ratio * 100 : undefined;
    return (
      <BannerBar
        testID="context-full-banner"
        variant="error"
        icon={<AlertIcon width={14} height={14} stroke={error} />}
        text={fullText}
        progress={progress}
        actions={[
          ...(!isRemote
            ? [
                {
                  label: l10n.chat.contextCompact,
                  onPress: onCompactContext,
                  testID: 'context-full-compact',
                },
              ]
            : []),
          ...(canIncrease
            ? [
                {
                  label: l10n.chat.contextMoreRoom,
                  onPress: onIncreaseContext,
                  testID: 'context-full-increase',
                },
              ]
            : []),
          {
            label: l10n.chat.contextNewChat,
            onPress: onNewChat,
            testID: 'context-full-new-chat',
          },
          {
            label: l10n.chat.contextBannerDismiss,
            onPress: () => chatSessionStore.setBannerDismissed('context-full'),
            testID: 'context-banner-dismiss',
          },
        ]}
      />
    );
  },
);
