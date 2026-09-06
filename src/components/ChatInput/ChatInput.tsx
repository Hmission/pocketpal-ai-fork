import * as React from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Animated,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {useCameraPermission} from 'react-native-vision-camera';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {observer} from 'mobx-react';
import {IconButton, Text} from 'react-native-paper';

import {hasVideoCapability} from '../../utils/pal-capabilities';
import {audioRecorder} from '../../services/audio/recorder';

import {
  VideoRecorderIcon,
  PlusIcon,
  AtomIcon,
  MicIcon,
  StopIcon,
} from '../../assets/icons';

import {useTheme} from '../../hooks/useTheme';

import {createStyles} from './styles';

import {chatSessionStore, modelStore, palStore} from '../../store';
import {promptWriter} from '../../services/promptWriter';
import {imageGenStore} from '../../store';
import {audioStore} from '../../store/audioStore';

import {MessageType} from '../../utils/types';
import {L10nContext, UserContext} from '../../utils';
import {t} from '../../locales';

import {SendButton, StopButton, Menu} from '..';

import {infoDialog} from '../ui/InfoDialog';

export interface ChatInputTopLevelProps {
  /** Whether the AI is currently streaming tokens */
  isStreaming?: boolean;
  /** Will be called on {@link SendButton} tap. Has {@link MessageType.PartialText} which can
   * be transformed to {@link MessageType.Text} and added to the messages list.
   * 第二参数 editSourceUri（P5）：编辑模式发送时交接编辑源图给 scheduler。 */
  onSendPress: (
    message: MessageType.PartialText,
    editSourceUri?: string | null,
  ) => void;
  onStopPress?: () => void;
  onCancelEdit?: () => void;
  onPalBtnPress?: () => void;
  isStopVisible?: boolean;
  /** Controls the visibility behavior of the {@link SendButton} based on the
   * `TextInput` state. Defaults to `editing`. */
  sendButtonVisibilityMode?: 'always' | 'editing';
  textInputProps?: TextInputProps;
  isPickerVisible?: boolean;
  inputBackgroundColor?: string;
  /** External control for selected images (for edit mode) */
  defaultImages?: string[];
  onDefaultImagesChange?: (images: string[]) => void;

  /** Camera-specific props */
  isCameraActive?: boolean;
  onStartCamera?: () => void;
  /** For camera input, allows direct editing of the prompt text */
  promptText?: string;
  onPromptTextChange?: (text: string) => void;
  /** Whether to show the image upload button */
  showImageUpload?: boolean;
  isVisionEnabled?: boolean;
  /** Whether to show the thinking toggle button */
  showThinkingToggle?: boolean;
  /** Whether thinking mode is currently enabled */
  isThinkingEnabled?: boolean;
  /** Callback when thinking toggle is pressed */
  onThinkingToggle?: (enabled: boolean) => void;
  /** Whether the model supports graded reasoning effort (axis 2) */
  supportsEffort?: boolean;
  /** The graded effort value set, e.g. ['low','medium','high'] */
  effortValues?: string[];
  /** Currently selected reasoning effort (when graded) */
  reasoningEffort?: string;
  /** Callback to cycle the graded effort state (off -> values -> off) */
  onEffortCycle?: () => void;
  /** 编辑源图（P5 豆包式闭环）：外部受控——图片编辑按钮/全屏查看器/任务卡下沉输入框 */
  editSourceUri?: string | null;
  /** 编辑源图变更（× 取消传 null） */
  onEditSourceChange?: (uri: string | null) => void;
}

export interface ChatInputAdditionalProps {
  /** Camera-specific props */
  isCameraActive?: boolean;
  onStartCamera?: () => void;
  /** For camera input, allows direct editing of the prompt text */
  promptText?: string;
  onPromptTextChange?: (text: string) => void;
  /** Whether to show the image upload button */
  showImageUpload?: boolean;
  /** Whether to show the thinking toggle button */
  showThinkingToggle?: boolean;
  /** Whether thinking mode is currently enabled */
  isThinkingEnabled?: boolean;
  /** Callback when thinking toggle is pressed */
  onThinkingToggle?: (enabled: boolean) => void;
  /** Whether the model supports graded reasoning effort (axis 2) */
  supportsEffort?: boolean;
  /** The graded effort value set, e.g. ['low','medium','high'] */
  effortValues?: string[];
  /** Currently selected reasoning effort (when graded) */
  reasoningEffort?: string;
  /** Callback to cycle the graded effort state (off -> values -> off) */
  onEffortCycle?: () => void;
}

