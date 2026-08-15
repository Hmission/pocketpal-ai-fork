import React, {useContext} from 'react';
import {TouchableOpacity, View} from 'react-native';

import {observer} from 'mobx-react';
import {Text} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {CopyIcon} from '../../assets/icons';
import {useTheme} from '../../hooks';
import {PlayButton} from '../TextMessage/PlayButton';
import {isSpeakableMessage} from '../../utils/speakable';

import {styles} from './styles';

import {chatSessionStore, ttsStore} from '../../store';
import {L10nContext} from '../../utils';
import {derivedText} from '../../utils/chat';
import {MessageType} from '../../utils/types';
import {t} from '../../locales';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

interface AssistantTurnFooterProps {
  message: MessageType.Any;
}

/**
 * Turn-level chrome (timing + copy + interrupt status) rendered once per
 * assistant row, below all step blocks. Each slot is gated only by field
 * presence:
 *
 *   - `metadata.timings` present       → render the timing line
 *   - `metadata.copyable` true         → render the copy button
 *   - `metadata.interrupted` true      → render the interrupted status
 *   - `metadata.truncationLikely` true → upgrade status to "cut off"
 *
 * On a turn aborted mid-stream with partial content, `copyable` is true
 * but `timings` is absent — the footer renders the copy button alone.
 * Used by both AssistantTurn rows and legacy assistant Text rows.
 */
export const AssistantTurnFooter: React.FC<AssistantTurnFooterProps> = observer(
  ({message}) => {
    const theme = useTheme();
    const l10n = useContext(L10nContext);
    const {copyable, timings, interrupted, truncationLikely, completionResult} =
      message.metadata || {};

    // 朗读按钮独立决定 footer 显示：仅可朗读消息（TTS 可用 + 内容判定）
    // 无 chrome 字段时也渲染 footer，承载 PlayButton。
    const speakable = ttsStore.isTTSAvailable && isSpeakableMessage(message);
    if (!timings && !copyable && !interrupted && !speakable) {
      return null;
    }

    // The sticky context-full banner is the single stronger surface for the
    // newest turn, so the footer drops its "cut off" wording on that turn and
    // shows plain interrupted status instead. Only the turn that drives the
    // banner is suppressed (its snapshot is the store's live one).
    const suppressTruncated =
      truncationLikely === true &&
      completionResult != null &&
      completionResult === chatSessionStore.lastCompletionResult &&
      chatSessionStore.lastCompletionResult?.contextFull === true;

    const componentStyles = styles({theme});

    // Build timing parts: {value, suffix} 拆分数字与标签，数字用品牌色强调
    const timingParts: Array<{value: string; suffix: string}> = [];
    const pushTiming = (tplKey: string, value: string) => {
      const full = t(tplKey, {value});
      timingParts.push({value, suffix: full.replace(value, '')});
    };
    if (timings?.predicted_per_token_ms != null) {
      pushTiming(
        l10n.components.bubble.msPerToken,
        timings.predicted_per_token_ms.toFixed(),
      );
    }
    if (timings?.predicted_per_second != null) {
      pushTiming(
        l10n.components.bubble.tokensPerSec,
        timings.predicted_per_second.toFixed(2),
      );
    }
    if (timings?.time_to_first_token_ms != null) {
      pushTiming(
        l10n.components.bubble.ttft,
        String(timings.time_to_first_token_ms),
      );
    }

    const copyToClipboard = () => {
      if (message.type !== 'text' && message.type !== 'assistant_turn') {
        return;
      }
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      Clipboard.setString(derivedText(message).trim());
    };

    return (
      <View style={componentStyles.container} testID="assistant-turn-footer">
        <PlayButton message={message} />
        {copyable && (
          <TouchableOpacity
            onPress={copyToClipboard}
            testID="footer-copy"
            accessibilityLabel={l10n.components.chatView.menuItems.copy}
            hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}>
            <CopyIcon
              stroke={theme.colors.textSecondary}
              width={16}
              height={16}
            />
          </TouchableOpacity>
        )}
        {timings && timingParts.length > 0 ? (
          <Text style={componentStyles.timing} testID="footer-timing">
            {timingParts.map((part, i) => (
              <Text key={i}>
                {/* 数字用品牌色强调，标签用辅助灰（文本/数字颜色区分） */}
                <Text style={componentStyles.timingValue}>{part.value}</Text>
                <Text style={componentStyles.timingSuffix}>{part.suffix}</Text>
                {i < timingParts.length - 1 ? ', ' : ''}
              </Text>
            ))}
          </Text>
        ) : null}
        {interrupted ? (
          <Text
            style={componentStyles.interruptedStatus}
            testID="footer-interrupted-status">
            {truncationLikely && !suppressTruncated
              ? l10n.components.bubble.truncated
              : l10n.components.bubble.interrupted}
          </Text>
        ) : null}
      </View>
    );
  },
);
