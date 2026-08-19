import * as React from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Animated,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {useCameraPermission} from 'react-native-vision-camera';
import Voice from '@react-native-voice/voice';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {observer} from 'mobx-react';
import {IconButton, Text} from 'react-native-paper';

import {hasVideoCapability} from '../../utils/pal-capabilities';

import {
  VideoRecorderIcon,
  PlusIcon,
  AtomIcon,
  MicIcon,
  StopIcon,
} from '../../assets/icons';

import {useTheme} from '../../hooks';

import {createStyles} from './styles';

import {chatSessionStore, modelStore, palStore} from '../../store';
import {promptWriter} from '../../services/promptWriter';
import {imageGenStore} from '../../store/imageGenStore';

import {MessageType} from '../../utils/types';
import {L10nContext, UserContext} from '../../utils';
import {t} from '../../locales';

import {SendButton, StopButton, Menu} from '..';

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
    inputBackgroundColor,
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
    // 语音输入（设备级 STT）：服务可用时输入为空→麦克风按钮，录音中转文字填入输入框
    const [isVoiceSupported, setIsVoiceSupported] = React.useState(false);
    const [isListening, setIsListening] = React.useState(false);
    // 编辑源图状态（P5）：外部受控；发送/取消后由 ChatView 复位
    const [showEditPickerMenu, setShowEditPickerMenu] = React.useState(false);
    const [showEditHint, setShowEditHint] = React.useState(false); // 编辑空指令轻提示
    // 快捷前缀标签（P5 v3 图标语义）：点「图像生成/图片编辑/做个玩具/来场冒险」→ 输入区顶部显示彩色前缀 chip，
    // 不可逐字编辑（× 整体删除，破坏一个字符即失效）；发送时拼接成完整文本（路由/编辑剥离），
    // 模型只收主体。前缀不是输入文本——不占 value，天然绕开受控组件。
    const [quickPrefix, setQuickPrefix] = React.useState<
      '图像生成' | '图片编辑' | '做个玩具' | '来场冒险' | null
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

    // 语音识别事件回调需要最新 handleChangeText（识别结果/实时 partial 填入输入框），
    // 用 ref 持有避免 useEffect 重复绑定（事件处理器只在挂载时绑定一次）。
    const handleChangeTextRef = React.useRef(handleChangeText);
    handleChangeTextRef.current = handleChangeText;

    // 设备级语音识别（STT，与模型是否多模态无关）：检查系统识别服务可用性，
    // 绑定事件；卸载时销毁识别器释放麦克风。
    React.useEffect(() => {
      let mounted = true;
      Voice.isAvailable()
        .then(available => {
          if (mounted) {
            setIsVoiceSupported(!!available);
          }
        })
        .catch(() => {
          if (mounted) {
            setIsVoiceSupported(false);
          }
        });

      Voice.onSpeechStart = () => {
        if (mounted) {
          setIsListening(true);
        }
      };
      Voice.onSpeechEnd = () => {
        if (mounted) {
          setIsListening(false);
        }
      };
      Voice.onSpeechResults = e => {
        if (mounted && e?.value?.[0]) {
          handleChangeTextRef.current(e.value[0]);
        }
      };
      Voice.onSpeechPartialResults = e => {
        if (mounted && e?.value?.[0]) {
          handleChangeTextRef.current(e.value[0]);
        }
      };
      Voice.onSpeechError = () => {
        if (mounted) {
          setIsListening(false);
        }
      };
      return () => {
        mounted = false;
        Voice.destroy().catch(() => {});
      };
    }, []);

    // 语音按钮：录音中点击=停止（保留已识别文字）；空闲点击=开始识别
    const handleVoiceToggle = () => {
      if (isListening) {
        Voice.stop().catch(() => {});
        setIsListening(false);
        return;
      }
      Voice.start(undefined, {
        EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
        EXTRA_PARTIAL_RESULTS: true,
      }).catch(() => setIsListening(false));
    };

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
            Alert.alert(
              l10n.camera.permissionTitle,
              l10n.camera.permissionMessage,
            );
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
        Alert.alert(
          l10n.errors.cameraErrorTitle,
          l10n.errors.cameraErrorMessage,
        );
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
        Alert.alert(
          l10n.errors.galleryErrorTitle,
          l10n.errors.galleryErrorMessage,
        );
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
              Alert.alert(
                l10n.camera.permissionTitle,
                l10n.camera.permissionMessage,
              );
              setShowEditPickerMenu(false);
              return;
            }
          }
          modelStore.disableAutoRelease('camera-photo');
          const result = await launchCamera({mediaType: 'photo', quality: 0.8});
          if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
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
          if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
            onEditSourceChange?.(result.assets[0].uri);
            setQuickPrefix('图片编辑');
            inputRef.current?.focus();
          }
        }
        setShowEditPickerMenu(false);
      } catch (error) {
        console.error('Error picking edit image:', error);
        Alert.alert(
          l10n.errors.galleryErrorTitle,
          l10n.errors.galleryErrorMessage,
        );
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
    // 语音输入按钮：输入为空且系统识别服务可用时顶替发送钮；一打字即变回发送
    const showVoiceButton =
      isVoiceSupported &&
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
                size={16}
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
                      size={20}
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
                style={[styles.quickIconBtn, {opacity: busy ? 0.4 : 1}]}
                disabled={busy}
                onPress={() => {
                  setQuickPrefix('图像生成');
                  onEditSourceChange?.(null); // 退出编辑模式（若有残留源图）
                  inputRef.current?.focus();
                }}
                accessibilityLabel="图像生成"
                accessibilityRole="button">
                <Icon name="palette" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              {/* 玩具工坊（P8，PLAY_SPEC）：玩法引导入口——「做个玩具」前缀路由 play 任务 */}
              <TouchableOpacity
                testID="toy-quick-gen"
                style={[styles.quickIconBtn, {opacity: busy ? 0.4 : 1}]}
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
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              {/* TRPG 城主（P12 v1.1，ADVENTURE_SPEC）：冒险玩法引导入口——「来场冒险」前缀路由 adventure 任务 */}
              <TouchableOpacity
                testID="adventure-quick-gen"
                style={[styles.quickIconBtn, {opacity: busy ? 0.4 : 1}]}
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
                  size={20}
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
                    style={[styles.quickIconBtn, {opacity: busy ? 0.4 : 1}]}
                    disabled={busy}
                    onPress={() => setShowEditPickerMenu(true)}
                    accessibilityLabel="图片编辑"
                    accessibilityRole="button">
                    <Icon
                      name="image-edit-outline"
                      size={20}
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
                    isThinkingEnabled && {backgroundColor: theme.colors.primary},
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
