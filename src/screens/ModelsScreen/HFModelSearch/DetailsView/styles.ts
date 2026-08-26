import {StyleSheet} from 'react-native';

import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
      width: '100%',
      height: '100%',
      padding: theme.spacing.m,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.spacing.m,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.s,
    },
    list: {
      padding: theme.spacing.m,
      paddingTop: 0,
      // R2：100 静态底缘 → xxl（40）。同 SearchView：bottomOffset 为键盘补偿，底缘无遮挡物（完整分区列入下批）
      paddingBottom: theme.spacing.xxl,
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：6→s(8)（周围 gap s 系列）
      marginBottom: theme.spacing.s,
      gap: theme.spacing.s,
    },
    modelAuthor: {
      marginBottom: 0,
    },
    titleContainer: {
      // B56②：10→sm(12)（外层距）
      marginBottom: theme.spacing.sm,
    },
    modelTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    modelTitle: {
      fontWeight: 'bold',
    },
    modelStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    stat: {
      backgroundColor: 'transparent',
      // backgroundColor: theme.colors.surfaceVariant,
    },
    statText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      // color: theme.colors.onSurfaceVariant,
    },
    sectionTitle: {
      fontSize: theme.typography.titleM.fontSize, // B56③ fontSize→titleM
      fontWeight: 'bold',
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.s,
      color: theme.colors.onSurface,
    },
    sectionSubtitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      color: theme.colors.onSurfaceVariant,
    },
  });
