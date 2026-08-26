import * as React from 'react';
import {
  Linking,
  Text,
  View,
  Image,
  TouchableOpacity,
  Modal,
} from 'react-native';

import ParsedText from 'react-native-parsed-text';
import {
  LinkPreview,
  PreviewData,
  REGEX_LINK,
} from '@flyerhq/react-native-link-preview';

import {useTheme} from '../../hooks';
import {infoDialog} from '../ui/InfoDialog';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {styles} from './styles';
import {MarkdownView} from '../MarkdownView';
import {XIcon} from '../../assets/icons';

import {AgentStep, MessageType} from '../../utils/types';
import {
  excludeDerivedMessageProps,
  getUserName,
  L10nContext,
  UserContext,
} from '../../utils';
import {imageGenStore} from '../../store/imageGenStore';

export interface TextMessageTopLevelProps {
  /** @see {@link LinkPreviewProps.onPreviewDataFetched} */
  onPreviewDataFetched?: ({
    message,
    previewData,
  }: {
    message: MessageType.Text;
    previewData: PreviewData;
  }) => void;
  /** Enables link (URL) preview */
  usePreviewData?: boolean;
  /**
   * 气泡内动作槽（生图任务动作条等，ADR-0003 同构）：收进卡片底部，
   * 带顶部 hairline 分隔，动作胶囊不再悬浮卡片外。
   */
  actions?: React.ReactNode;
}

export interface TextMessageProps extends TextMessageTopLevelProps {
  enableAnimation?: boolean;
  /**
   * Either a legacy `Text` row, or an `AssistantTurn` row when paired
   * with a `step`. The component reads `author` / `previewData` /
   * `metadata` from `message` regardless; `text` is only consulted
   * when `step` is undefined.
   */
  message: MessageType.DerivedText | MessageType.DerivedAssistantTurn;
  messageWidth: number;
  showName: boolean;
  /**
   * When provided, the component renders this step's `content` in
   * place of `message.text`. Set by the AssistantTurn renderer for
   * each step within a turn — same component, per-step content.
   * Reasoning is rendered separately via ReasoningBlock.
   */
  step?: AgentStep;
}

