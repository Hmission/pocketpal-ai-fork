import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const styles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    // §18.2 双行合并：列容器，行1 动作行 + 行2 统一指标行
    container: {
      marginTop: theme.spacing.xs,
      // 与正文同一水平缩进 token：按钮组对齐文本左缘，不再贴卡片边缘
      marginHorizontal: theme.insets.messageInsetsHorizontal,
      // B56②：6→xs(4)（紧凑底部距）
      paddingBottom: theme.spacing.xs,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      // 固定高度：复制 icon(16) 统一基线，不随内容跳动
      height: 24,
      // task-6ad §20.4：播放/复制/重新生成间距加大防误触（图标 16px 与 hitSlop 14 不变）
      // B56②：14→m(16)（防误触刻意间距取大档，差 2px 不弱化意图）
      gap: theme.spacing.m,
    },
    // 重新生成禁用态（agent 运行中 / 无激活模型）
    actionDisabled: {
      opacity: 0.35,
    },
    interruptedStatus: {
      color: theme.colors.error,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
    },
    // ── 行2：统一指标行（排版契约：captionS；数值 brandAccent 600；
    //    标签 textSecondary；分隔符 `·` outlineVariant）──
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: theme.spacing.xxs,
      // 按钮栏与信息栏之间 hairline 分隔（v4.3，与动作槽 actionsSlot 同分隔语言）
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
      paddingTop: theme.spacing.xxs,
    },
    metricsSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    metricsLabel: {
      ...theme.typography.captionS,
      color: theme.colors.textSecondary,
    },
    // 性能数字：品牌色强调（小黄鸡暖黄）
    metricsValue: {
      ...theme.typography.captionS,
      color: theme.colors.brandAccent,
      fontWeight: '600',
    },
    metricsSeparator: {
      ...theme.typography.captionS,
      color: theme.colors.outlineVariant,
      marginHorizontal: theme.spacing.xs,
    },
    // tok/s 迷你速率条（B39 跑分图示）：24px 轨道 + 品牌色填充，
    // 与数值同源（宽度按满量程归一，显示层不改数值）
    rateBarTrack: {
      width: 24,
      height: 4,
      borderRadius: theme.radius.xxs,
      backgroundColor: theme.colors.surfaceContainerHighest,
      overflow: 'hidden',
    },
    rateBarFill: {
      height: 4,
      borderRadius: theme.radius.xxs,
      backgroundColor: theme.colors.brandAccent,
    },
    // B40 §11.3 指标图形化展开层：双层曲线 + 摘要行，占满卡片宽不越界；
    // 顶部 hairline 与指标行同分隔语言（无描边类 AI 风）。
    perfExpand: {
      marginTop: theme.spacing.xxs,
      paddingTop: theme.spacing.xxs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
    },
    perfExpandStats: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing.s,
      marginTop: theme.spacing.xxs,
    },
    // 召回片段预览（默认折叠，点按展开）
    recallPreview: {
      marginTop: theme.spacing.xxs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: theme.radius.xs,
      gap: theme.spacing.xxs,
    },
    recallText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 14,
    },
  });
