import React, {useContext} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Drawer} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {SessionMetaData} from '../../store';
import {Menu, Checkbox} from '..';
import {
  DotsVerticalIcon,
  DuplicateIcon,
  EditIcon,
  ShareIcon,
  TrashIcon,
} from '../../assets/icons';
import {L10nContext} from '../../utils';
import {Divider} from 'react-native-paper';

interface SessionListItemProps {
  session: SessionMetaData;
  isActive: boolean;
  onPress: (sessionId: string) => void;
  onLongPress: (sessionId: string, event: any) => void;
  menuVisible: string | null;
  menuPosition: {x: number; y: number};
  onMenuDismiss: () => void;
  onPressRename: (session: SessionMetaData) => void;
  onPressDelete: (sessionId: string) => void;
  onPressExport: (sessionId: string) => void;
  onPressSelect: (sessionId: string) => void;
  /** 基于此会话新建（派生） */
  onPressFork: (session: SessionMetaData) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (sessionId: string) => void;
}

/**
 * SessionListItem — 单会话行 + 行尾常驻 ... 菜单（选择模式下隐藏）。
 * ... 点击与长按弹出同一菜单（单一事实源）：重命名/基于此会话新建/导出/删除/选择。
 * memo 化：仅 props 变化重渲，日期分组列表滚动流畅。
 */
export const SessionListItem = React.memo<SessionListItemProps>(
  ({
    session,
    isActive,
    onPress,
    onLongPress,
    menuVisible,
    menuPosition,
    onMenuDismiss,
    onPressRename,
    onPressDelete,
    onPressExport,
    onPressSelect,
    onPressFork,
    isSelectionMode,
    isSelected,
    onToggleSelection,
  }) => {
    const theme = useTheme();
    const styles = createStyles(theme);
    const l10n = useContext(L10nContext);

    const handlePress = () => {
      if (isSelectionMode) {
        onToggleSelection(session.id);
      } else {
        onPress(session.id);
      }
    };

    const handleLongPress = (event: any) => {
      if (!isSelectionMode) {
        onLongPress(session.id, event);
      }
    };

    // ... 按钮：与长按共用同一菜单（锚点=按钮位置）
    const handleMorePress = (event: any) => {
      onLongPress(session.id, event);
    };

    return (
      <View style={styles.sessionItemContainer}>
        {isSelectionMode && (
          <View style={styles.sessionCheckbox}>
            <Checkbox
              checked={isSelected}
              onPress={() => onToggleSelection(session.id)}
              testID={`checkbox-${session.id}`}
            />
          </View>
        )}
        <TouchableOpacity
          onPress={handlePress}
          onLongPress={handleLongPress}
          style={styles.sessionTouchable}>
          <Drawer.Item
            active={isActive}
            label={session.title}
            style={styles.sessionDrawerItem}
          />
        </TouchableOpacity>
        {!isSelectionMode && (
          <TouchableOpacity
            style={styles.sessionMoreButton}
            onPress={handleMorePress}
            testID={`session-more-${session.id}`}
            hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
            <DotsVerticalIcon stroke={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
        {!isSelectionMode && (
          <Menu
            visible={menuVisible === session.id}
            onDismiss={onMenuDismiss}
            anchor={menuPosition}
            style={styles.menu}
            contentStyle={{}}
            anchorPosition="bottom">
            <Menu.Item
              onPress={() => {
                onPressRename(session);
                onMenuDismiss();
              }}
              label={l10n.common.rename}
              leadingIcon={() => <EditIcon stroke={theme.colors.primary} />}
            />
            <Menu.Item
              onPress={() => {
                onPressFork(session);
                onMenuDismiss();
              }}
              label={l10n.components.sidebarContent.forkSession}
              leadingIcon={() => (
                <DuplicateIcon stroke={theme.colors.primary} />
              )}
            />
            <Menu.Item
              onPress={() => {
                onPressExport(session.id);
                onMenuDismiss();
              }}
              label={l10n.common.export}
              leadingIcon={() => <ShareIcon stroke={theme.colors.primary} />}
            />
            <Menu.Item
              onPress={() => {
                onPressDelete(session.id);
                onMenuDismiss();
              }}
              label={l10n.common.delete}
              labelStyle={{color: theme.colors.error}}
              leadingIcon={() => <TrashIcon stroke={theme.colors.error} />}
            />
            <Divider style={styles.menuDivider} />
            <Menu.Item
              onPress={() => {
                onPressSelect(session.id);
                onMenuDismiss();
              }}
              label={`${l10n.components.sidebarContent.select}...`}
            />
          </Menu>
        )}
      </View>
    );
  },
);

SessionListItem.displayName = 'SessionListItem';
