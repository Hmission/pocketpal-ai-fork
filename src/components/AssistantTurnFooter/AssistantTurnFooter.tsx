import React, {useContext} from 'react';
import {TouchableOpacity, View} from 'react-native';

import {observer} from 'mobx-react';
import {Text} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {CopyIcon, RefreshIcon} from '../../assets/icons';
import {useTheme} from '../../hooks';
import {PlayButton} from '../TextMessage/PlayButton';
import {isSpeakableMessage} from '../../utils/speakable';

import {styles} from './styles';

import {chatSessionStore, modelStore, ttsStore} from '../../store';
import {L10nContext} from '../../utils';
import {derivedText, isFinalMessage} from '../../utils/chat';
import {MessageType} from '../../utils/types';
import {t} from '../../locales';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

interface AssistantTurnFooterProps {
  message: MessageType.Any;
  /** 重新生成（复用长按菜单同一 handleTryAgain 完整能力链）；
   *  未传则不渲染按钮 */
  onRegenerate?: () => void;
  /** 重新生成禁用（agent 运行中 / 无激活模型） */
  regenerateDisabled?: boolean;
}

/**
 * Turn-level chrome (timing + copy + regenerate + interrupt status) rendered
 * once per assistant row, below all step blocks. 插槽门控：
 *
 *   - `metadata.timings` present       → render the timing line
 *   - 内容非空且已完成              → render the copy button（不再依赖
 *     metadata.copyable：旧消息缺字段时复制按钮丢失的根因修复，
 *     与长按菜单复制无门控对齐）
 *   - `metadata.interrupted` true      → render the interrupted status
 *   - `metadata.truncationLikely` true → upgrade status to "cut off"
 *
 * Used by both AssistantTurn rows and legacy assistant Text rows.
 */
export const AssistantTurnFooter: React.FC<AssistantTurnFooterProps> = observer(
  ({message, onRegenerate, regenerateDisabled}) => {
    const theme = useTheme();
    const l10n = useContext(L10nContext);
    const {timings, interrupted, truncationLikely, completionResult} =
      message.metadata || {};

    // 复制/重新生成按钮可见性：内容非空且（已完成 或 当前非流式中）。
    // 完成度单一事实源 = isFinalMessage（PlayButton 同源）。
    const copyText =
      message.type === 'text' || message.type === 'assistant_turn'
        ? derivedText(message).trim()
        : '';
    const actionsReady =
      copyText.length > 0 &&
      (isFinalMessage(message) || !modelStore.isStreaming);

    // 朗读按钮独立决定 footer 显示：仅可朗读消息（TTS 可用 + 内容判定）
    // 无 chrome 字段时也渲染 footer，承载 PlayButton。
    const speakable = ttsStore.isTTSAvailable && isSpeakableMessage(message);
    if (
      !timings &&
      !actionsReady &&
      !interrupted &&
      !speakable
    ) {
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
        {actionsReady && (
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
        {actionsReady && onRegenerate ? (
          <TouchableOpacity
            onPress={regenerateDisabled ? undefined : onRegenerate}
            testID="footer-regenerate"
            accessibilityLabel={l10n.components.chatView.menuItems.regenerate}
            style={
              regenerateDisabled ? componentStyles.actionDisabled : undefined
            }
            hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}>
            <RefreshIcon
              stroke={theme.colors.textSecondary}
              width={16}
              height={16}
            />
          </TouchableOpacity>
        ) : null}
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
