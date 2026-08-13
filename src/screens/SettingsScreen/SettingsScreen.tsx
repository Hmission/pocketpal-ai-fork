import React, {useContext} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {useNavigation} from '@react-navigation/native';
import {List, Divider} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {L10nContext} from '../../utils';
import {ROUTES} from '../../utils/navigationConstants';
import {Theme} from '../../utils/types';
import {
  AppInfoIcon,
  AtomIcon,
  BenchmarkIcon,
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

// Settings entry hub: every non-chat entry point lives here. The drawer is
// reserved for chat sessions; all feature screens are reached through this
// page instead.
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  const menuItems = l10n.components.sidebarContent.menuItems;

  const navigateTo = (route: string) => () => {
    navigation.navigate(route);
  };

  return (
    <ScrollView style={styles.container}>
      {/* AIOS 功能组：伙伴 / 模型 / 记忆 / 知识库 / 智能体 / 工具配置 */}
      <List.Section title={l10n.components.sidebarContent.groupAios}>
        <List.Item
          title={menuItems.pals}
          left={props => <List.Icon {...props} icon={() => <PalIcon stroke={theme.colors.primary} />} />}
          onPress={navigateTo(ROUTES.PALS)}
          style={styles.item}
          testID="settings-item-pals"
        />
        <List.Item
          title={menuItems.models}
          left={props => <List.Icon {...props} icon={() => <ModelIcon stroke={theme.colors.primary} />} />}
          onPress={navigateTo(ROUTES.MODELS)}
          style={styles.item}
          testID="settings-item-models"
        />
        <List.Item
          title={menuItems.memory}
          left={props => (
            <List.Icon
              {...props}
              icon={() => (
                <HeartIcon width={24} height={24} stroke={theme.colors.primary} />
              )}
            />
          )}
          onPress={navigateTo(ROUTES.MEMORY)}
          style={styles.item}
          testID="settings-item-memory"
        />
        <List.Item
          title={menuItems.knowledge}
          left={props => (
            <List.Icon
              {...props}
              icon={() => (
                <GridIcon width={24} height={24} stroke={theme.colors.primary} />
              )}
            />
          )}
          onPress={navigateTo(ROUTES.KNOWLEDGE)}
          style={styles.item}
          testID="settings-item-knowledge"
        />
        <List.Item
          title={menuItems.workspace}
          left={props => (
            <List.Icon
              {...props}
              icon={() => (
                <EditBoxIcon width={24} height={24} stroke={theme.colors.primary} />
              )}
            />
          )}
          onPress={navigateTo(ROUTES.WORKSPACE)}
          style={styles.item}
          testID="settings-item-workspace"
        />
        <List.Item
          title={menuItems.tool}
          left={props => (
            <List.Icon
              {...props}
              icon={() => (
                <AtomIcon width={24} height={24} stroke={theme.colors.primary} />
              )}
            />
          )}
          onPress={navigateTo(ROUTES.TOOL)}
          style={styles.item}
          testID="settings-item-tool"
        />
      </List.Section>

      <Divider style={styles.divider} />

      {/* 系统组：基准测试 / 生成设置 / 关于 / Dev Tools */}
      <List.Section title={l10n.components.sidebarContent.groupSystem}>
        <List.Item
          title={menuItems.benchmark}
          left={props => <List.Icon {...props} icon={() => <BenchmarkIcon stroke={theme.colors.primary} />} />}
          onPress={navigateTo(ROUTES.BENCHMARK)}
          style={styles.item}
          testID="settings-item-benchmark"
        />
        <List.Item
          title={menuItems.generationSettings}
          left={props => (
            <List.Icon
              {...props}
              icon={() => (
                <SettingsIcon
                  width={24}
                  height={24}
                  stroke={theme.colors.primary}
                />
              )}
            />
          )}
          onPress={navigateTo(ROUTES.GENERATION_SETTINGS)}
          style={styles.item}
          testID="settings-item-generation-settings"
        />
        <List.Item
          title={menuItems.appInfo}
          left={props => (
            <List.Icon
              {...props}
              icon={() => (
                <AppInfoIcon
                  width={24}
                  height={24}
                  stroke={theme.colors.primary}
                />
              )}
            />
          )}
          onPress={navigateTo(ROUTES.APP_INFO)}
          style={styles.item}
          testID="settings-item-appinfo"
        />
        {/* Only show Dev Tools in debug mode */}
        {isDebugMode && (
          <List.Item
            title="Dev Tools"
            left={props => (
              <List.Icon
                {...props}
                icon={() => (
                  <CodeIcon
                    width={24}
                    height={24}
                    stroke={theme.colors.primary}
                  />
                )}
              />
            )}
            onPress={navigateTo(ROUTES.DEV_TOOLS)}
            style={styles.item}
            testID="settings-item-devtools"
          />
        )}
      </List.Section>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    item: {
      height: 52,
    },
    divider: {
      marginHorizontal: 16,
      backgroundColor: theme.colors.onSurfaceVariant,
      opacity: 0.1,
    },
  });
