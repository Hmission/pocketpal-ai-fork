import {StyleSheet} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';

import {getUserAvatarNameColor} from '../../utils';
import {MessageType, Theme, User} from '../../utils/types';

export const styles = ({
  message,
  theme,
  user,
  insets,
}: {
  message: MessageType.Text | MessageType.AssistantTurn;
  theme: Theme;
  user?: User;
  insets: EdgeInsets;
}) =>
  StyleSheet.create({
    descriptionText: {
      ...(user?.id === message.author.id
        ? theme.fonts.sentMessageLinkDescriptionTextStyle
        : theme.fonts.receivedMessageLinkDescriptionTextStyle),
      marginTop: theme.spacing.xs,
    },
    headerText: {
      ...theme.fonts.userNameTextStyle,
      color: getUserAvatarNameColor(
        message.author,
        theme.colors.userAvatarNameColors,
      ),
      // B56②：6→xs(4)（紧凑标题距）
      marginBottom: theme.spacing.xs,
    },
    titleText: {
      ...(user?.id === message.author.id
        ? theme.fonts.sentMessageLinkTitleTextStyle
        : theme.fonts.receivedMessageLinkTitleTextStyle),
    },
    text: {
      // legacy fonts 双轨收口（DESIGN_SPEC §8 B1）：消息正文改用 theme.typography.bodyM
      ...theme.typography.bodyM,
    },
    textContainer: {
      // 左右缩进：助手消息与用户消息同规格（≈2 字符当量），文本不贴气泡边缘
      marginHorizontal: theme.insets.messageInsetsHorizontal,
      marginVertical: theme.insets.messageInsetsVertical,
    },
    imageContainer: {
      marginBottom: theme.spacing.s,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
    },
    // 气泡内动作槽（ADR-0003 同构）：hairline 分隔，动作胶囊贴卡片底部
    actionsSlot: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
      opacity: 0.9,
      marginHorizontal: theme.insets.messageInsetsHorizontal,
      paddingTop: theme.spacing.s,
      paddingBottom: theme.spacing.xs,
    },
    imageThumbnail: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.s,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceVariant,
    },
    // 单图撑满卡片宽度（生图任务卡等）：方图框 + contain，与生图页预览同视觉；
    // 多图仍走上方 80×80 缩略图网格。
    imageThumbnailWide: {
      width: '100%',
      aspectRatio: 1,
    },
    imageContent: {
      width: '100%',
      height: '100%',
    },
    imagePreviewModal: {
      flex: 1,
      // 全屏查看器遮罩：backdrop token（DESIGN_SPEC §12.6）
      backgroundColor: theme.colors.backdrop,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagePreviewCloseButton: {
      position: 'absolute',
      // B58：insets 感知（刘海机/挖孔屏不贴槽），右缘归 spacing.ml 档
      top: insets.top + theme.spacing.m,
      right: theme.spacing.ml,
      zIndex: 1,
    },
    imagePreviewContent: {
      width: '100%',
      height: '80%',
    },
    imagePreviewSaveButton: {
      position: 'absolute',
      // B58：insets 感知（底部手势条设备不贴条）
      bottom: insets.bottom + theme.spacing.m,
      alignSelf: 'center',
      // R5 裁定：28→xl（32）——全屏查看器大按钮取宽松内距档
      paddingHorizontal: theme.spacing.xl,
      // B56②：10→s(8)（按钮垂直内距紧凑，同 viewerEditButton 裁定）
      paddingVertical: theme.spacing.s,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.primary,
      zIndex: 1,
    },
    imagePreviewSaveText: {
      color: theme.colors.onPrimary,
      fontSize: theme.typography.bodyM.fontSize,
      fontWeight: '600',
    },
  });