export const TextMessage = ({
  enableAnimation,
  message,
  messageWidth,
  onPreviewDataFetched,
  showName,
  usePreviewData,
  step,
  actions,
}: TextMessageProps) => {
  // For AssistantTurn rendering, the per-step `content` is the
  // authoritative source. For legacy `Text` messages, fall back to
  // `message.text`. Reasoning is rendered separately via
  // ReasoningBlock — TextMessage only owns the content side.
  const visibleText: string = step
    ? (step.content ?? '')
    : 'text' in message
      ? message.text
      : '';
  const theme = useTheme();
  const user = React.useContext(UserContext);
  const l10n = React.useContext(L10nContext);
  const [previewData, setPreviewData] = React.useState(
    'previewData' in message ? message.previewData : undefined,
  );
  const [selectedImageIndex, setSelectedImageIndex] = React.useState<
    number | null
  >(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // B58：全屏查看器锚点 insets 感知（刘海/手势条设备不贴边）
  const insets = useSafeAreaInsets();

  const {
    descriptionText,
    headerText,
    titleText,
    text,
    textContainer,
    imageContainer,
    imageThumbnail,
    imageThumbnailWide,
    imageContent,
    imagePreviewModal,
    imagePreviewCloseButton,
    imagePreviewContent,
    imagePreviewSaveButton,
    imagePreviewSaveText,
    actionsSlot,
  } = styles({
    message,
    theme,
    user,
    insets,
  });

  // Extract imageUris from the message if available
  const imageUris = (message as any).imageUris || [];
  const hasImages = imageUris && imageUris.length > 0;

  const handleEmailPress = (email: string) => {
    try {
      Linking.openURL(`mailto:${email}`);
    } catch {}
  };

  const handlePreviewDataFetched = (data: PreviewData) => {
    setPreviewData(data);
    onPreviewDataFetched?.({
      // It's okay to cast here since we know it is a text message
      // type-coverage:ignore-next-line
      message: excludeDerivedMessageProps(message) as MessageType.Text,
      previewData: data,
    });
  };

  const handleUrlPress = (url: string) => {
    const uri = url.toLowerCase().startsWith('http') ? url : `https://${url}`;

    Linking.openURL(uri);
  };

  const renderPreviewDescription = (description: string) => {
    return (
      <Text numberOfLines={3} style={descriptionText}>
        {description}
      </Text>
    );
  };

  const renderPreviewHeader = (header: string) => {
    return (
      <Text numberOfLines={1} style={headerText}>
        {header}
      </Text>
    );
  };

  const renderPreviewText = (previewText: string) => {
    return (
      <ParsedText
        accessibilityRole="link"
        parse={[
          {
            onPress: handleEmailPress,
            style: [text, {textDecorationLine: 'underline'}],
            type: 'email',
          },
          {
            onPress: handleUrlPress,
            pattern: REGEX_LINK,
            style: [text, {textDecorationLine: 'underline'}],
          },
        ]}
        style={text}>
        {previewText}
      </ParsedText>
    );
  };

  const renderPreviewTitle = (title: string) => {
    return (
      <Text numberOfLines={2} style={titleText}>
        {title}
      </Text>
    );
  };

  // Render image thumbnails（单图撑满卡片宽度；多图保持缩略图网格）
  const renderImages = () => {
    if (!hasImages) {
      return null;
    }
    const single = imageUris.length === 1;

    return (
      <View style={imageContainer}>
        {imageUris.map((uri: string, index: number) => (
          <TouchableOpacity
            key={index}
            testID={`image-thumbnail-${index}`}
            style={[imageThumbnail, single && imageThumbnailWide]}
            onPress={() => setSelectedImageIndex(index)}>
            <Image
              source={{uri}}
              testID={`image-content-${index}`}
              style={imageContent}
              resizeMode={single ? 'contain' : 'cover'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render image preview modal
  const renderImagePreview = () => {
    if (selectedImageIndex === null) {
      return null;
    }

    const previewUri = imageUris[selectedImageIndex];

    // 保存到手机（MediaStore → Pictures/AIOS）：单状态机防重复点击
    const handleSaveToPhone = async () => {
      if (isSaving || !previewUri) {
        return;
      }
      setIsSaving(true);
      const ok = await imageGenStore.saveToAlbum(previewUri);
      setIsSaving(false);
      if (ok) {
        infoDialog({title: l10n.components.textMessage.savedToAlbum});
      } else {
        infoDialog({title: l10n.components.textMessage.saveFailed});
      }
    };

    return (
      <Modal
        visible={selectedImageIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImageIndex(null)}>
        <View style={imagePreviewModal}>
          {/* 全屏查看器关闭钮：自绘 XIcon（DESIGN_SPEC §12.5 图标铁律）；
              深遮罩上恒定白前景（§12.6 全屏豁免登记） */}
          <TouchableOpacity
            testID="image-preview-close"
            style={imagePreviewCloseButton}
            onPress={() => setSelectedImageIndex(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={l10n.common.close}>
            <XIcon width={24} height={24} stroke="#fff" />
          </TouchableOpacity>
          <Image
            source={{uri: previewUri}}
            style={imagePreviewContent}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={imagePreviewSaveButton}
            onPress={handleSaveToPhone}
            disabled={isSaving}
            testID="image-preview-save-button">
            <Text style={imagePreviewSaveText}>
              {isSaving ? '…' : l10n.components.textMessage.saveToPhone}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

  // Link preview only meaningful for legacy Text messages (image-bearing
  // user messages, multimodal). AssistantTurn rendering uses the inline
  // markdown path below.
  const linkPreviewEligible =
    !step &&
    usePreviewData &&
    !!onPreviewDataFetched &&
    visibleText.length > 0 &&
    REGEX_LINK.test(visibleText.toLowerCase());

  return (
    <>
      {linkPreviewEligible ? (
        <LinkPreview
          containerStyle={{
            width: previewData?.image ? messageWidth : undefined,
          }}
          enableAnimation={enableAnimation}
          header={showName ? getUserName(message.author) : undefined}
          onPreviewDataFetched={handlePreviewDataFetched}
          previewData={previewData}
          renderDescription={renderPreviewDescription}
          renderHeader={renderPreviewHeader}
          renderText={renderPreviewText}
          renderTitle={renderPreviewTitle}
          text={visibleText}
          textContainerStyle={textContainer}
          touchableWithoutFeedbackProps={{
            accessibilityRole: undefined,
            accessible: false,
            disabled: true,
          }}
        />
      ) : (
        <View style={textContainer}>
          {
            // Tested inside the link preview
            /* istanbul ignore next */ showName
              ? renderPreviewHeader(getUserName(message.author))
              : null
          }

          {/* Render images above the text — legacy Text path only. */}
          {!step && renderImages()}

          <MarkdownView
            markdownText={visibleText.trim()}
            maxMessageWidth={messageWidth}
            selectable={false}
          />
        </View>
      )}

      {/* Image preview modal — legacy Text path only. */}
      {!step && renderImagePreview()}

      {/* 气泡内动作槽：生图任务动作条收进卡片底部（ADR-0003 同构） */}
      {actions ? <View style={actionsSlot}>{actions}</View> : null}
    </>
  );
};
