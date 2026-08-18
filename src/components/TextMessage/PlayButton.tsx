import React, {useContext} from 'react';
import {Pressable} from 'react-native';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {modelStore, ttsStore} from '../../store';
import {L10nContext} from '../../utils';
import {derivedText, isFinalMessage} from '../../utils/chat';
import {isSpeakableMessage} from '../../utils/speakable';
import {PlayIcon, StopIcon} from '../../assets/icons';
import type {MessageType} from '../../utils/types';

interface PlayButtonProps {
  message: MessageType.Any;
}

/**
 * Per-message replay button. Self-gates: returns null when TTS is
 * unavailable, message is not assistant text, still streaming, etc.
 *
 * Designed to sit in the Bubble footer row alongside copy/timings.
 */
export const PlayButton: React.FC<PlayButtonProps> = observer(({message}) => {
  const theme = useTheme();
  const l10n = useContext(L10nContext);

  if (!ttsStore.isTTSAvailable) {
    return null;
  }

  // 可朗读性单一事实源（speakable.ts）：type/author/imageTask/词数
  if (!isSpeakableMessage(message)) {
    return null;
  }

  const speakableText = derivedText(message);

  // 完成度单一事实源（utils/chat.isFinalMessage）：legacy text 看
  // completionResult，assistant_turn 看无 partial step。流式进行中
  // 且未完成时隐藏（两种类型同一门控）。
  if (!isFinalMessage(message) && modelStore.isStreaming) {
    return null;
  }

  const playbackState = ttsStore.playbackState;
  const isThisPlaying =
    (playbackState.mode === 'playing' || playbackState.mode === 'streaming') &&
    playbackState.messageId === message.id;

  const handlePress = () => {
    if (isThisPlaying) {
      ttsStore.stop().catch(() => {});
      return;
    }
    if (ttsStore.currentVoice == null) {
      ttsStore.openSetupSheet();
      return;
    }
    const hadReasoning =
      message.type === 'text'
        ? !!message.metadata?.completionResult?.reasoning_content?.trim()
        : (message.steps ?? []).some(s => s.reasoningContent?.trim());
    ttsStore.play(message.id, speakableText, {hadReasoning}).catch(() => {});
  };

  const iconSize = 16;

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        isThisPlaying
          ? l10n.voiceAndSpeech.stopMessageLabel
          : l10n.voiceAndSpeech.playMessageLabel
      }
      testID={`playbutton-${message.id}`}>
      {isThisPlaying ? (
        <StopIcon
          width={iconSize}
          height={iconSize}
          stroke={theme.colors.textSecondary}
        />
      ) : (
        <PlayIcon
          width={iconSize}
          height={iconSize}
          stroke={theme.colors.textSecondary}
        />
      )}
    </Pressable>
  );
});
