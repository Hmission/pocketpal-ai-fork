import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing.m,
    },
    card: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.ml,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      // Add subtle shadow for depth (only in light mode)
      ...(theme.dark
        ? {}
        : {
            shadowColor: theme.colors.shadow,
            shadowOffset: {width: 0, height: 2},
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }),
    },
    cardContent: {
      padding: theme.spacing.sm,
      aspectRatio: 1, // Square aspect ratio - ensures uniform card heights
      justifyContent: 'space-between', // Better space distribution
    },
    thumbnail: {
      width: '100%',
      height: 80, // Increased from 60px for better image display
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: theme.radius.m,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.s, // Reduced from 12px to save space
      position: 'relative',
      overflow: 'hidden',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
      borderRadius: theme.radius.m,
    },
    thumbnailOverlay: {
      position: 'absolute',
      bottom: theme.spacing.xs,
      right: theme.spacing.xs,
      backgroundColor: theme.colors.backdrop,
      borderRadius: theme.radius.s,
      padding: theme.spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnailText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.onPrimaryContainer,
    },

    chatButton: {
      position: 'absolute',
      // B56②：6→xs(4)（贴角偏移）/ 14→full（28px 圆钮半高）
      bottom: theme.spacing.xs,
      right: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.full,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      // Add subtle shadow for prominence
      ...(theme.dark
        ? {
            borderWidth: 1,
            borderColor: theme.colors.outline,
          }
        : {
            shadowColor: theme.colors.shadow,
            shadowOffset: {width: 0, height: 2},
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }),
    },
    localBadge: {
      position: 'absolute',
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      backgroundColor: theme.colors.primary,
      // B56②：20px 圆钮 → full
      borderRadius: theme.radius.full,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    protectionBadge: {
      position: 'absolute',
      top: theme.spacing.xs,
      left: theme.spacing.xs,
      backgroundColor: theme.colors.tertiary,
      borderRadius: theme.radius.s,
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    premiumBadge: {
      position: 'absolute',
      top: theme.spacing.m, // 12px card padding + 4px offset from thumbnail edge
      right: theme.spacing.m, // 12px card padding + 4px offset from thumbnail edge
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.radius.s,
      // B56②：6→xs(4)（chip 紧凑水平内距）
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      minWidth: 40,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10, // Ensure it appears above other elements
    },
    premiumBadgeText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '600',
      color: theme.colors.onSecondary,
      letterSpacing: 0.1,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
      minHeight: 0, // Allow content to shrink
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xxs, // Reduced from 4px
      gap: theme.spacing.xs,
      minHeight: 18, // Ensure minimum height for content
    },
    middleContent: {
      // Fixed height to ensure all cards have uniform height
      // This prevents cards from shrinking when description is short
      height: 60, // Enough for creator + description + warning
      justifyContent: 'flex-start',
    },
    palName: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '600',
      color: theme.colors.onSurface,
      flex: 1,
      lineHeight: 18,
      letterSpacing: 0.1, // Subtle letter spacing for better readability
    },
    priceContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.radius.s,
      // B56②：6→xs(4)（chip 紧凑水平内距）
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      minWidth: 40,
    },
    price: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '600',
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.1,
      textAlign: 'center',
    },
    freePrice: {
      color: theme.colors.onTertiary,
    },
    premiumPrice: {
      color: theme.colors.onSecondary,
    },
    creator: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.xxs, // Reduced from 4px
      fontWeight: '500',
      lineHeight: 14,
    },
    description: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
      lineHeight: 14,
      marginBottom: theme.spacing.xs, // Reduced from 6px
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.xs,
    },
    leftFooter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：3→xs(4)（微距）
      gap: theme.spacing.xs,
    },
    rating: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    reviewCount: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
      fontWeight: '500',
    },
    tagsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      flex: 1,
      justifyContent: 'flex-end',
    },
    tag: {
      height: 18,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.xs,
      backgroundColor: theme.colors.surfaceContainerHigh,
    },
    tagText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
      fontWeight: '500',
    },
    moreTagsText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
      fontWeight: '500',
    },
    nameSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.xs,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    actionButton: {
      margin: 0,
      padding: 0,
      width: 24,
      height: 24,
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
      // B56②：6→xs(4)/3→xs(4)（紧凑 chip 内距）/ radius 6→s(8)（小卡档）
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.errorContainer + '20', // 20% opacity
      borderWidth: 0.5,
      borderColor: theme.colors.error + '40', // 40% opacity
      marginBottom: theme.spacing.xs,
      // Add subtle glow effect in dark mode
      ...(theme.dark
        ? {
            shadowColor: theme.colors.error,
            shadowOffset: {width: 0, height: 0},
            shadowOpacity: 0.15,
            shadowRadius: 4,
          }
        : {}),
    },
    warningIcon: {
      margin: 0,
      padding: 0,
      width: 14,
      height: 14,
    },
    warningText: {
      flex: 1,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      lineHeight: 14,
      color: theme.colors.error,
      fontWeight: '500',
    },
  });
