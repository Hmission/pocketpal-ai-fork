import React, {useContext, useEffect, useState} from 'react';
import {TouchableOpacity, View, Alert, SectionList} from 'react-native';
import {observer} from 'mobx-react';
import {Divider, Text} from 'react-native-paper';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {DrawerContentComponentProps} from '@react-navigation/drawer';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {chatSessionStore, SessionMetaData} from '../../store';
import {RenameModal} from '..';
import {SettingsIcon} from '../../assets/icons';
import {L10nContext} from '../../utils';
import {t} from '../../locales';
import {confirmDialog} from '../ui/ConfirmDialog';
import {ROUTES} from '../../utils/navigationConstants';
import {exportChatSession} from '../../utils/exportUtils';
import {SessionListItem} from './SessionListItem';
import {SelectionModeBar} from './SelectionModeBar';
import {SessionSearchBar} from './SessionSearchBar';

/**
 * SidebarContent — 抽屉会话中心（编排层）。
 * 顶部：搜索 + 新对话（SessionSearchBar）；中部：日期分组会话列表（SessionListItem）；
 * 选择模式头/全选（SelectionModeBar）；底部固定「齿轮+设置」footer。
 * 各子组件只读 props 渲染，会话 CRUD 动作全部在编排层经 chatSessionStore 受控。
 */