export type ChatInputProps = ChatInputTopLevelProps & ChatInputAdditionalProps;

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/** Bottom bar input component with a text input, attachment and
 * send buttons inside. By default hides send button when text input is empty. */
export const ChatInput = observer(
  ({
    isStreaming = false,
    onSendPress,
    onStopPress,
    onCancelEdit,
    // [已裁剪 2026-08] onPalBtnPress / isPickerVisible 仅供 ^ Pal 选择器使用，
    // 按钮已裁剪，接口保留作恢复点（不再解构）。
    isStopVisible,
    sendButtonVisibilityMode,
    textInputProps,
    inputBackgroundColor: _inputBackgroundColor,
    isCameraActive = false,
    onStartCamera,
    promptText,
    onPromptTextChange,
    showImageUpload = false,
    isVisionEnabled = false,
    defaultImages,
    onDefaultImagesChange,
    showThinkingToggle = false,
    isThinkingEnabled = false,
    onThinkingToggle,
    supportsEffort = false,
    effortValues = [],
    reasoningEffort,
    onEffortCycle,
    editSourceUri,
    onEditSourceChange,
  }: ChatInputProps) => {
    const l10n = React.useContext(L10nContext);
    const theme = useTheme();
    const user = React.useContext(UserContext);
    const inputRef = React.useRef<TextInput>(null);
    const editBarHeight = React.useRef(new Animated.Value(0)).current;
    const activePalId = chatSessionStore.activePalId;
    const currentActivePal = palStore.pals.find(pal => pal.id === activePalId);

    // Camera permission hook from react-native-vision-camera
    const {hasPermission, requestPermission} = useCameraPermission();

    // 可发送判定：chat 模型已激活，或常驻管家就绪，或存在可懒切换恢复的
    // 已下载模型（生图挤占 chat 槽后 activeModelId 可能残留/清空，调度由
    // useChatScheduler 受控：加载完成+引擎就绪后才真正送消息）。
    const hasActiveModel =
      !!modelStore.activeModelId ||
      promptWriter.isLoaded ||
      !!modelStore.lastUsedModel;

    // Use `defaultValue` if provided
    const [text, setText] = React.useState(textInputProps?.defaultValue ?? '');
    // 跨屏预填（PLAY_SPEC v1.6 玩具迭代闭环）：玩具箱「继续修改」→ 跳回聊天
    // → 响应式消费 pendingChatText 并清空（同 imageGenStore.pendingPrompt 模式）。
    const pendingChatText = chatSessionStore.pendingChatText;
    React.useEffect(() => {
      if (pendingChatText && pendingChatText.length > 0) {
        chatSessionStore.pendingChatText = null;
        setText(pendingChatText);
        inputRef.current?.focus();
      }
    }, [pendingChatText]);
    // State for selected images - use external control when provided
    const [internalSelectedImages, setInternalSelectedImages] = React.useState<
      string[]
    >([]);
    const selectedImages = defaultImages ?? internalSelectedImages;
    const setSelectedImages =
      onDefaultImagesChange ?? setInternalSelectedImages;
    // 编辑源图（P5 豆包式）：优先单图下沉输入框，与视觉问答多图完全隔离
    const displayImages = editSourceUri ? [editSourceUri] : selectedImages;
    // State for image upload menu
    const [showImageUploadMenu, setShowImageUploadMenu] = React.useState(false);
    // State for showing "model not loaded" helper text
    const [showModelWarning, setShowModelWarning] = React.useState(false);
    // 语音输入：输入为空→麦克风按钮（仅本地 ASR 就绪时显示，见 showVoiceButton）
    const [isListening, setIsListening] = React.useState(false);
    // 编辑源图状态（P5）：外部受控；发送/取消后由 ChatView 复位
    const [showEditPickerMenu, setShowEditPickerMenu] = React.useState(false);
    const [showEditHint, setShowEditHint] = React.useState(false); // 编辑空指令轻提示
    // 快捷前缀标签（P5 v3 图标语义）：点「图像生成/图片编辑/做个玩具/来场冒险/写作项目」→ 输入区顶部显示彩色前缀 chip，
    // 不可逐字编辑（× 整体删除，破坏一个字符即失效）；发送时拼接成完整文本（路由/编辑剥离），
    // 模型只收主体。前缀不是输入文本——不占 value，天然绕开受控组件。
    const [quickPrefix, setQuickPrefix] = React.useState<
      '图像生成' | '图片编辑' | '做个玩具' | '来场冒险' | '写作项目' | null
    >(null);
    const isEditMode = chatSessionStore.isEditMode;

    const styles = createStyles({theme, isEditMode});

    // For camera input, use promptText if provided
    const isVideoCapable =
      currentActivePal && hasVideoCapability(currentActivePal);
    const value =
      isVideoCapable && promptText !== undefined
        ? promptText
        : (textInputProps?.value ?? text);

    React.useEffect(() => {
      if (isEditMode) {
        // Animate edit bar height
        Animated.spring(editBarHeight, {
          toValue: 28,
          useNativeDriver: false,
          friction: 8,
        }).start();
        // Focus input
        inputRef.current?.focus();
      } else {
        Animated.spring(editBarHeight, {
          toValue: 0,
          useNativeDriver: false,
          friction: 8,
        }).start();
        onCancelEdit?.();
      }
    }, [isEditMode, editBarHeight, onCancelEdit]);

    // 外部取消编辑（ChatView editBar × / 缩略图 ×）→ 清「图片编辑」前缀（图像生成前缀不受影响）
    React.useEffect(() => {
      if (!editSourceUri) {
        setQuickPrefix(p => (p === '图片编辑' ? null : p));
      }
    }, [editSourceUri]);

    const handleChangeText = (newText: string) => {
      if (isVideoCapable && onPromptTextChange) {
        onPromptTextChange(newText);
      } else {
        setText(newText);
        textInputProps?.onChangeText?.(newText);
      }
    };

    /**
     * 语音输入 = **单一路径**：本地 SenseVoice（`AudioRecord` 落盘 → sherpa-onnx 离线转写）。
     *
     * 为什么删掉系统识别（`@react-native-voice` / Android SpeechRecognizer）那条回退
     * （2026-09-05 K90 实证，大王裁定「只问可不可用」）：
     * ① HyperOS 的系统语音引擎是 `com.xiaomi.mibrain.speech`（小爱），**需用户先在厂商
     *   协议页同意激活**；本机实测停在协议页 → `Voice.start()` 点了没反应（静默失败）。
     * ② 那个协议页原文自述「在使用本应用的过程中，我们将联网并向您申请以下权限」——
     *   可用性完全不在我们手里；而本地 SenseVoice **零网络调用**，断网必可用。
     * ③ 旧写法只在「本地启动抛异常」时 catch 回退，**没有任何可用性判据**，
     *   所以它带来的不是备份，而是第二条静默失败路径。
     * 结论：输入框语音一律本地；模型没下好就**不显示语音键**（这是可见的状态，
     * 不是静默兜底），下载入口在音频工坊/设置里（`asrState` 由 audioStore 统一派生）。
     */
    const handleVoiceToggle = async () => {
      if (isListening) {
        setIsListening(false);
        try {
          const p = await audioRecorder.stop('chat_input');
          if (p) {
            const textValue = await audioStore.transcribeTask(p);
            if (textValue) {
              handleChangeText(textValue);
            }
          }
        } catch (e) {
          console.warn('[ChatInput] local ASR stop failed:', e);
        }
        return;
      }
      if (audioStore.asrState !== 'ready') {
        return;
      }
      try {
        // 权限 / 忙互斥 / 原生失败全在 audioRecorder 里分好类（W2b）：
        // 任一失败都**不进 listening 态**，不会出现「显示在录但其实没录」的假象。
        await audioRecorder.start('chat_input');
        setIsListening(true);
      } catch (e) {
        console.warn('[ChatInput] voice start failed:', e);
        setIsListening(false);
      }
    };

    // 卸载/切页时在录 → 交还麦克风（W2b 互斥锁的必要配套，否则锁会焊死其他入口）
    React.useEffect(
      () => () => {
        void audioRecorder.stop('chat_input').catch(() => {
          // 释放失败不再往上抛：卸载路径无人接收，且日志已在 recorder 内打过
        });
      },
      [],
    );

    const handleSend = () => {
      const trimmedValue = value.trim();
      // 编辑模式（P5）：显式编辑源图 + 文本指令 → 发送带 imageUris，scheduler 走编辑闭环；空指令轻提示
      if (editSourceUri) {
        if (!trimmedValue) {
          setShowEditHint(true);
          setTimeout(() => setShowEditHint(false), 3000);
          return;
        }
        onSendPress({
          text:
            quickPrefix === '图片编辑'
              ? `图片编辑：${trimmedValue}`
              : trimmedValue,
          type: 'text',
          imageUris: [editSourceUri],
        });
        setText('');
        setQuickPrefix(null);
        onEditSourceChange?.(null);
        return;
      }
      if (trimmedValue) {
        // Check if model is loaded before sending
        if (!hasActiveModel) {
          // Trigger haptic feedback to indicate the action is blocked
          ReactNativeHapticFeedback.trigger(
            'notificationWarning',
            hapticOptions,
          );
          // Show warning helper text
          setShowModelWarning(true);
          // Auto-hide after 3 seconds
          setTimeout(() => setShowModelWarning(false), 3000);
          return;
        }

        // Include imageUris in the message object
        onSendPress({
          text: quickPrefix ? `${quickPrefix}：${trimmedValue}` : trimmedValue,
          type: 'text',
          imageUris: selectedImages.length > 0 ? selectedImages : undefined,
        });
        setText('');
        setQuickPrefix(null);
        // Clear selected images after sending
        setSelectedImages([]);
      }
    };

    // Handle plus button press to show image upload menu
    const handlePlusButtonPress = () => {
      setShowImageUploadMenu(true);
    };

    // Need to figure this out:
    // Handle taking a photo with the camera using react-native-image-picker
    // but with permission checking from react-native-vision-camera
    const handleTakePhoto = async () => {
      try {
        if (!hasPermission) {
          const permissionResult = await requestPermission();
          if (!permissionResult) {
            infoDialog({
              title: l10n.camera.permissionTitle,
              message: l10n.camera.permissionMessage,
            });
            setShowImageUploadMenu(false);
            return;
          }
        }

        // Disable auto-release during camera operation
        // this is only needed on Android.
        modelStore.disableAutoRelease('camera-photo');

        const result = await launchCamera({
          mediaType: 'photo',
          quality: 0.8,
        });

        if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
          const newImages = [...selectedImages, result.assets[0].uri];
          setSelectedImages(newImages);
        }
        setShowImageUploadMenu(false);
      } catch (error) {
        console.error('Error taking photo:', error);
        infoDialog({
          title: l10n.errors.cameraErrorTitle,
          message: l10n.errors.cameraErrorMessage,
        });
      } finally {
        // Re-enable auto-release after camera operation
        modelStore.enableAutoRelease('camera-photo');
      }
    };

    // Handle selecting images from the gallery
    const handleSelectImages = async () => {
      try {
        // Disable auto-release during gallery operation
        // this is only needed on Android.
        modelStore.disableAutoRelease('image-gallery');

        const result = await launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: 5, // Allow multiple images
          quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
          const newUris = result.assets
            .filter(asset => asset.uri)
            .map(asset => asset.uri as string);

          if (newUris.length > 0) {
            const newImages = [...selectedImages, ...newUris];
            setSelectedImages(newImages);
          }
        }
        setShowImageUploadMenu(false);
      } catch (error) {
        console.error('Error selecting images:', error);
        infoDialog({
          title: l10n.errors.galleryErrorTitle,
          message: l10n.errors.galleryErrorMessage,
        });
      } finally {
        // Re-enable auto-release after gallery operation
        modelStore.enableAutoRelease('image-gallery');
      }
    };

    // Remove an image from the selection
    const handleRemoveImage = (index: number) => {
      const newImages = [...selectedImages];
      newImages.splice(index, 1);
      setSelectedImages(newImages);
    };

    // 快捷操作行：图片编辑选图（相册/拍照）→ 下沉输入框（P5 豆包式，单选）
    const handleQuickEditPick = async (source: 'camera' | 'gallery') => {
      try {
        if (source === 'camera') {
          if (!hasPermission) {
            const permissionResult = await requestPermission();
            if (!permissionResult) {
              infoDialog({
                title: l10n.camera.permissionTitle,
                message: l10n.camera.permissionMessage,
              });
              setShowEditPickerMenu(false);
              return;
            }
          }
          modelStore.disableAutoRelease('camera-photo');
          const result = await launchCamera({mediaType: 'photo', quality: 0.8});
          if (
            result.assets &&
            result.assets.length > 0 &&
            result.assets[0].uri
          ) {
            onEditSourceChange?.(result.assets[0].uri);
            setQuickPrefix('图片编辑');
            inputRef.current?.focus();
          }
        } else {
          modelStore.disableAutoRelease('image-gallery');
          const result = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: 1,
            quality: 0.8,
          });
          if (
            result.assets &&
            result.assets.length > 0 &&
            result.assets[0].uri
          ) {
            onEditSourceChange?.(result.assets[0].uri);
            setQuickPrefix('图片编辑');
            inputRef.current?.focus();
          }
        }
        setShowEditPickerMenu(false);
      } catch (error) {
        console.error('Error picking edit image:', error);
        infoDialog({
          title: l10n.errors.galleryErrorTitle,
          message: l10n.errors.galleryErrorMessage,
        });
      } finally {
        modelStore.enableAutoRelease(
          source === 'camera' ? 'camera-photo' : 'image-gallery',
        );
      }
    };

    // 引擎忙碌（加载/生成中）时快捷行禁用，防连点
    const busy = imageGenStore.loading || imageGenStore.generating;

    const handleCancel = () => {
      setText('');
      onCancelEdit?.();
    };

    const isSendButtonVisible =
      !isStreaming &&
      !isStopVisible &&
      user &&
      !isVideoCapable && // Hide send button for video-capable pals
      (sendButtonVisibilityMode === 'always' || value.trim());
    // 语音输入按钮：输入为空时顶替发送钮；**只看本地 ASR 是否就绪**
    // （系统识别已删除，理由见 handleVoiceToggle 上方）；一打字即变回发送
    const showVoiceButton =
      audioStore.asrState === 'ready' &&
      user &&
      !isVideoCapable &&
      !isCameraActive &&
      !isStreaming &&
      !isStopVisible &&
      !value.trim().length;
    const isSendButtonEnabled = value.trim().length > 0 && hasActiveModel;

    const onSurfaceColor = currentActivePal?.color?.[0] || theme.colors.text;
    const onSurfaceColorVariant = onSurfaceColor + '55'; // for disabled state or placeholder text
    // // Plus button state
    const isPlusButtonEnabled = !isStreaming && isVisionEnabled;
    const plusColor = isPlusButtonEnabled
      ? onSurfaceColor
      : onSurfaceColorVariant;

    // Localize the current graded-effort tier through the same table the
    // model-settings chips use; fall back to the raw token for an unlisted one.
    const effortLevelLabels = l10n.components.modelSettingsSheet.effortLevels;
    const localizedEffort =
      reasoningEffort && reasoningEffort in effortLevelLabels
        ? effortLevelLabels[reasoningEffort as keyof typeof effortLevelLabels]
        : reasoningEffort;

    return (
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          {/* Edit Bar (when in edit mode) */}
          {isEditMode && (
            <Animated.View
              style={[
                styles.editBar,
                {
                  height: editBarHeight,
                },
              ]}>
              <Text variant="labelSmall" style={styles.editBarText}>
                Editing message
              </Text>
              <IconButton
                icon="close"
                size={theme.iconSize.s}
                onPress={handleCancel}
                style={styles.editBarButton}
                iconColor={theme.colors.onSurfaceVariant}
              />
            </Animated.View>
          )}

          {/* Image Preview Section：编辑源图（P5）优先单图下沉，其余走视觉问答多图 */}
          {displayImages.length > 0 && (
            <View
              style={[
                styles.imagePreviewContainer,
                isEditMode && styles.imagePreviewContainerEditMode,
              ]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageScrollContent}>
                {displayImages.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.imageContainer}>
                    <Image
                      source={{uri}}
                      style={styles.previewImage}
                      accessibilityLabel={`Image preview ${index + 1} of ${
                        displayImages.length
                      }`}
                    />
                    <IconButton
                      icon="close-circle"
                      size={theme.iconSize.m}
                      iconColor={theme.colors.error}
                      style={styles.removeImageButton}
                      onPress={() =>
                        editSourceUri
                          ? onEditSourceChange?.(null)
                          : handleRemoveImage(index)
                      }
                      accessibilityLabel={`Remove image ${index + 1}`}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Text Input Area (Top Row) */}
          <View
            style={[
              styles.textInputArea,
              {
                paddingTop: isEditMode
                  ? selectedImages.length > 0
                    ? 8 // Reduced padding when images present in edit mode
                    : 52 // Edit bar height (28px) + normal padding (24px)
                  : selectedImages.length > 0
                    ? 0
                    : 24,
              },
            ]}>
            {/* Subtle Prompt Label for Video Pals */}
            {isVideoCapable && (
              <Text
                variant="labelSmall"
                style={[styles.promptLabel, {color: onSurfaceColorVariant}]}>
                {l10n.palsScreen.prompt}:
              </Text>
            )}
            {/* 快捷前缀标签（P5 v3 图标语义）：彩色 chip，× 整体删除，不进 value/模型 */}
            {quickPrefix && (
              <View style={styles.quickPrefixChip}>
                <Text style={styles.quickPrefixText}>{quickPrefix}：</Text>
                <TouchableOpacity
                  testID="quick-prefix-clear"
                  onPress={() => setQuickPrefix(null)}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  accessibilityLabel="清除任务前缀"
                  accessibilityRole="button">
                  <Icon name="close" size={13} color={theme.colors.surface} />
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              ref={inputRef}
              multiline
              placeholder={
                editSourceUri
                  ? '想修改哪里？例如：把背景改成海边'
                  : quickPrefix === '图像生成'
                    ? '描述你想画的内容…'
                    : quickPrefix === '做个玩具'
                      ? '描述想玩的玩具，例如：贪吃蛇、抽签器…'
                      : quickPrefix === '来场冒险'
                        ? '描述你的冒险开场，例如：地牢、巨龙、宝藏…'
                        : quickPrefix === '写作项目'
                          ? '描述你想写的故事，例如：星海征途、奇幻冒险…'
                          : isVideoCapable
                            ? l10n.video.promptPlaceholder
                            : l10n.components.chatInput.inputPlaceholder
              }
              placeholderTextColor={onSurfaceColorVariant}
              underlineColorAndroid="transparent"
              {...textInputProps}
              style={[
                styles.input,
                textInputProps?.style,
                {
                  color: onSurfaceColor,
                },
                isVideoCapable && styles.inputWithLabel,
              ]}
              onChangeText={handleChangeText}
              value={value}
              editable={
                isVideoCapable
                  ? !isStreaming && !isCameraActive
                  : !isListening && textInputProps?.editable !== false
              }
              testID="chat-input"
              accessibilityLabel="Message input"
            />
          </View>

          {/* Divider between input area and control bar */}
          <View style={styles.inputDivider} />

          {/* Control Bar (Bottom Row)：P5 快捷生图/编辑下沉到本行（思考胶囊旁，图标钮省空间） */}
          <View style={styles.controlBar}>
            {/* Left Controls */}
            <View style={styles.leftControls}>
              {/* 快捷生图/编辑（P5 豆包式）：图像生成引导 / 图片编辑选图下沉输入框；生成/加载中禁用
                  图标用主题 primary（可用态彩色，非灰）；busy 时才降透明示禁用 */}
              <TouchableOpacity
                testID="image-quick-gen"
                style={[styles.quickIconBtn, busy && styles.quickIconBtnBusy]}
                disabled={busy}
                onPress={() => {
                  setQuickPrefix('图像生成');
                  onEditSourceChange?.(null); // 退出编辑模式（若有残留源图）
                  inputRef.current?.focus();
                }}
                accessibilityLabel="图像生成"
                accessibilityRole="button">
                <Icon
                  name="palette"
                  size={theme.iconSize.m}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              {/* 玩具工坊（P8，PLAY_SPEC）：玩法引导入口——「做个玩具」前缀路由 play 任务 */}
              <TouchableOpacity
                testID="toy-quick-gen"
                style={[styles.quickIconBtn, busy && styles.quickIconBtnBusy]}
                disabled={busy}
                onPress={() => {
                  setQuickPrefix('做个玩具');
                  onEditSourceChange?.(null); // 退出编辑模式（若有残留源图）
                  inputRef.current?.focus();
                }}
                accessibilityLabel="做个玩具"
                accessibilityRole="button">
                <Icon
                  name="gamepad-variant"
                  size={theme.iconSize.m}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              {/* TRPG 城主（P12 v1.1，ADVENTURE_SPEC）：冒险玩法引导入口——「来场冒险」前缀路由 adventure 任务 */}
              <TouchableOpacity
                testID="adventure-quick-gen"
                style={[styles.quickIconBtn, busy && styles.quickIconBtnBusy]}
                disabled={busy}
                onPress={() => {
                  setQuickPrefix('来场冒险');
                  onEditSourceChange?.(null); // 退出编辑模式（若有残留源图）
                  inputRef.current?.focus();
                }}
                accessibilityLabel="来场冒险"
                accessibilityRole="button">
                <Icon
                  name="sword-cross"
                  size={theme.iconSize.m}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              {/* 写作工作区（WORKSPACE_SPEC v1）：写作项目引导入口——「写作项目」前缀路由 write 任务（新建/续写） */}
              <TouchableOpacity
                testID="writing-quick-gen"
                style={[styles.quickIconBtn, busy && styles.quickIconBtnBusy]}
                disabled={busy}
                onPress={() => {
                  setQuickPrefix('写作项目');
                  onEditSourceChange?.(null); // 退出编辑模式（若有残留源图）
                  inputRef.current?.focus();
                }}
                accessibilityLabel="写作项目"
                accessibilityRole="button">
                <Icon
                  name="pencil-outline"
                  size={theme.iconSize.m}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              <Menu
                visible={showEditPickerMenu}
                onDismiss={() => setShowEditPickerMenu(false)}
                anchorPosition="top"
                anchor={
                  <TouchableOpacity
                    testID="image-quick-edit"
                    style={[
                      styles.quickIconBtn,
                      busy && styles.quickIconBtnBusy,
                    ]}
                    disabled={busy}
                    onPress={() => setShowEditPickerMenu(true)}
                    accessibilityLabel="图片编辑"
                    accessibilityRole="button">
                    <Icon
                      name="image-edit-outline"
                      size={theme.iconSize.m}
                      color={theme.colors.primary}
                    />
                  </TouchableOpacity>
                }>
                <Menu.Item
                  label={l10n.camera?.takePhoto || '拍照'}
                  icon="camera"
                  onPress={() => handleQuickEditPick('camera')}
                />
                <Menu.Item
                  label={l10n.common?.gallery || '相册'}
                  icon="image"
                  onPress={() => handleQuickEditPick('gallery')}
                />
              </Menu>

              {/* Plus Button for Image Upload (only for regular chat) */}
              {showImageUpload && !isVideoCapable && (
                <Menu
                  visible={showImageUploadMenu}
                  onDismiss={() => setShowImageUploadMenu(false)}
                  anchorPosition="top"
                  anchor={
                    <TouchableOpacity
                      style={styles.plusButton}
                      disabled={!isPlusButtonEnabled}
                      onPress={
                        isPlusButtonEnabled ? handlePlusButtonPress : () => {}
                      }
                      accessibilityLabel="Add image"
                      accessibilityRole="button">
                      <PlusIcon width={20} height={20} stroke={plusColor} />
                    </TouchableOpacity>
                  }>
                  <Menu.Item
                    label={l10n.camera?.takePhoto || 'Camera'}
                    icon="camera"
                    onPress={handleTakePhoto}
                  />
                  <Menu.Item
                    label={l10n.common?.gallery || 'Gallery'}
                    icon="image"
                    onPress={handleSelectImages}
                  />
                </Menu>
              )}

              {/* [已裁剪·恢复点 2026-08] Pal 选择器（^ ChevronUpIcon + Pal 名）：
                  大王裁定不需要（智能体/模型选择已不需要此入口，头部 ⌄ chip
                  仍可开 ChatPalModelPickerSheet）。恢复见 git 历史 palSelector 块。 */}

              {/* Thinking Toggle Button. Graded models (axis-2) cycle
                  off -> low -> medium -> high; effortless models toggle
                  on/off. The label shows the current effort when graded. */}
              {showThinkingToggle && !isCameraActive && (
                <TouchableOpacity
                  testID="thinking-toggle"
                  style={[
                    styles.thinkingToggleLeft,
                    // 全局 UI 规范：选中态 = 标准橙黄底 + onPrimary 前景（替代旧 onSurface 黑底）
                    isThinkingEnabled && {
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                  // B18 §17：胶囊 24px 视觉，触区上下 +6 补回 36px 行基线
                  hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}
                  onPress={() =>
                    supportsEffort && effortValues.length > 0
                      ? onEffortCycle?.()
                      : onThinkingToggle?.(!isThinkingEnabled)
                  }
                  accessibilityLabel={
                    supportsEffort && effortValues.length > 0
                      ? t(
                          l10n.components.chatInput.thinkingToggle.cycleEffort,
                          {
                            level: localizedEffort ?? '',
                          },
                        )
                      : isThinkingEnabled
                        ? l10n.components.chatInput.thinkingToggle
                            .disableThinking
                        : l10n.components.chatInput.thinkingToggle
                            .enableThinking
                  }
                  accessibilityRole="button">
                  <AtomIcon
                    width={14}
                    height={14}
                    stroke={
                      isThinkingEnabled
                        ? theme.colors.onPrimary
                        : onSurfaceColorVariant
                    }
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.thinkingToggleText,
                      isThinkingEnabled
                        ? {color: theme.colors.onPrimary}
                        : {color: onSurfaceColorVariant},
                    ]}>
                    {supportsEffort && isThinkingEnabled && reasoningEffort
                      ? localizedEffort
                      : l10n.components.chatInput.thinkingToggle.thinkText}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Right Controls */}
            <View style={styles.rightControls}>
              {/* Helper text for model not loaded / 编辑空指令提示 */}
              {(showModelWarning && !hasActiveModel) ||
              (showEditHint && !!editSourceUri) ? (
                <View style={styles.helperTextContainer}>
                  <Text variant="bodySmall" style={styles.helperText}>
                    {showModelWarning && !hasActiveModel
                      ? l10n.chat.cannotSendWithoutModel
                      : '请描述想修改哪里，例如：把背景改成海边'}
                  </Text>
                </View>
              ) : null}

              {/* Send/Stop/Voice Button：空输入且语音可用→麦克风；录音中→红色停止；
                  有文字→发送（一打字即切换） */}
              {isStopVisible ? (
                // §18.4 停止=error 红底+onError 图标（与发送钮同规格，仅语义色差异）
                <StopButton onPress={onStopPress} />
              ) : isVideoCapable && !isCameraActive ? (
                /* Compact Start Video Button for Video Pals */
                <TouchableOpacity
                  style={[
                    styles.compactVideoButton,
                    {
                      backgroundColor: onSurfaceColor,
                    },
                  ]}
                  onPress={onStartCamera}
                  accessibilityLabel="Start video analysis"
                  accessibilityRole="button">
                  <VideoRecorderIcon
                    width={16}
                    height={16}
                    stroke="white"
                    strokeWidth={2}
                  />
                  <Text style={styles.compactButtonText}>
                    {l10n.video.startCamera}
                  </Text>
                </TouchableOpacity>
              ) : isListening ? (
                <TouchableOpacity
                  testID="voice-stop-button"
                  style={[
                    styles.voiceButton,
                    {backgroundColor: theme.colors.error},
                  ]}
                  onPress={handleVoiceToggle}
                  accessibilityLabel={
                    l10n.components.chatInput.voiceInput.stopListening
                  }
                  accessibilityRole="button">
                  <StopIcon
                    width={18}
                    height={18}
                    // B56②登记：error 底白 icon（onError dark 为深棕字不适配白图标，保持）
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              ) : showVoiceButton ? (
                <TouchableOpacity
                  testID="voice-input-button"
                  style={[
                    styles.voiceButton,
                    {backgroundColor: theme.colors.primary},
                  ]}
                  onPress={handleVoiceToggle}
                  accessibilityLabel={
                    l10n.components.chatInput.voiceInput.startListening
                  }
                  accessibilityRole="button">
                  <MicIcon
                    width={18}
                    height={18}
                    stroke={theme.colors.onPrimary}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              ) : (
                isSendButtonVisible && (
                  // §18.4：状态表达收进 SendButton 内部（enabled 双态描边），
                  // 不再外包 opacity 层
                  <SendButton
                    color={onSurfaceColor}
                    enabled={isSendButtonEnabled}
                    onPress={handleSend}
                  />
                )
              )}
            </View>
          </View>
        </View>
      </View>
    );
  },
);
