import * as React from 'react';
import {Pressable, Text, View, Animated} from 'react-native';

import {oneOf} from '@flyerhq/react-native-link-preview';
import {observer} from 'mobx-react';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {useTheme} from '../../hooks';

import styles, {turnBlockStyles} from './styles';
import {
  AssistantTurnFooter,
  TurnMetricsRow,
  Avatar,
  StatusIcon,
  FileMessage,
  ImageMessage,
  ReasoningBlock,
  TalentSurface,
  TextMessage,
  TextMessageTopLevelProps,
} from '..';

import {MessageType} from '../../utils/types';
import {excludeDerivedMessageProps, UserContext} from '../../utils';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export interface MessageTopLevelProps extends TextMessageTopLevelProps {
  /**
   * True if THIS row is the active agent run. Computed once at the
   * ChatView level (last message AND `agentUiState.status` is in the
   * active set) and threaded through. Used by the AssistantTurn
   * renderer to drive per-talent pending UI.
   */
  isActiveRun?: boolean;
  /**
   * Active-run pending talent names (from `agentUiState.pendingTalentNames`).
   * Only consulted when `isActiveRun` is true.
   */
  activeRunPendingTalentNames?: string[];
  /**
   * True if the active run is currently in `generating_tool_call`
   * status. Used by TalentSurface as a final fallback for the generic
   * "preparing tool" copy.
   */
  isGeneratingToolCall?: boolean;
  /** Called when user makes a long press on any message */
  onMessageLongPress?: (message: MessageType.Any, event?: any) => void;
  /** Called when user taps on any message */
  onMessagePress?: (message: MessageType.Any, event?: any) => void;
  /** 重新生成（footer 按钮，复用长按菜单 handleTryAgain 完整能力链） */
  onRegenerate?: (message: MessageType.Any) => void;
  /** 重新生成禁用（agent 运行中 / 无激活模型） */
  regenerateDisabled?: boolean;
  /** Customize the default bubble using this function. `child` is a content
   * you should render inside your bubble, `message` is a current message
   * (contains `author` inside) and `nextMessageInGroup` allows you to see
   * if the message is a part of a group (messages are grouped when written
   * in quick succession by the same author) */
  renderBubble?: (payload: {
    child: React.ReactNode;
    message: MessageType.Any;
    nextMessageInGroup: boolean;
    scale?: Animated.Value;
  }) => React.ReactNode;
  /** Render a custom message inside predefined bubble */
  renderCustomMessage?: (
    message: MessageType.Custom,
    messageWidth: number,
  ) => React.ReactNode;
  /** Render a file message inside predefined bubble */
  renderFileMessage?: (
    message: MessageType.File,
    messageWidth: number,
  ) => React.ReactNode;
  /** Render an image message inside predefined bubble */
  renderImageMessage?: (
    message: MessageType.Image,
    messageWidth: number,
  ) => React.ReactNode;
  /** Render a text message inside predefined bubble */
  renderTextMessage?: (
    message: MessageType.Text,
    messageWidth: number,
    showName: boolean,
  ) => React.ReactNode;
  /** Show user avatars for received messages. Useful for a group chat. */
  showUserAvatars?: boolean;
}

export interface MessageProps extends MessageTopLevelProps {
  enableAnimation?: boolean;
  message: MessageType.DerivedAny;
  messageWidth: number;
  roundBorder: boolean;
  showAvatar: boolean;
  showName: boolean;
  showStatus: boolean;
}

/** Base component for all message types in the chat. Sets maximum width
 * for a nice look on larger screens.
 *
 * `observer` is required (not `React.memo`): per-token streaming mutates
 * `turn.steps[lastIdx]` to a new object while the AssistantTurn message
 * reference stays stable, so a shallow-prop memo would skip every token
 * update. `observer` also provides shallow-prop comparison. */
