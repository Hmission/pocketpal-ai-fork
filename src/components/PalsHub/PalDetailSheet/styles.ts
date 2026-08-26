import {StyleSheet} from 'react-native';
import {Theme} from '../../../utils';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Pal Detail Sheet
    scrollContent: {
      paddingBottom: theme.spacing.ml,
    },
    headerSection: {
      padding: theme.spacing.ml,
      backgroundColor: theme.colors.surface,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.m,
    },
    thumbnailContainer: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.m,
      backgroundColor: theme.colors.surfaceVariant,
      marginRight: theme.spacing.m,
      overflow: 'hidden',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    thumbnailPlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceVariant,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: theme.typography.headlineH2.fontSize, // B56③ 24→headlineH2（补档归档，等值）
      fontWeight: '700',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xs,
      lineHeight: theme.typography.headlineH2.lineHeight, // B56③ lineHeight 同步取 token（等值 28）
    },
    creator: {
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.s,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.s,
    },
    priceLabel: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      marginRight: theme.spacing.sm,
    },
    freeLabel: {
      color: theme.colors.tertiary,
    },
    premiumLabel: {
      color: theme.colors.secondary,
    },
    statsSection: {
      paddingHorizontal: theme.spacing.ml,
      paddingVertical: theme.spacing.m,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: theme.typography.titleM.fontSize, // B56③ fontSize→titleM
      fontWeight: '700',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xs,
    },
    statLabel: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ratingText: {
      fontSize: theme.typography.titleM.fontSize, // B56③ fontSize→titleM
      fontWeight: '700',
      color: theme.colors.onSurface,
      marginLeft: theme.spacing.xs,
    },
    section: {
      paddingHorizontal: theme.spacing.ml,
      paddingVertical: theme.spacing.m,
    },
    sectionTitle: {
      fontSize: theme.typography.titleM.fontSize, // B56③ fontSize→titleM
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.sm,
    },
    description: {
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      lineHeight: 24,
      color: theme.colors.onSurface,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
    },
    tag: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.radius.ml,
      paddingHorizontal: theme.spacing.sm,
      // B56②：6→xs(4)（chip 紧凑垂直内距）
      paddingVertical: theme.spacing.xs,
    },
    tagText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
    },
    categoriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
    },
    category: {
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: theme.radius.l,
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
    },
    categoryText: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onPrimaryContainer,
    },
    systemPromptContainer: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.radius.m,
      padding: theme.spacing.m,
      marginTop: theme.spacing.s,
    },
    systemPrompt: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
      fontFamily: 'monospace',
    },
    protectedContent: {
      backgroundColor: theme.colors.errorContainer,
      borderRadius: theme.radius.m,
      padding: theme.spacing.m,
      alignItems: 'center',
      marginTop: theme.spacing.s,
    },
    protectedText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onErrorContainer,
      textAlign: 'center',
      marginTop: theme.spacing.s,
    },
    primaryButton: {
      flex: 1,
      marginBottom: theme.spacing.sm,
    },
    // Buy button + its checkout feedback stack vertically and fill the row,
    // so a wide error/finalizing message never squeezes the button.
    buyActionColumn: {
      flex: 1,
    },
    buyButton: {
      alignSelf: 'stretch',
    },
    errorButton: {
      alignSelf: 'stretch',
      marginTop: theme.spacing.s,
    },
    errorContainer: {
      backgroundColor: theme.colors.errorContainer,
      borderRadius: theme.radius.s,
      padding: theme.spacing.sm,
      marginTop: theme.spacing.m,
    },
    errorText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onErrorContainer,
      textAlign: 'center',
    },
    divider: {
      marginVertical: theme.spacing.s,
    },
    accountLinkContainer: {
      marginTop: theme.spacing.sm,
      alignItems: 'center',
    },
    infoTextContainer: {
      marginTop: theme.spacing.m,
      alignItems: 'center',
      paddingHorizontal: theme.spacing.ml,
    },
    infoText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });
