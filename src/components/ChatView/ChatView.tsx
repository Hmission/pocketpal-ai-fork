import * as React from 'react';
import {
  FlatList,
  FlatListProps,
  InteractionManager,
  LayoutAnimation,
  Platform,
  StatusBar,
  StatusBarProps,
  View,
  TouchableOpacity,
  Text,
  Keyboard,
} from 'react-native';

import dayjs from 'dayjs';
import {observer} from 'mobx-react';
import {toJS} from 'mobx';
import calendar from 'dayjs/plugin/calendar';
import {Snackbar} from 'react-native-paper';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useAnimatedScrollHandler,
  useDerivedValue,
} from 'react-native-reanimated';

import {useComponentSize} from '../KeyboardAccessoryView/hooks';

import {useTheme} from '../../hooks/useTheme';
import {useMessageActions} from '../../hooks/useMessageActions';
import {usePrevious} from '../../hooks/usePrevious';
import {usePalLoadHint} from '../../hooks/usePalLoadHint';

import ImageView from './ImageView';
import {BannerRow} from './BannerRow';
import {CompactedBlock} from './CompactedBlock';
import {createStyles} from './styles';

import {IncreaseContextSheet} from '../IncreaseContextSheet';
import {hasModelUpgradeFitting} from '../IncreaseContextSheet/fitStatus';
import {t} from '../../locales';

import {chatSessionStore, modelStore, ttsStore} from '../../store';
import {compactSessionAndMark} from '../../services/contextCompaction';

import {MessageType, User} from '../../utils/types';
import {Pal} from '../../types/pal';
import {
  calculateChatMessages,
  unwrap,
  UserContext,
  L10nContext,
} from '../../utils';
import {hasVideoCapability} from '../../utils/pal-capabilities';
import {derivedText, isFinalMessage} from '../../utils/chat';
import {isSpeakableMessage} from '../../utils/speakable';

import {
  Message,
  MessageTopLevelProps,
  CircularActivityIndicator,
  ChatInput,
  ChatInputAdditionalProps,
  ChatInputTopLevelProps,
  Menu,
  PendingIndicator,
  ChatPalModelPickerSheet,
  ChatHeader,
  ChatEmptyPlaceholder,
  VideoPalEmptyPlaceholder,
  ContentReportSheet,
  GreetingBubble,
  SuggestedPromptsRow,
} from '..';
import {
  AlertIcon,
  CopyIcon,
  EditIcon,
  GridIcon,
  PencilLineIcon,
  PlayIcon,
  RefreshIcon,
  TrashIcon,
} from '../../assets/icons';
import {
  getModelDisplayName,
  isChatSelectable,
} from '../../utils/modelDisplayNames';
import {confirmDialog} from '../ui/ConfirmDialog';

type MenuItem = {
  label: string;
  onPress?: () => void;
  icon?: () => React.ReactNode;
  disabled: boolean;
  submenu?: SubMenuItem[];
};

type SubMenuItem = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  width?: number;
};

// Untestable
/* istanbul ignore next */
const animate = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

dayjs.extend(calendar);

export type ChatTopLevelProps = ChatInputTopLevelProps & MessageTopLevelProps;

export interface ChatProps extends ChatTopLevelProps {
  /** If {@link ChatProps.dateFormat} and/or {@link ChatProps.timeFormat} is not enough to
   * customize date headers in your case, use this to return an arbitrary
   * string based on a `dateTime` of a particular message. Can be helpful to
   * return "Today" if `dateTime` is today. IMPORTANT: this will replace
   * all default date headers, so you must handle all cases yourself, like
   * for example today, yesterday and before. Or you can just return the same
   * date header for any message. */
  customDateHeaderText?: (dateTime: number) => string;
  /** Custom content to display between the header and chat list */
  customContent?: React.ReactNode;
  /** Allows you to customize the date format. IMPORTANT: only for the date,
   * do not return time here. @see {@link ChatProps.timeFormat} to customize the time format.
   * @see {@link ChatProps.customDateHeaderText} for more customization. */
  dateFormat?: string;
  /** Disable automatic image preview on tap. */
  disableImageGallery?: boolean;
  /** 标题栏下方的附加内容插槽（如引擎任务横幅）。
   * 顶部避让职责仍归 ChatHeader，插槽内容不做 insets 处理。 */
  headerAccessory?: React.ReactNode;
  /** Allows you to change what the user sees when there are no messages.
   * `emptyChatPlaceholder` and `emptyChatPlaceholderTextStyle` are ignored
   * in this case. */
  emptyState?: () => React.ReactNode;
  /** Use this to enable `LayoutAnimation`. Experimental on Android (same as React Native). */
  enableAnimation?: boolean;
  flatListProps?: Partial<FlatListProps<MessageType.DerivedAny[]>>;
  inputProps?: ChatInputAdditionalProps;
  /** Used for pagination (infinite scroll) together with {@link ChatProps.onEndReached}.
   * When true, indicates that there are no more pages to load and
   * pagination will not be triggered. */
  isLastPage?: boolean;
  /** Indicates if the AI is currently streaming tokens. Used by the
   * FlatList's `maintainVisibleContentPosition` to keep the latest
   * tokens in view while the stream lands. Pending UX is derived
   * inside ChatView from `chatSessionStore.agentUiState.status`. */
  isStreaming?: boolean;
  messages: MessageType.Any[];
  /** Used for pagination (infinite scroll). Called when user scrolls
   * to the very end of the list (minus `onEndReachedThreshold`).
   * See {@link ChatProps.flatListProps} to set it up. */
  onEndReached?: () => Promise<void>;
  /** The currently active pal */
  activePal?: Pal;
  /** Show user names for received messages. Useful for a group chat. Will be
   * shown only on text messages. */
  showUserNames?: boolean;
  /** Whether to show date headers between messages. Defaults to true. */
  showDateHeaders?: boolean;
  /** Whether to show the image upload button in the chat input */
  showImageUpload?: boolean;
  /** Whether to enable vision mode for the chat input */
  isVisionEnabled?: boolean;
  /** Initial text to prefill the input (e.g., from deep linking) */
  initialInputText?: string;
  /** Callback when initial text is consumed */
  onInitialTextConsumed?: () => void;
  /**
   * Allows you to customize the time format. IMPORTANT: only for the time,
   * do not return date here. @see {@link ChatProps.dateFormat} to customize the date format.
   * @see {@link ChatProps.customDateHeaderText} for more customization.
   */
  timeFormat?: string;
  user: User;
}