export const SidebarContent: React.FC<DrawerContentComponentProps> = observer(
  props => {
    const [menuVisible, setMenuVisible] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState({x: 0, y: 0});
    const [sessionToRename, setSessionToRename] =
      useState<SessionMetaData | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const theme = useTheme();
    const styles = createStyles(theme);
    const l10n = useContext(L10nContext);
    const insets = useSafeAreaInsets();

    // Convert groupedSessions to SectionList format, filtered by the search
    // query when one is active. observer() HOC handles MobX reactivity,
    // transformation is cheap.
    const query = searchQuery.trim().toLowerCase();
    const sections = Object.entries(chatSessionStore.groupedSessions)
      .map(([dateLabel, sessions]) => ({
        title: dateLabel,
        data: query
          ? sessions.filter(session =>
              session.title.toLowerCase().includes(query),
            )
          : sessions,
      }))
      .filter(({data}) => data.length > 0);

    useEffect(() => {
      chatSessionStore.loadSessionList();

      // Set localized date group names whenever the component mounts
      chatSessionStore.setDateGroupNames(
        l10n.components.sidebarContent.dateGroups,
      );
    }, [l10n.components.sidebarContent.dateGroups]);

    const openMenu = React.useCallback((sessionId: string, event: any) => {
      const {nativeEvent} = event;
      setMenuPosition({x: nativeEvent.pageX, y: nativeEvent.pageY});
      setMenuVisible(sessionId);
    }, []);

    const closeMenu = React.useCallback(() => {
      setMenuVisible(null);
    }, []);

    const handleSessionPress = React.useCallback(
      async (sessionId: string) => {
        await chatSessionStore.setActiveSession(sessionId);
        props.navigation.navigate(ROUTES.CHAT);
      },
      [props.navigation],
    );

    const handleNewChat = React.useCallback(() => {
      chatSessionStore.resetActiveSession();
      props.navigation.navigate(ROUTES.CHAT);
    }, [props.navigation]);

    const handleImageGen = React.useCallback(() => {
      props.navigation.navigate(ROUTES.IMAGE_GEN);
    }, [props.navigation]);

    // 基于当前会话新建（派生）：先激活原会话确保消息已载入，再复制（新会话自动激活）
    const handlePressFork = React.useCallback(
      async (session: SessionMetaData) => {
        closeMenu();
        try {
          await chatSessionStore.setActiveSession(session.id);
          await chatSessionStore.duplicateSession(session.id);
          props.navigation.navigate(ROUTES.CHAT);
        } catch {
          Alert.alert(
            l10n.common.error,
            l10n.components.sidebarContent.exportError,
          );
        }
      },
      [closeMenu, props.navigation, l10n],
    );

    const handleOpenSettings = React.useCallback(() => {
      props.navigation.navigate(ROUTES.SETTINGS);
    }, [props.navigation]);

    const handleSessionLongPress = React.useCallback(
      (sessionId: string, event: any) => {
        openMenu(sessionId, event);
      },
      [openMenu],
    );

    const handlePressRename = React.useCallback(
      (session: SessionMetaData) => {
        setSessionToRename(session);
        closeMenu();
      },
      [closeMenu],
    );

    const onPressDelete = React.useCallback(
      async (sessionId: string) => {
        if (sessionId) {
          const ok = await confirmDialog({
            title: l10n.components.sidebarContent.deleteChatTitle,
            message: l10n.components.sidebarContent.deleteChatMessage,
            confirmText: l10n.common.delete,
            cancelText: l10n.common.cancel,
            destructive: true,
          });
          if (ok) {
            chatSessionStore.resetActiveSession();
            await chatSessionStore.deleteSession(sessionId);
            closeMenu();
          }
        }
      },
      [l10n, closeMenu],
    );

    const handlePressExport = React.useCallback(
      async (sessionId: string) => {
        try {
          await exportChatSession(sessionId);
        } catch {
          Alert.alert(
            l10n.common.error,
            l10n.components.sidebarContent.exportError,
          );
        }
      },
      [l10n],
    );

    const handlePressSelect = React.useCallback(
      (sessionId: string) => {
        chatSessionStore.enterSelectionMode(sessionId);
        closeMenu();
      },
      [closeMenu],
    );

    const handleExitSelectionMode = React.useCallback(() => {
      chatSessionStore.exitSelectionMode();
    }, []);

    const handleToggleSelection = React.useCallback((sessionId: string) => {
      chatSessionStore.toggleSessionSelection(sessionId);
    }, []);

    const handleBulkDelete = React.useCallback(async () => {
      const count = chatSessionStore.selectedCount;

      const ok = await confirmDialog({
        title: l10n.components.sidebarContent.bulkDeleteTitle,
        message: t(l10n.components.sidebarContent.bulkDeleteMessage, {
          count: count.toString(),
        }),
        confirmText: l10n.common.delete,
        cancelText: l10n.common.cancel,
        destructive: true,
      });
      if (ok) {
        try {
          await chatSessionStore.bulkDeleteSessions();
        } catch {
          Alert.alert(
            l10n.common.error,
            l10n.components.sidebarContent.bulkDeleteError,
          );
        }
      }
    }, [l10n]);

    const handleBulkExport = React.useCallback(async () => {
      try {
        await chatSessionStore.bulkExportSessions();
      } catch {
        Alert.alert(
          l10n.common.error,
          l10n.components.sidebarContent.bulkExportError,
        );
      }
    }, [l10n]);

    // Key extractor for SectionList
    const keyExtractor = React.useCallback(
      (item: SessionMetaData) => item.id,
      [],
    );

    // Render section header (date labels)
    const renderSectionHeader = React.useCallback(
      ({section}: {section: {title: string}}) => (
        <View style={styles.drawerSection}>
          <Text variant="bodySmall" style={styles.dateLabel}>
            {section.title}
          </Text>
        </View>
      ),
      [styles.drawerSection, styles.dateLabel],
    );

    // Render session item
    // observer() HOC handles MobX reactivity for chatSessionStore.activeSessionId
    const renderItem = React.useCallback(
      ({item}: {item: SessionMetaData}) => {
        const isActive = chatSessionStore.activeSessionId === item.id;
        const isSelected = chatSessionStore.selectedSessionIds.has(item.id);
        return (
          <SessionListItem
            session={item}
            isActive={isActive}
            onPress={handleSessionPress}
            onLongPress={handleSessionLongPress}
            menuVisible={menuVisible}
            menuPosition={menuPosition}
            onMenuDismiss={closeMenu}
            onPressRename={handlePressRename}
            onPressDelete={onPressDelete}
            onPressExport={handlePressExport}
            onPressSelect={handlePressSelect}
            onPressFork={handlePressFork}
            isSelectionMode={chatSessionStore.isSelectionMode}
            isSelected={isSelected}
            onToggleSelection={handleToggleSelection}
          />
        );
      },
      [
        handleSessionPress,
        handleSessionLongPress,
        menuVisible,
        menuPosition,
        closeMenu,
        handlePressRename,
        onPressDelete,
        handlePressExport,
        handlePressSelect,
        handlePressFork,
        handleToggleSelection,
      ],
    );

    return (
      <GestureHandlerRootView style={styles.sidebarContainer}>
        <View
          style={[
            styles.contentWrapper,
            {paddingTop: insets.top, paddingBottom: insets.bottom},
          ]}>
          {chatSessionStore.isSelectionMode ? (
            <>
              <SelectionModeBar
                selectedCount={chatSessionStore.selectedCount}
                allSelected={chatSessionStore.allSelected}
                onCancel={handleExitSelectionMode}
                onExport={handleBulkExport}
                onDelete={handleBulkDelete}
                onToggleAll={() =>
                  chatSessionStore.allSelected
                    ? chatSessionStore.deselectAllSessions()
                    : chatSessionStore.selectAllSessions()
                }
              />
              <Divider style={styles.selectAllDivider} />
              <SectionList
                sections={sections}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
                style={styles.sessionList}
                contentContainerStyle={styles.scrollViewContent}
              />
            </>
          ) : (
            <>
              {/* 顶部固定区：搜索 + 新对话 */}
              <SessionSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onNewChat={handleNewChat}
                onImageGen={handleImageGen}
              />
              <SectionList
                sections={sections}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
                style={styles.sessionList}
                contentContainerStyle={styles.scrollViewContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  query ? (
                    <View style={styles.emptySearch}>
                      <Text style={styles.emptySearchText}>
                        {l10n.components.sidebarContent.noSearchResults}
                      </Text>
                    </View>
                  ) : null
                }
              />
              {/* 底部固定：齿轮 + 设置 */}
              <TouchableOpacity
                style={styles.drawerFooter}
                onPress={handleOpenSettings}
                testID="drawer-item-settings">
                <SettingsIcon
                  width={24}
                  height={24}
                  stroke={theme.colors.primary}
                />
                <Text style={styles.footerText}>
                  {l10n.components.sidebarContent.menuItems.settings}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <RenameModal
          visible={sessionToRename !== null}
          onClose={() => setSessionToRename(null)}
          session={sessionToRename}
        />
      </GestureHandlerRootView>
    );
  },
);
