import {StyleSheet} from 'react-native';

import {Theme} from '../../../../../utils/types';

export const createStyles = (theme: Theme, isProjectionModel) =>
  StyleSheet.create({
    fileCardContainer: {
      // B56②：6→xs(4)（紧凑卡距）
      marginVertical: theme.spacing.xs,
      backgroundColor: isProjectionModel
        ? theme.colors.tertiaryContainer
        : theme.colors.surfaceVariant,
      borderRadius: theme.radius.m,
      overflow: 'hidden', // Important for gradient containment
      position: 'relative', // For absolute positioning of gradient
    },
    gradientBackground: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      height: '100%', // Ensures full height
      borderRadius: theme.radius.s,
    },
    fileContent: {
      padding: theme.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
      //marginBottom: 4,
    },
    fileInfo: {
      flex: 1,
      marginRight: theme.spacing.xs,
    },
    fileNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    fileName: {
      //fontSize: 14,
      color: isProjectionModel
        ? theme.colors.onTertiaryContainer
        : theme.colors.onSurface,
      letterSpacing: -0.2,
      flex: 1,
    },
    metadataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：6→xs(4)（行内紧凑 gap）
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
      flexWrap: 'wrap',
    },
    visionChipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
      marginTop: theme.spacing.xs,
      flexWrap: 'wrap',
      //backgroundColor: 'red',
    },
    fileSize: {
      fontSize: theme.typography.bodyS.fontSize,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.9,
    },
    fileActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: -4,
    },
    downloadSpeed: {
      //fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      //fontWeight: '500',
    },
    fileSizeSeparator: {
      fontSize: theme.typography.bodyS.fontSize,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.5,
    },
    warningChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.errorContainer,
      borderRadius: theme.radius.m,
      paddingVertical: theme.spacing.xxs,
      // B56②：6→xs(4)（chip 紧凑水平内距）
      paddingHorizontal: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    warningIcon: {
      width: 14,
      height: 14,
      margin: 0,
    },
    warningText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.onErrorContainer,
      fontWeight: '500',
    },
    // B57：progressContainer/progressBar/progressFill 为死键（JSX 只走
    // LinearGradient 进度覆盖层，见 ModelFileCard.tsx），随迁删除。
    snackbarContent: {
      flexDirection: 'column',
      gap: theme.spacing.xs,
    },
    snackbarText: {
      color: theme.colors.inverseOnSurface,
    },
    snackbarContainer: {
      marginBottom: theme.spacing.s,
      width: '90%',
      alignSelf: 'center',
    },
    gatedText: {
      color: theme.colors.primary,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
    },
    visionChip: {
      backgroundColor: 'transparent',
      marginStart: 0,
      // borderColor: theme.colors.primary + '50',
      //height: 24,
    },
    visionChipText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.text,
      fontWeight: '500',
    },
  });