/**
 * Thin observer wrapper around PendingIndicator so the per-token
 * count + label updates only re-render this small subtree (and not
 * the entire FlatList header), keeping the dot animations alive and
 * the elapsed-seconds timer ticking. Without this isolation, MobX
 * re-renders ChatView on each token, the `renderListHeaderComponent`
 * useCallback would change reference (because it'd carry the count in
 * its deps), and FlatList would unmount + remount the header every
 * ~50ms — killing both Animated.loop and setInterval.
 */
const PendingIndicatorView: React.FC = observer(() => (
  <PendingIndicator
    pendingTalentNames={chatSessionStore.agentUiState.pendingTalentNames}
    toolCallTokenCount={chatSessionStore.toolCallTokenCount}
    isStopping={chatSessionStore.isStopping}
    // 生成进度监控卡（§18.9）：阶段标签 + 总耗时 + 心跳 + 思考流
    agentStatus={chatSessionStore.agentUiState.status}
    runStartedAt={chatSessionStore.agentRunStartedAt}
    lastAgentEventAt={chatSessionStore.lastAgentEventAt}
    // B57：思考期/回复期语义（跑分卡不再持有思考流正文）
    reasoningPhase={chatSessionStore.agentUiState.reasoningPhase}
  />
));

/** Entry component, represents the complete chat */
export const ChatView = observer(
  ({
    customContent,
    customDateHeaderText,
    dateFormat,
    disableImageGallery,
    enableAnimation,
    flatListProps,
    inputProps,
    isLastPage,
    isStopVisible,
    isStreaming = false,
    messages,
    onEndReached,
    onMessageLongPress: externalOnMessageLongPress,
    onMessagePress,
    activePal,
    onPreviewDataFetched,
    onSendPress,
    onStopPress,
    headerAccessory,
    renderBubble,
    renderCustomMessage,
    renderFileMessage,
    renderImageMessage,
    renderTextMessage,
    sendButtonVisibilityMode = 'editing',
    showUserAvatars = false,
    showUserNames = false,
    showDateHeaders = false,
    showImageUpload = false,
    isVisionEnabled = false,
    initialInputText,
    onInitialTextConsumed,
    textInputProps,
    timeFormat,
    usePreviewData = true,
    user,
    editSourceUri,
    onEditSourceChange,
  }: ChatProps) => {
    // ============ THEME & LOCALIZATION ============
    const l10n = React.useContext(L10nContext);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles({theme, insets});
    const isFocused = useIsFocused();

    // ============ REFS ============
    const animationRef = React.useRef(false);
    const list = React.useRef<FlatList<MessageType.DerivedAny>>(null);
    // 编辑源图（P5）：ref 避免 wrappedOnSendPress 重绑定，发送时读最新值
    const editSourceUriRef = React.useRef<string | null>(editSourceUri ?? null);
    editSourceUriRef.current = editSourceUri ?? null;

    // ============ COMPONENT STATE ============
    // Input state
    const [inputText, setInputText] = React.useState('');
    const inputTextRef = React.useRef(inputText);
    inputTextRef.current = inputText;
    const [inputImages, setInputImages] = React.useState<string[]>([]);
    const [isPickerVisible, setIsPickerVisible] = React.useState(false);
    const [_selectedModel, setSelectedModel] = React.useState<string | null>(
      null,
    );

    // Image viewer state
    const [isImageViewVisible, setIsImageViewVisible] = React.useState(false);
    const [imageViewIndex, setImageViewIndex] = React.useState(0);
    const [stackEntry, setStackEntry] = React.useState<StatusBarProps>({});

    // Context menu state
    const [menuVisible, setMenuVisible] = React.useState(false);
    const [menuPosition, setMenuPosition] = React.useState({x: 0, y: 0});
    const [selectedMessage, setSelectedMessage] =
      React.useState<MessageType.Any | null>(null);
    const [isReportSheetVisible, setIsReportSheetVisible] =
      React.useState(false);

    // Pagination state
    const [isNextPageLoading, setNextPageLoading] = React.useState(false);

    // Increase-context sheet visibility. The sheet owns the chosen target.
    const [increaseSheetOpen, setIncreaseSheetOpen] = React.useState(false);

    const activeModel = modelStore.activeModel;
    const projectionModel = modelStore.models.find(
      m => m.id === modelStore.activeProjectionModelId,
    );
    // §18.6 单一事实源：读每模型覆盖（与 sheet confirm 写入同一存储），
    // 不再读 activeContextSettings（实时快照会滑过用户刚确认的档）
    const currentNCtx = activeModel
      ? modelStore.getModelNCtx(activeModel.id)
      : undefined;
    const memoryCeiling = Math.max(
      modelStore.largestSuccessfulLoad ?? 0,
      modelStore.availableMemoryCeiling ?? 0,
    );

    // The increase CTA is shown only when at least one larger context tier
    // fits the device — same OOM-safe intent the sheet enforces per stop.
    // Memoized: hasModelUpgradeFitting walks the tier ladder calling the GGUF
    // memory estimator per stop (single source with the hook budget decision),
    // and ChatView re-renders on every streamed token. Non-n_ctx
    // contextInitParams (devices/cache) change rarely and self-heal on the
    // next ceiling/n_ctx update, so they're left out of deps.
    const canIncreaseContext = React.useMemo(() => {
      if (!activeModel || currentNCtx === undefined) {
        return false;
      }
      return hasModelUpgradeFitting(
        activeModel,
        projectionModel,
        currentNCtx,
        modelStore.contextInitParams,
        memoryCeiling,
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeModel?.id, projectionModel?.id, currentNCtx, memoryCeiling]);
    // Reload-feedback snackbar: indefinite while reloading, timed on result.
    const [reloadSnackbar, setReloadSnackbar] = React.useState<{
      message: string;
      indefinite: boolean;
    } | null>(null);

    // B19 手动压缩 CTA：banner「压缩上下文」——显式选择并记住策略（compact），
    // 立即执行压缩（与发送前自动路径同一服务 compactSessionAndMark，单事实源）。
    // 压缩结果由锚点卡片与 compaction snackbar 可见；失败静默（走既有 banner）。
    const handleCompactContext = React.useCallback(() => {
      const modelId = modelStore.activeModelId;
      if (modelId) {
        modelStore.setContextPolicy(modelId, 'compact');
      }
      const sessionId = chatSessionStore.activeSessionId;
      if (!sessionId) {
        return;
      }
      void compactSessionAndMark(
        sessionId,
        toJS(chatSessionStore.currentSessionMessages),
      );
    }, []);

    // B19 压缩即时提示：lastCompaction 变化（本次会话）→ 短暂 snackbar。
    const [compactionSnackbar, setCompactionSnackbar] = React.useState<
      string | null
    >(null);
    const prevCompaction = usePrevious(chatSessionStore.lastCompaction);
    React.useEffect(() => {
      const last = chatSessionStore.lastCompaction;
      if (
        last &&
        prevCompaction !== last &&
        last.sessionId === chatSessionStore.activeSessionId
      ) {
        setCompactionSnackbar(
          t(l10n.chat.compactionBanner, {count: last.count}),
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- MobX observer 使 lastCompaction 响应式
    }, [chatSessionStore.lastCompaction]);

    // The snackbar stays mounted across the reloading→result transition, so
    // Paper's auto-hide timer never re-arms for the timed result. Own the
    // result dismissal here.
    React.useEffect(() => {
      if (!reloadSnackbar || reloadSnackbar.indefinite) {
        return;
      }
      const timer = setTimeout(() => setReloadSnackbar(null), 4000);
      return () => clearTimeout(timer);
    }, [reloadSnackbar]);

    // One-shot pal-load hint snackbar (separate surface from the banner).
    const palLoadHint = usePalLoadHint({activePal, isFocused});

    // ============ COMPONENT SIZE TRACKING ============
    const {onLayout, size} = useComponentSize();
    const {onLayout: onLayoutChatInput, size: chatInputHeight} =
      useComponentSize();

    const bottomComponentHeight = React.useMemo(() => {
      const height = chatInputHeight.height;
      return height;
    }, [chatInputHeight.height]);

    // ============ INITIAL INPUT TEXT HANDLING ============
    // Handle initial input text from deep linking
    React.useEffect(() => {
      if (initialInputText && initialInputText.trim()) {
        setInputText(initialInputText);
        onInitialTextConsumed?.();
      }
    }, [initialInputText, onInitialTextConsumed]);

    // ============ DRAFT AUTOSAVE ============
    // Save draft on session switch, restore draft for new session
    const prevSessionId = usePrevious(chatSessionStore.activeSessionId);
    React.useEffect(() => {
      const NEW_CHAT_DRAFT_KEY = '__new_chat__';
      const prevKey = prevSessionId ?? NEW_CHAT_DRAFT_KEY;
      const newKey = chatSessionStore.activeSessionId ?? NEW_CHAT_DRAFT_KEY;

      // Save draft for the session we're leaving
      if (prevKey !== newKey) {
        chatSessionStore.saveDraft(prevKey, inputTextRef.current);
      }

      // Restore draft for the session we're entering
      const draft = chatSessionStore.getDraft(newKey);
      setInputText(draft);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- MobX observer makes activeSessionId reactive
    }, [chatSessionStore.activeSessionId]);

    // ============ ACTIVE PAL MODEL INITIALIZATION ============
    // Initialize model context when active pal changes.
    // Gate: while the e2e benchmark runner owns the native context lifecycle,
    // this auto-load must NOT fire — otherwise it shadows the matrix's per-cell
    // devices/n_gpu_layers via initContext's "already loaded → skip" path.
    React.useEffect(() => {
      if (modelStore.benchmarkActive) {
        return;
      }
      if (activePal) {
        if (!modelStore.activeModel && activePal.defaultModel) {
          const palDefaultModel = modelStore.availableModels.find(
            m => m.id === activePal.defaultModel?.id,
          );

          if (palDefaultModel) {
            // Initialize the model context
            modelStore.selectModel(palDefaultModel);
          }
        }
      }
    }, [activePal]);

    // ============ KEYBOARD ANIMATION SETUP ============
    // Get real-time keyboard height from the keyboard controller
    const keyboard = useReanimatedKeyboardAnimation();

    // One reconciled "keyboard occlusion above the input" value. The library
    // reports a negative `keyboard.height` while the keyboard is up; the IME
    // inset already spans the navigation bar (KeyboardProvider is configured
    // navigationBarTranslucent), so the space the keyboard actually steals from
    // the chat surface is the IME inset minus the safe-area bottom inset. One
    // expression, correct on every API level — there is no version fork (the
    // API ≤ 29 under-reservation is handled by the clamp, not a branch). The
    // input translate, the suggested-prompts overlay, and the inverted-list
    // bottom spacer all derive from THIS value so they never disagree.
    const keyboardOcclusion = useDerivedValue(() =>
      Math.max(0, Math.abs(keyboard.height.value) - insets.bottom),
    );

    // Shared value to track if keyboard is visible (height > 0)
    const isKeyboardVisible = useSharedValue(false);

    // Animated style for input container padding
    // Apply bottom padding (safe area inset) only when keyboard is NOT visible
    const inputContainerAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{translateY: -keyboardOcclusion.value}],
      paddingBottom: isKeyboardVisible.value ? 0 : insets.bottom,
    }));

    // Suggested-prompts overlay shares the input's keyboard translation but
    // must NOT inherit paddingBottom (which the input uses to clear the
    // home indicator). Applying it here would create a large empty gap
    // between the chips and the input when the keyboard is closed.
    const suggestedPromptsAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{translateY: -keyboardOcclusion.value}],
    }));

    // ============ SCROLL TRACKING & SCROLL-TO-BOTTOM ============
    // Shared values for tracking scroll position and content overflow
    const underflow = useSharedValue(true);
    const atLatest = useSharedValue(true);

    const STICK = 24;
    const LEAVE = 40;
    const EPS = 1;

    // Scroll tracking with Reanimated to determine if user is at bottom
    const handleScroll = useAnimatedScrollHandler({
      onScroll: e => {
        const y = e.contentOffset.y;
        const Hc = e.contentSize?.height ?? 0; // content height
        const Hv = e.layoutMeasurement?.height ?? 0; // viewport height
        const maxY = Math.max(0, Hc - Hv);

        // underflow: content can't actually scroll (flexGrow:1 makes Hc≈Hv)
        underflow.value = Hc <= Hv + EPS;

        // clamp to kill rubber-band noise
        const clampedY = Math.min(Math.max(y, 0), maxY);

        if (underflow.value) {
          atLatest.value = true;
          return;
        }
        if (atLatest.value) {
          if (clampedY > LEAVE) atLatest.value = false;
        } else {
          if (clampedY < STICK) atLatest.value = true;
        }
      },
    });

    // Derived value to determine if there's hidden content (user scrolled away from bottom)
    const hasHiddenContent = useDerivedValue(() => {
      return !underflow.value && !atLatest.value ? 1 : 0;
    });

    // Animated style for scroll-to-bottom button visibility
    const scrollToBottomAnimatedStyle = useAnimatedStyle(() => ({
      opacity: withTiming(hasHiddenContent.value, {duration: 160}),
      transform: [{translateY: withTiming(hasHiddenContent.value ? 0 : 8)}],
    }));

    // Scroll to bottom handler
    const scrollToBottom = React.useCallback(() => {
      list.current?.scrollToOffset({
        animated: true,
        offset: 0,
      });
    }, []);

    // ============ MESSAGE PROCESSING & CALCULATIONS ============
    // Calculate chat messages with date headers and user names
    const {chatMessages, gallery} = calculateChatMessages(messages, user, {
      customDateHeaderText,
      dateFormat,
      showUserNames,
      timeFormat,
      showDateHeaders,
    });

    const previousChatMessages = usePrevious(chatMessages);

    // ============ MESSAGE INPUT HANDLERS ============
    const wrappedOnSendPress = React.useCallback(
      async (message: MessageType.PartialText) => {
        if (chatSessionStore.isEditMode) {
          await chatSessionStore.commitEdit();
        }
        const editUri = editSourceUriRef.current;
        if (editUri) {
          // P5 编辑发送：编辑源图交接给 scheduler（第二参数），发送后清空下沉态
          onSendPress(message, editUri);
          onEditSourceChange?.(null);
        } else {
          onSendPress(message);
        }
        setInputText('');
        if (chatSessionStore.activeSessionId) {
          chatSessionStore.clearDraft(chatSessionStore.activeSessionId);
        }
        Keyboard.dismiss();
      },
      [onSendPress, onEditSourceChange],
    );

    const handleCancelEdit = React.useCallback(() => {
      setInputText('');
      setInputImages([]);
      chatSessionStore.exitEditMode();
    }, []);

    const {handleCopy, handleEdit, handleTryAgain, handleTryAgainWith} =
      useMessageActions({
        user,
        messages,
        handleSendPress: wrappedOnSendPress,
        setInputText,
        setInputImages,
      });

    // ============ AUTO-SCROLL ON NEW USER MESSAGE ============
    // Scroll to bottom when user sends a new message
    React.useEffect(() => {
      if (
        chatMessages[0]?.type !== 'dateHeader' &&
        chatMessages[0]?.id !== previousChatMessages?.[0]?.id &&
        chatMessages[0]?.author?.id === user.id
      ) {
        list.current?.scrollToOffset({
          animated: true,
          offset: 0,
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatMessages]);

    // ============ LAYOUT ANIMATION SETUP ============
    // Untestable
    /* istanbul ignore next */
    if (animationRef.current && enableAnimation) {
      InteractionManager.runAfterInteractions(animate);
    }

    React.useEffect(() => {
      // Untestable
      /* istanbul ignore next */
      if (animationRef.current && enableAnimation) {
        InteractionManager.runAfterInteractions(animate);
      } else {
        animationRef.current = true;
      }
    }, [enableAnimation, messages]);

    // ============ PAGINATION HANDLER ============
    const handleEndReached = React.useCallback(
      // Ignoring because `scroll` event for some reason doesn't trigger even basic
      // `onEndReached`, impossible to test.
      // TODO: Verify again later
      /* istanbul ignore next */
      async ({distanceFromEnd}: {distanceFromEnd: number}) => {
        if (
          !onEndReached ||
          isLastPage ||
          distanceFromEnd <= 0 ||
          messages.length === 0 ||
          isNextPageLoading
        ) {
          return;
        }

        setNextPageLoading(true);
        await onEndReached?.();
        setNextPageLoading(false);
      },
      [isLastPage, isNextPageLoading, messages.length, onEndReached],
    );

    // ============ IMAGE VIEWER HANDLERS ============
    const handleImagePress = React.useCallback(
      (message: MessageType.Image) => {
        setImageViewIndex(
          gallery.findIndex(
            image => image.id === message.id && image.uri === message.uri,
          ),
        );
        setIsImageViewVisible(true);
        setStackEntry(
          StatusBar.pushStackEntry({
            barStyle: 'light-content',
            animated: true,
          }),
        );
      },
      [gallery],
    );

    // TODO: Tapping on a close button results in the next warning:
    // `An update to ImageViewing inside a test was not wrapped in act(...).`
    /* istanbul ignore next */
    const handleRequestClose = () => {
      setIsImageViewVisible(false);
      StatusBar.popStackEntry(stackEntry);
    };

    // ============ MESSAGE INTERACTION HANDLERS ============
    const handleMessagePress = React.useCallback(
      (message: MessageType.Any) => {
        if (message.type === 'image' && !disableImageGallery) {
          handleImagePress(message);
        }
        onMessagePress?.(message);
      },
      [disableImageGallery, handleImagePress, onMessagePress],
    );

    const handleMessageLongPress = React.useCallback(
      (message: MessageType.Any, event: any) => {
        if (message.type !== 'text' && message.type !== 'assistant_turn') {
          externalOnMessageLongPress?.(message);
          return;
        }

        const {pageX, pageY} = event.nativeEvent;
        setMenuPosition({x: pageX, y: pageY});
        setSelectedMessage(message);
        setMenuVisible(true);
        externalOnMessageLongPress?.(message);
      },
      [externalOnMessageLongPress],
    );

    const handleMenuDismiss = React.useCallback(() => {
      setMenuVisible(false);
      setSelectedMessage(null);
    }, []);

    // 从此处删除：移除该消息及其后的所有消息（重来/断舍离，统一弹窗设计语言）
    const handleDeleteFromHere = React.useCallback(
      async (message: MessageType.Any) => {
        const ok = await confirmDialog({
          title: l10n.components.chatView.menuItems.deleteFromHereTitle,
          message: l10n.components.chatView.menuItems.deleteFromHereMessage,
          confirmText: l10n.common.delete,
          cancelText: l10n.common.cancel,
          destructive: true,
        });
        if (ok) {
          chatSessionStore.removeMessagesFromId(message.id);
        }
      },
      [l10n],
    );

    const keyExtractor = React.useCallback(
      ({id}: MessageType.DerivedAny) => id,
      [],
    );

    // ============ CONTEXT MENU CONFIGURATION ============
    const {
      copy: copyLabel,
      regenerate: regenerateLabel,
      regenerateWith: regenerateWithLabel,
      edit: editLabel,
      reportContent: reportContentLabel,
      deleteFromHere: deleteFromHereLabel,
      speak: speakLabel,
    } = l10n.components.chatView.menuItems;

    // observer 本地读（B51 惯例）：MobX observable 属性不可作 useMemo 依赖，
    // 渲染期读入局部变量，observable 变化经 observer 重渲染驱动 useMemo 重算
    const streamingNow = modelStore.isStreaming;

    const menuItems = React.useMemo((): MenuItem[] => {
      if (
        !selectedMessage ||
        (selectedMessage.type !== 'text' &&
          selectedMessage.type !== 'assistant_turn')
      ) {
        return [];
      }

      const isAuthor = selectedMessage.author.id === user.id;
      const hasActiveModel = modelStore.activeModelId !== undefined;
      // 换模型重新生成：仅 LLM（与模型选择弹窗同一过滤规则）
      const models = (modelStore.availableModels || []).filter(
        isChatSelectable,
      );

      const baseItems: MenuItem[] = [
        {
          label: copyLabel,
          onPress: () => {
            handleCopy(selectedMessage);
            handleMenuDismiss();
          },
          icon: () => <CopyIcon stroke={theme.colors.primary} />,
          disabled: false,
        },
      ];

      // 全文朗读（P4#15 收尾，B52）：与 PlayButton 同一门控单一事实源
      // （isSpeakableMessage + isFinalMessage + TTS 可用）；voice 缺失时引导 setup。
      const speakable =
        ttsStore.isTTSAvailable &&
        isSpeakableMessage(selectedMessage) &&
        (isFinalMessage(selectedMessage) || !streamingNow);

      if (speakable) {
        const speakableText = derivedText(selectedMessage);
        const hadReasoning =
          selectedMessage.type === 'text'
            ? !!selectedMessage.metadata?.completionResult?.reasoning_content?.trim()
            : (selectedMessage.steps ?? []).some(s =>
                s.reasoningContent?.trim(),
              );
        baseItems.push({
          label: speakLabel,
          onPress: () => {
            if (ttsStore.currentVoice == null) {
              ttsStore.openSetupSheet();
            } else {
              ttsStore
                .play(selectedMessage.id, speakableText, {hadReasoning})
                .catch(() => {});
            }
            handleMenuDismiss();
          },
          icon: () => <PlayIcon stroke={theme.colors.primary} />,
          disabled: false,
        });
      }

      if (!isAuthor) {
        baseItems.push({
          label: regenerateLabel,
          onPress: () => {
            handleTryAgain(selectedMessage);
            handleMenuDismiss();
          },
          icon: () => <RefreshIcon stroke={theme.colors.primary} />,
          disabled: !hasActiveModel,
        });

        baseItems.push({
          label: regenerateWithLabel,
          icon: () => <GridIcon stroke={theme.colors.primary} />,
          disabled: false,
          submenu: models.map(model => ({
            label: getModelDisplayName(model),
            width: Math.min(300, size.width),
            onPress: () => {
              handleTryAgainWith(model.id, selectedMessage);
              handleMenuDismiss();
            },
          })),
        });
      }

      if (isAuthor) {
        baseItems.push({
          label: editLabel,
          onPress: () => {
            handleEdit(selectedMessage);
            handleMenuDismiss();
          },
          icon: () => <PencilLineIcon stroke={theme.colors.primary} />,
          disabled: !hasActiveModel,
        });
      }

      baseItems.push({
        label: reportContentLabel,
        onPress: () => {
          setIsReportSheetVisible(true);
          handleMenuDismiss();
        },
        icon: () => <AlertIcon stroke={theme.colors.primary} />,
        disabled: false,
      });

      // 从此处删除：用户/助手消息均可（移除该条及之后，二次确认）
      baseItems.push({
        label: deleteFromHereLabel,
        onPress: () => {
          handleDeleteFromHere(selectedMessage);
          handleMenuDismiss();
        },
        icon: () => <TrashIcon stroke={theme.colors.error} />,
        disabled: false,
      });

      return baseItems;
    }, [
      selectedMessage,
      user.id,
      handleCopy,
      handleTryAgain,
      handleTryAgainWith,
      handleEdit,
      handleDeleteFromHere,
      handleMenuDismiss,
      size.width,
      theme.colors.primary,
      theme.colors.error,
      copyLabel,
      regenerateLabel,
      regenerateWithLabel,
      editLabel,
      reportContentLabel,
      deleteFromHereLabel,
      speakLabel,
      streamingNow,
    ]);

    // ============ RENDER FUNCTIONS ============
    // Render menu item (with submenu support)
    const renderMenuItem = React.useCallback(
      (item: MenuItem, index: number) => {
        if (item.submenu) {
          return (
            <React.Fragment key={index}>
              <Menu.Item
                label={item.label}
                leadingIcon={item.icon}
                disabled={item.disabled}
                submenu={item.submenu.map(
                  (subItem: SubMenuItem, subIndex: number) => (
                    <React.Fragment key={subIndex}>
                      <Menu.Item
                        key={subIndex}
                        label={subItem.label}
                        onPress={subItem.onPress}
                        disabled={subItem.disabled}
                      />
                    </React.Fragment>
                  ),
                )}
              />
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={index}>
            <Menu.Item
              label={item.label}
              onPress={item.onPress}
              leadingIcon={item.icon}
              disabled={item.disabled}
            />
          </React.Fragment>
        );
      },
      [],
    );

    // Active-vs-persisted predicate (single source of truth). A message
    // is "active" if it is the LAST (newest) message in the input
    // `messages` list AND the agent's UI status is in the actively-
    // running set. Computed once here and passed down via props so
    // individual blocks within an AssistantTurn don't re-derive it.
    const newestMessageId = messages.length > 0 ? messages[0].id : null;
    const agentStatus = chatSessionStore.agentUiState.status;
    const isAgentActive =
      agentStatus === 'prefill' ||
      agentStatus === 'streaming_text' ||
      agentStatus === 'generating_tool_call' ||
      agentStatus === 'executing_tool';
    // The PendingIndicator covers every dead zone: prefill (initial
    // and follow-up), generating_tool_call, executing_tool. B41：流式期也亮，
    // 遥测行 + 迷你折线让用户看到设备在烧电路（跑分是本体）；不再与
    // token 流互斥。隐藏仅限 done。
    const isPending =
      agentStatus === 'prefill' ||
      agentStatus === 'streaming_text' ||
      agentStatus === 'generating_tool_call' ||
      agentStatus === 'executing_tool' ||
      // Keep the indicator visible during the user-initiated stop
      // window so they see the "Stopping…" feedback even if status
      // had been `streaming_text` (no indicator) at the moment of the
      // tap. Cleared together with `isStopping` once the runner exits.
      chatSessionStore.isStopping;
    const activeRunPendingTalentNames =
      chatSessionStore.agentUiState.pendingTalentNames;
    const isGeneratingToolCall = agentStatus === 'generating_tool_call';

    // footer 重新生成按钮：复用长按菜单同一 handleTryAgain 完整能力链
    //（回溯上一条用户消息 → 删除其后全部 → 重发）；仅 text/assistant_turn 生效。
    const handleFooterRegenerate = React.useCallback(
      (message: MessageType.Any) => {
        if (message.type === 'text' || message.type === 'assistant_turn') {
          handleTryAgain(message);
        }
      },
      [handleTryAgain],
    );

    // Render individual message
    const renderMessage = React.useCallback(
      ({item: message}: {item: MessageType.DerivedAny; index: number}) => {
        // B19 压缩锚点：承载摘要的卡片替代原文气泡（点按展开摘要）。
        const compactionMeta =
          message.type !== 'dateHeader'
            ? (message.metadata?.compaction as
                | MessageType.CompactionMeta
                | undefined)
            : undefined;
        if (compactionMeta) {
          return <CompactedBlock compaction={compactionMeta} />;
        }

        const messageWidth =
          showUserAvatars &&
          message.type !== 'dateHeader' &&
          message.author?.id !== user.id
            ? Math.floor(Math.min(size.width * 0.9, 900))
            : Math.floor(Math.min(size.width * 0.92, 900));

        const roundBorder =
          message.type !== 'dateHeader' && message.nextMessageInGroup;
        const showAvatar =
          message.type !== 'dateHeader' && !message.nextMessageInGroup;
        const showName = message.type !== 'dateHeader' && message.showName;
        const showStatus = message.type !== 'dateHeader' && message.showStatus;

        const isActiveRun =
          isAgentActive &&
          message.type !== 'dateHeader' &&
          message.id === newestMessageId;

        return (
          <View>
            <Message
              {...{
                enableAnimation,
                isActiveRun,
                activeRunPendingTalentNames: isActiveRun
                  ? activeRunPendingTalentNames
                  : undefined,
                isGeneratingToolCall: isActiveRun
                  ? isGeneratingToolCall
                  : false,
                message,
                messageWidth,
                onMessageLongPress: handleMessageLongPress,
                onMessagePress: handleMessagePress,
                onPreviewDataFetched,
                onRegenerate: handleFooterRegenerate,
                // 与长按菜单 disabled 规则一致：agent 运行中 / 无激活模型
                regenerateDisabled:
                  isAgentActive || modelStore.activeModelId === undefined,
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
              }}
            />
          </View>
        );
      },
      [
        enableAnimation,
        handleMessageLongPress,
        handleMessagePress,
        onPreviewDataFetched,
        handleFooterRegenerate,
        isAgentActive,
        renderBubble,
        renderCustomMessage,
        renderFileMessage,
        renderImageMessage,
        renderTextMessage,
        showUserAvatars,
        size.width,
        usePreviewData,
        user.id,
        newestMessageId,
        activeRunPendingTalentNames,
        isGeneratingToolCall,
      ],
    );

    // Render empty state (video pal or regular chat placeholder)
    const renderListEmptyComponent = React.useCallback(() => {
      // Show VideoPalEmptyPlaceholder for video pal, otherwise show regular ChatEmptyPlaceholder
      if (activePal && hasVideoCapability(activePal)) {
        return (
          <VideoPalEmptyPlaceholder
            bottomComponentHeight={bottomComponentHeight}
          />
        );
      }

      return (
        <>
          {activePal?.greeting?.text && modelStore.activeModelId ? (
            <GreetingBubble text={activePal.greeting.text} />
          ) : null}
          <ChatEmptyPlaceholder
            bottomComponentHeight={bottomComponentHeight}
            onSelectModel={() => setIsPickerVisible(true)}
          />
        </>
      );
    }, [bottomComponentHeight, setIsPickerVisible, activePal]);

    // Render footer (loading indicator or spacer)
    const renderListFooterComponent = React.useCallback(
      () =>
        // Impossible to test, see `handleEndReached` function
        /* istanbul ignore next */
        isNextPageLoading ? (
          <View style={styles.footerLoadingPage}>
            <CircularActivityIndicator
              color={theme.colors.primary}
              size={theme.iconSize.s}
            />
          </View>
        ) : (
          <View style={styles.footer} />
        ),
      [
        isNextPageLoading,
        styles.footerLoadingPage,
        styles.footer,
        theme.colors.primary,
        theme.iconSize.s,
      ],
    );

    // ListHeaderComponent as animated spacer (inverted list: header is at bottom)
    // We use this to create a spacer at the bottom of the list to account for the
    // keyboard height, so the newest turn rises above the input when the keyboard
    // opens. Reads the SAME reconciled occlusion value as the input translate, so
    // the two can never disagree, and holds while the keyboard is settled-open
    // (it returns to 0 only when the keyboard closes, not while it merely stops
    // moving — the previous in-flight gate dropped it too early on API ≤ 29).
    const headerStyle = useAnimatedStyle(() => ({
      height: keyboardOcclusion.value,
    }));

    // Render header (pending indicator + keyboard spacer). The
    // FlatList is `inverted={true}`, so the ListHeaderComponent renders
    // at the bottom of the visible list — i.e. BELOW the latest turn,
    // never inside it.
    const renderListHeaderComponent = React.useCallback(
      () => (
        <>
          {isPending && <PendingIndicatorView />}
          {chatMessages.length > 0 && <Reanimated.View style={headerStyle} />}
        </>
      ),
      [isPending, chatMessages.length, headerStyle],
    );

    // B19 压缩可见性：仅展示锚点卡片（compaction）与正常消息；
    // 纯 compacted 标记的消息被锚点代表，从列表隐藏（原文保留在库中）。
    const visibleChatMessages = React.useMemo(
      () =>
        chatMessages.filter(
          m =>
            m.type === 'dateHeader' ||
            m.metadata?.compaction ||
            (!m.metadata?.compacted && !m.metadata?.compaction),
        ),
      [chatMessages],
    );

    // Render complete chat list with scroll-to-bottom button
    const renderChatList = React.useCallback(
      () => (
        <>
          <Reanimated.View
            // eslint-disable-next-line react-native/no-inline-styles
            style={{flex: 1}}>
            <Reanimated.FlatList
              automaticallyAdjustContentInsets={false}
              contentContainerStyle={[
                styles.flatListContentContainer,
                // eslint-disable-next-line react-native/no-inline-styles
                {
                  justifyContent:
                    chatMessages.length !== 0 ? undefined : 'center',
                },
              ]}
              initialNumToRender={10}
              ListEmptyComponent={renderListEmptyComponent}
              ListFooterComponent={renderListFooterComponent}
              ListHeaderComponent={renderListHeaderComponent}
              maxToRenderPerBatch={6}
              onEndReachedThreshold={0.75}
              style={[styles.flatList, {marginBottom: bottomComponentHeight}]}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              {...unwrap(flatListProps)}
              data={visibleChatMessages}
              inverted={chatMessages.length > 0}
              // iOS keeps the interactive (drag-to-dismiss) gesture. On Android,
              // "interactive" makes a drag forcibly close the keyboard as the
              // only outcome, so the user can never scroll the list to reveal
              // content the keyboard is hiding; "none" lets the drag scroll
              // while the input stays focused. Tap-to-dismiss on send is
              // preserved via Keyboard.dismiss() in wrappedOnSendPress.
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'none'
              }
              keyExtractor={keyExtractor}
              onEndReached={handleEndReached}
              ref={list}
              renderItem={renderMessage}
              maintainVisibleContentPosition={
                isStreaming // || hasHiddenContentState
                  ? {
                      autoscrollToTopThreshold: 20,
                      minIndexForVisible: 1, //isStreaming ? 1 : 0,
                    }
                  : undefined
              }
            />
          </Reanimated.View>
          <Reanimated.View
            style={[
              scrollToBottomAnimatedStyle,
              // eslint-disable-next-line react-native/no-inline-styles
              {
                // position: 'absolute',
                right: 8,
                bottom:
                  bottomComponentHeight +
                  40 /* button height */ +
                  20 /* padding */,
              },
            ]}>
            <KeyboardStickyView offset={{closed: 0, opened: insets.bottom}}>
              <TouchableOpacity
                style={styles.scrollToBottomButton}
                onPress={scrollToBottom}>
                <Icon
                  name="chevron-down"
                  size={theme.iconSize.m}
                  color={theme.colors.onPrimary}
                />
              </TouchableOpacity>
            </KeyboardStickyView>
          </Reanimated.View>
        </>
      ),
      [
        styles.flatListContentContainer,
        styles.flatList,
        styles.scrollToBottomButton,
        theme.iconSize.m,
        chatMessages,
        visibleChatMessages,
        renderListEmptyComponent,
        renderListFooterComponent,
        renderListHeaderComponent,
        bottomComponentHeight,
        handleScroll,
        flatListProps,
        keyExtractor,
        handleEndReached,
        renderMessage,
        isStreaming,
        scrollToBottomAnimatedStyle,
        insets.bottom,
        scrollToBottom,
        theme.colors.onPrimary,
      ],
    );

    // ============ MODEL PICKER HANDLER ============
    // B18 §16.2：关闭动作单点收敛在选择器内部（加载期间驻留、收尾自动关）；
    // 此处只记录选中模型，不直接关 sheet。
    const handleModelSelect = React.useCallback((model: string) => {
      setSelectedModel(model);
    }, []);

    // ============ COMPUTED VALUES ============
    const inputBackgroundColor = activePal?.color?.[1]
      ? activePal.color?.[1]
      : theme.colors.surface;

    // Soft cap: warn the user before the 5th HTML preview in this session.
    // Memory pressure on budget Android becomes a hazard above 5 WebViews;
    // we surface the banner non-blockingly at >=4 so they can start a new
    // chat. Counts html-result outcomes across all steps of every
    // AssistantTurn row in the visible message list.
    const htmlPreviewCount = React.useMemo(
      () =>
        messages.reduce((acc, m) => {
          if (m.type !== 'assistant_turn') {
            return acc;
          }
          const turn = m as MessageType.AssistantTurn;
          let count = 0;
          for (const step of turn.steps ?? []) {
            for (const outcome of step.toolOutcomes ?? []) {
              if (outcome.result.type === 'html') {
                count += 1;
              }
            }
          }
          return acc + count;
        }, 0),
      [messages],
    );
    // ============ COMPONENT RENDER ============
    return (
      <UserContext.Provider value={user}>
        <View
          style={[styles.container, {backgroundColor: inputBackgroundColor}]}
          onLayout={onLayout}>
          {/* Header */}
          <View style={styles.headerWrapper}>
            <ChatHeader onModelPickerPress={() => setIsPickerVisible(true)} />
            {headerAccessory}
          </View>

          {/* Main chat container */}
          <Reanimated.View style={styles.chatContainer}>
            {customContent}
            {renderChatList()}

            {/* Chat input */}
            <Reanimated.View
              onLayout={onLayoutChatInput}
              style={[
                styles.inputContainer,
                inputContainerAnimatedStyle,
                {backgroundColor: inputBackgroundColor},
              ]}>
              <BannerRow
                messages={messages}
                htmlPreviewCount={htmlPreviewCount}
                canIncrease={canIncreaseContext}
                onNewChat={() => chatSessionStore.resetActiveSession()}
                onIncreaseContext={() => setIncreaseSheetOpen(true)}
                onCompactContext={handleCompactContext}
              />
              <ChatInput
                {...{
                  ...unwrap(inputProps),
                  isStreaming,
                  onSendPress: wrappedOnSendPress,
                  onStopPress,
                  chatInputHeight,
                  inputBackgroundColor,
                  onCancelEdit: handleCancelEdit,
                  onPalBtnPress: () => setIsPickerVisible(!isPickerVisible),
                  isStopVisible,
                  isPickerVisible,
                  sendButtonVisibilityMode,
                  showImageUpload,
                  isVisionEnabled,
                  defaultImages: inputImages,
                  onDefaultImagesChange: setInputImages,
                  editSourceUri,
                  onEditSourceChange,
                  textInputProps: {
                    ...textInputProps,
                    // Only override value and onChangeText if not using promptText
                    ...(!(activePal && hasVideoCapability(activePal)) && {
                      value: inputText,
                      onChangeText: setInputText,
                    }),
                  },
                }}
              />
            </Reanimated.View>

            {/* Suggested prompts — float above the input container, share
                its keyboard-tracking transform so they rise together but
                render as a sibling (no shared background / rounded top). */}
            {messages.length === 0 &&
            !isStreaming &&
            modelStore.activeModelId !== undefined &&
            activePal?.greeting?.suggestedPrompts &&
            activePal.greeting.suggestedPrompts.length > 0 ? (
              <Reanimated.View
                pointerEvents="box-none"
                style={[
                  styles.suggestedPromptsOverlay,
                  suggestedPromptsAnimatedStyle,
                  {bottom: chatInputHeight.height},
                ]}>
                <SuggestedPromptsRow
                  prompts={activePal.greeting.suggestedPrompts}
                  onSelect={prompt =>
                    wrappedOnSendPress({type: 'text', text: prompt})
                  }
                />
              </Reanimated.View>
            ) : null}

            {/* Pal/Model picker sheet */}
            {/* Conditionally render the sheet to avoid keyboard issues.
            It makes the disappearing sudden, but it's better than the keyboard issue.*/}
            {isPickerVisible && (
              <ChatPalModelPickerSheet
                isVisible={isPickerVisible}
                onClose={() => setIsPickerVisible(false)}
                onModelSelect={handleModelSelect}
                chatInputHeight={chatInputHeight.height}
              />
            )}
          </Reanimated.View>

          {/* Image viewer：P5 全屏查看器底部加「编辑此图片」——当前图下沉输入框 */}
          <ImageView
            imageIndex={imageViewIndex}
            images={gallery}
            onRequestClose={handleRequestClose}
            visible={isImageViewVisible}
            Footer={({image}) => (
              <TouchableOpacity
                testID="image-viewer-edit-button"
                style={styles.viewerEditButton}
                onPress={() => {
                  const uri = (image as {uri?: string}).uri;
                  if (uri) {
                    onEditSourceChange?.(uri);
                  }
                  handleRequestClose();
                }}>
                <Text style={styles.viewerEditText}>
                  <EditIcon
                    width={15}
                    height={15}
                    stroke={theme.colors.onSurface}
                  />{' '}
                  编辑此图片
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Context menu */}
          <Menu
            visible={menuVisible}
            onDismiss={handleMenuDismiss}
            selectable={false}
            anchor={menuPosition}>
            {menuItems.map(renderMenuItem)}
          </Menu>

          {/* Content report sheet */}
          <ContentReportSheet
            isVisible={isReportSheetVisible}
            onClose={() => setIsReportSheetVisible(false)}
          />

          {increaseSheetOpen && activeModel && currentNCtx !== undefined ? (
            <IncreaseContextSheet
              isVisible={increaseSheetOpen}
              model={activeModel}
              projectionModel={projectionModel}
              currentNCtx={currentNCtx}
              onClose={() => setIncreaseSheetOpen(false)}
              onNewChat={() => {
                chatSessionStore.resetActiveSession();
                setIncreaseSheetOpen(false);
              }}
              onReloadStart={() => {
                // Single advisory surface: dismiss the pal-load hint in the
                // same handler so no frame shows two snackbars at once.
                palLoadHint.dismiss();
                setReloadSnackbar({
                  message: l10n.chat.increaseContextReloading,
                  indefinite: true,
                });
              }}
              onReloadResult={(success, target) =>
                setReloadSnackbar({
                  message: success
                    ? t(l10n.chat.increaseContextSuccess, {target})
                    : l10n.chat.increaseContextFailure,
                  indefinite: false,
                })
              }
            />
          ) : null}

          <Snackbar
            visible={isFocused && reloadSnackbar !== null}
            onDismiss={() => setReloadSnackbar(null)}
            duration={
              // RNP treats POSITIVE_INFINITY as "no auto-hide timer"; the
              // reloading snackbar stays until the result replaces it.
              reloadSnackbar?.indefinite ? Number.POSITIVE_INFINITY : 4000
            }
            testID="context-reload-snackbar">
            {reloadSnackbar?.message ?? ''}
          </Snackbar>

          <Snackbar
            visible={isFocused && compactionSnackbar !== null}
            onDismiss={() => setCompactionSnackbar(null)}
            duration={4000}
            testID="compaction-snackbar">
            {compactionSnackbar ?? ''}
          </Snackbar>

          <Snackbar
            visible={isFocused && palLoadHint.hintVisible && !reloadSnackbar}
            onDismiss={palLoadHint.dismiss}
            duration={6000}
            action={{
              label: l10n.chat.contextMoreRoom,
              onPress: () => {
                palLoadHint.dismiss();
                setIncreaseSheetOpen(true);
              },
            }}
            testID="pal-load-hint-snackbar">
            {l10n.chat.palLoadHint}
          </Snackbar>
        </View>
      </UserContext.Provider>
    );
  },
);