export const Message = observer(
  ({
    enableAnimation,
    // isActiveRun / activeRunPendingTalentNames / isGeneratingToolCall
    // are kept on MessageTopLevelProps for ChatView's prop API but not
    // consumed here — pending UX is owned by ChatView's PendingIndicator
    // and TalentSurface dispatches off persisted step data alone.
    message,
    messageWidth,
    onMessagePress,
    onMessageLongPress,
    onPreviewDataFetched,
    onRegenerate,
    regenerateDisabled,
    renderBubble,
    renderCustomMessage,
    renderFileMessage,
    renderImageMessage,
    renderTextMessage,
    roundBorder,
    showAvatar,
    showName,
    showStatus,
    showUserAvatars,
    usePreviewData,
  }: MessageProps) => {
    const user = React.useContext(UserContext);
    const theme = useTheme();
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const currentUserIsAuthor =
      message.type !== 'dateHeader' && user?.id === message.author.id;

    const {container, contentContainer, dateHeader, pressable} = styles({
      currentUserIsAuthor,
      message,
      messageWidth,
      roundBorder,
      theme,
    });

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 1.01,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    };

    if (message.type === 'dateHeader') {
      return (
        <View style={dateHeader}>
          <Text
            style={[
              theme.fonts.dateDividerTextStyle,
              {color: theme.colors.onSurface},
            ]}>
            {message.text}
          </Text>
        </View>
      );
    }

    const renderBubbleContainer = (withFooter: boolean) => {
      // 气泡一体化（DESIGN_SPEC §4c.1 / ADR-0003）：footer（朗读/复制/timing）
      // 作为 child 的一部分收进气泡卡片内（同底色），不再悬浮在卡片下方。
      const child = withFooter ? (
        <>
          {renderMessage()}
          {showAssistantFooter ? (
            <>
              <AssistantTurnFooter
                message={message}
                onRegenerate={
                  onRegenerate ? () => onRegenerate(message) : undefined
                }
                regenerateDisabled={regenerateDisabled}
              />
              {/* B18 §17：每输出指标行（footer 下一行，快照驱动） */}
              <TurnMetricsRow message={message} />
            </>
          ) : null}
        </>
      ) : (
        renderMessage()
      );

      return oneOf(
        renderBubble,
        <View style={contentContainer} testID="ContentContainer">
          {child}
        </View>,
      )({
        child,
        message: excludeDerivedMessageProps(message),
        nextMessageInGroup: roundBorder,
        scale: scaleAnim,
      });
    };

    const renderMessage = () => {
      switch (message.type) {
        case 'custom':
          return (
            renderCustomMessage?.(
              // It's okay to cast here since we checked message type above
              // type-coverage:ignore-next-line
              excludeDerivedMessageProps(message) as MessageType.Custom,
              messageWidth,
            ) ?? null
          );
        case 'file':
          return oneOf(renderFileMessage, <FileMessage message={message} />)(
            // type-coverage:ignore-next-line
            excludeDerivedMessageProps(message) as MessageType.File,
            messageWidth,
          );
        case 'image':
          return oneOf(
            renderImageMessage,
            <ImageMessage
              {...{
                message,
                messageWidth,
              }}
            />,
          )(
            // type-coverage:ignore-next-line
            excludeDerivedMessageProps(message) as MessageType.Image,
            messageWidth,
          );
        case 'text':
          return oneOf(
            renderTextMessage,
            <TextMessage
              {...{
                enableAnimation,
                message,
                messageWidth,
                onPreviewDataFetched,
                showName,
                usePreviewData,
              }}
            />,
          )(
            // type-coverage:ignore-next-line
            excludeDerivedMessageProps(message) as MessageType.Text,
            messageWidth,
            showName,
          );
        default:
          return null;
      }
    };

    /**
     * AssistantTurn renderer (Option B): emit N visual blocks within
     * ONE FlatList row. For each step, render a text bubble fragment
     * (only when content is present) followed by a TalentSurface
     * fragment (only when toolCalls are present). The row remains a
     * single Pressable so long-press routing stays turn-level
     * regardless of which inner block was pressed.
     */
    const renderAssistantTurn = () => {
      const turn = message as MessageType.DerivedAssistantTurn;
      const steps = turn.steps ?? [];
      const blocks: React.ReactNode[] = [];
      // `isFirstBlock` drives the inter-block spacer (no top margin on
      // the first block). `nameShown` tracks whether the author header
      // has already been rendered — reasoning blocks never render the
      // header (they're metadata, not chat posts), so the showName
      // slot passes through to the first content/talent block.
      let isFirstBlock = true;
      let nameShown = false;

      // Wraps a single TextMessage step fragment in the chat-bubble
      // shell (contentContainer / renderBubble) plus the turn-block
      // spacer. Used for content blocks only — reasoning has its own
      // wrapper via `wrapReasoningBlock` because it's not a bubble.
      const wrapTextBlock = (
        keySuffix: string,
        stepFragment: (typeof steps)[number],
        withFooter = false,
      ) => {
        const showNameForBlock = showName && !nameShown;
        // 气泡一体化：仅最后一个内容块承载 turn 级 footer（收进卡片内）
        const child = (
          <>
            <TextMessage
              enableAnimation={enableAnimation}
              message={turn}
              messageWidth={messageWidth}
              onPreviewDataFetched={onPreviewDataFetched}
              showName={showNameForBlock}
              usePreviewData={usePreviewData}
              step={stepFragment}
            />
            {withFooter && showAssistantFooter ? (
              <>
                <AssistantTurnFooter
                  message={message}
                  onRegenerate={
                    onRegenerate ? () => onRegenerate(message) : undefined
                  }
                  regenerateDisabled={regenerateDisabled}
                />
                {/* B18 §17：每输出指标行（footer 下一行，快照驱动） */}
                <TurnMetricsRow message={message} />
              </>
            ) : null}
          </>
        );
        const wrapped = oneOf(
          renderBubble,
          <View
            style={[
              contentContainer,
              !isFirstBlock && turnBlockStyles.blockSpacer,
            ]}
            testID="ContentContainer">
            {child}
          </View>,
        )({
          child,
          message: excludeDerivedMessageProps(message),
          nextMessageInGroup: roundBorder,
          scale: scaleAnim,
        });
        if (showNameForBlock) {
          nameShown = true;
        }
        return (
          <View
            key={keySuffix}
            style={!isFirstBlock ? turnBlockStyles.blockSpacer : undefined}>
            {wrapped}
          </View>
        );
      };

      // Reasoning is metadata, not a chat bubble — it skips the
      // contentContainer / renderBubble shell entirely, so the
      // collapsed text-only row (and partial card) sit directly on
      // the chat surface with no bubble background or insets fighting
      // them. The author header is intentionally not shown here:
      // it belongs to the first true content block.
      const wrapReasoningBlock = (
        keySuffix: string,
        text: string,
        autoCollapse: boolean,
      ) => (
        <View
          key={keySuffix}
          style={!isFirstBlock ? turnBlockStyles.blockSpacer : undefined}
          testID="ContentContainer-reasoning">
          <ReasoningBlock
            text={text}
            maxWidth={messageWidth}
            autoCollapse={autoCollapse}
          />
        </View>
      );

      // 最后一个有内容的 step 承载 turn 级 footer（气泡一体化）
      let lastContentStepIdx = -1;
      steps.forEach((step, stepIdx) => {
        if (step.content !== undefined && step.content.length > 0) {
          lastContentStepIdx = stepIdx;
        }
      });

      steps.forEach((step, stepIdx) => {
        // Reasoning and content render as separate blocks, reasoning
        // first (matches model emission order). Each block is skipped
        // when its source field is empty so a step with content-only or
        // reasoning-only renders exactly one block (no phantom layout).
        const hasReasoning =
          step.reasoningContent !== undefined &&
          step.reasoningContent.length > 0;
        const hasContent =
          step.content !== undefined && step.content.length > 0;

        if (hasReasoning) {
          // Auto-collapse the reasoning bubble once content has begun
          // streaming or the step has finalized. While only reasoning
          // is streaming, the bubble stays expanded so the user sees
          // thoughts live.
          const autoCollapseReasoning = hasContent || step.partial === false;
          blocks.push(
            wrapReasoningBlock(
              `step-${stepIdx}-reasoning`,
              step.reasoningContent as string,
              autoCollapseReasoning,
            ),
          );
          isFirstBlock = false;
        }

        if (hasContent) {
          blocks.push(
            wrapTextBlock(
              `step-${stepIdx}-text`,
              step,
              stepIdx === lastContentStepIdx,
            ),
          );
          isFirstBlock = false;
        }

        // Talent surface — outside the bubble, with its own visual
        // container (e.g. HtmlPreviewBubble). Renders one block per call
        // in step.toolCalls (in array order). The ChatView-owned
        // PendingIndicator covers the in-flight window before outcomes
        // land — no per-call pending UI here.
        if (step.toolCalls && step.toolCalls.length > 0) {
          blocks.push(
            <View
              key={`step-${stepIdx}-talent`}
              style={!isFirstBlock ? turnBlockStyles.blockSpacer : undefined}>
              <TalentSurface step={step} />
            </View>,
          );
          isFirstBlock = false;
        }
      });

      return blocks;
    };

    // AssistantTurn renders N visual blocks within one FlatList row.
    // The single Pressable + Avatar + StatusIcon wrapping is preserved
    // so long-press stays turn-level and the avatar shows once per turn.
    // 气泡一体化（ADR-0003）：AssistantTurnFooter 已收进最后一个内容块的
    // 气泡卡片内（renderAssistantTurn/wrapTextBlock），不再在行级外部渲染；
    // 用户消息与图片/文件消息不渲染 footer。
    const showAssistantFooter =
      !currentUserIsAuthor &&
      (message.type === 'assistant_turn' || message.type === 'text');
    // HtmlPreviewBubble's WebView has no intrinsic width. Force the
    // wrapper to `messageWidth` so it has a budget to stretch into;
    // text-only siblings still wrap to their natural width via
    // MarkdownView's own `maxWidth` cap.
    const innerContent =
      message.type === 'assistant_turn' ? (
        <View style={{width: messageWidth}}>{renderAssistantTurn()}</View>
      ) : (
        renderBubbleContainer(message.type === 'text')
      );

    return (
      <View style={container}>
        <Avatar
          {...{
            author: message.author,
            currentUserIsAuthor,
            showAvatar,
            showUserAvatars,
            theme,
          }}
        />
        <Pressable
          onLongPress={event => {
            ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
            onMessageLongPress?.(excludeDerivedMessageProps(message), event);
          }}
          onPress={event => {
            onMessagePress?.(excludeDerivedMessageProps(message), event);
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={pressable}>
          {innerContent}
        </Pressable>
        <StatusIcon
          {...{
            currentUserIsAuthor,
            showStatus,
            status: message.status,
            theme,
          }}
        />
      </View>
    );
  },
);
