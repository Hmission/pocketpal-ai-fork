import React, {useContext} from 'react';
import {Animated, ScrollView, StyleSheet, Text} from 'react-native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {useNavigation} from '@react-navigation/native';

import {useTheme, useStaggerEntry} from '../../hooks';
import {L10nContext} from '../../utils';
import {ROUTES} from '../../utils/navigationConstants';
import {Theme} from '../../utils/types';
import {Surface, IconTile, PressableScale} from '../../components/ui';
import {
  AppInfoIcon,
  AtomIcon,
  BenchmarkIcon,
  ChevronRightIcon,
  CodeIcon,
  EditBoxIcon,
  GridIcon,
  HeartIcon,
  ModelIcon,
  PalIcon,
  SettingsIcon,
} from '../../assets/icons';

// Check if app is in debug mode
const isDebugMode = __DEV__;

// 行 = IconTile + 标题 + chevron（DESIGN_SPEC §3 三段式）。
// 模块级组件：避免每次渲染重建子树（react/no-unstable-nested-components）。
const Row = ({
  testID,
  title,
  Icon,
  color,
  onPress,
  styles,
  chevronColor,
}: {
  testID: string;
  title: string;
  Icon: React.ComponentType<{
    width?: number;
    height?: number;
    stroke?: string;
  }>;
  color: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  chevronColor: string;
}) => (
  <PressableScale style={styles.row} onPress={onPress} testID={testID}>
    <IconTile icon={Icon} color={color} />
    <Text style={styles.rowTitle}>{title}</Text>
    <ChevronRightIcon width={18} height={18} stroke={chevronColor} />
  </PressableScale>
);

// Settings entry hub: every non-chat entry point lives here. The drawer is
// reserved for chat sessions; all feature screens are reached through this
// page instead.
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  const menuItems = l10n.components.sidebarContent.menuItems;
  // 分组错峰入场（DESIGN_SPEC §5：一次性、不循环）
  const staggerA = useStaggerEntry(0, 80);
  const staggerB = useStaggerEntry(1, 80);

  const navigateTo = (route: string) => () => {
    navigation.navigate(route);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* AIOS 功能组：伙伴 / 模型 / 记忆 / 知识库 / 智能体 / 工具配置 */}
      <Animated.View style={[styles.section, staggerA]}>
        <Text style={styles.sectionTitle}>
          {l10n.components.sidebarContent.groupAios}
        </Text>
        <Surface radius="l" elevation={0} style={styles.card}>
          {/* 伙伴入口已裁剪（2026-08-15）：功能暂不启用，如需恢复见 git 历史 */}
          <Row
            testID="settings-item-models"
            title={menuItems.models}
            Icon={ModelIcon}
            color={theme.colors.secondary}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.MODELS)}
          />
          <Row
            testID="settings-item-memory"
            title={menuItems.memory}
            Icon={HeartIcon}
            color={theme.colors.domain.memory}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.MEMORY)}
          />
          <Row
            testID="settings-item-knowledge"
            title={menuItems.knowledge}
            Icon={GridIcon}
            color={theme.colors.domain.knowledge}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.KNOWLEDGE)}
          />
          <Row
            testID="settings-item-workspace"
            title={menuItems.workspace}
            Icon={EditBoxIcon}
            color={theme.colors.domain.workspace}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.WORKSPACE)}
          />
          <Row
            testID="settings-item-tool"
            title={menuItems.tool}
            Icon={AtomIcon}
            color={theme.colors.domain.tools}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.TOOL)}
          />
        </Surface>
      </Animated.View>

      {/* 系统组：基准测试 / 生成设置 / 关于 / Dev Tools */}
      <Animated.View style={[styles.section, staggerB]}>
        <Text style={styles.sectionTitle}>
          {l10n.components.sidebarContent.groupSystem}
        </Text>
        <Surface radius="l" elevation={0} style={styles.card}>
          <Row
            testID="settings-item-benchmark"
            title={menuItems.benchmark}
            Icon={BenchmarkIcon}
            color={theme.colors.tertiary}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.BENCHMARK)}
          />
          <Row
            testID="settings-item-generation-settings"
            title={menuItems.generationSettings}
            Icon={SettingsIcon}
            color={theme.colors.primary}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.GENERATION_SETTINGS)}
          />
          <Row
            testID="settings-item-appinfo"
            title={menuItems.appInfo}
            Icon={AppInfoIcon}
            color={theme.colors.onSurfaceVariant}
            styles={styles}
            chevronColor={theme.colors.onSurfaceVariant}
            onPress={navigateTo(ROUTES.APP_INFO)}
          />
          {isDebugMode && (
            <Row
              testID="settings-item-devtools"
              title="Dev Tools"
              Icon={CodeIcon}
              color={theme.colors.domain.tools}
              styles={styles}
              chevronColor={theme.colors.onSurfaceVariant}
              onPress={navigateTo(ROUTES.DEV_TOOLS)}
            />
          )}
        </Surface>
      </Animated.View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.m,
      gap: theme.spacing.l,
    },
    section: {
      gap: theme.spacing.s,
    },
    sectionTitle: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      marginHorizontal: theme.spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.m,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    rowTitle: {
      flex: 1,
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
    },
  });
