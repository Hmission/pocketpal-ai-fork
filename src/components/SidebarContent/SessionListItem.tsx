import React, {useContext} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Drawer} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {withOpacity} from '../../utils/colorUtils';
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

/**
 * 菜单行内图标（模块级 render helper）：避免在渲染期定义组件触发
 * react/no-unstable-nested-components；按 kind 返回对应图标元素。
 */
const renderMenuLeadingIcon = (
  kind: 'edit' | 'fork' | 'export' | 'delete',
  color: string,
) => {
  switch (kind) {
    case 'edit':
      return <EditIcon stroke={color} />;
    case 'fork':
      return <DuplicateIcon stroke={color} />;
    case 'export':
      return <ShareIcon stroke={color} />;
    default:
      return <TrashIcon stroke={color} />;
  }
};

interface SessionListItemProps {
  session: SessionMetaData;
  isActive: boolean;
  onPress: (sessionId: string) => void;
  onLongPress: (sessionId: string, event: any) => void;
  menuVisible: string | null;
  menuPosition: {x: number; y: number};
  /** 菜单序列号（每次打开递增）：Menu key 强制重建，消除受控竞态残留 */
  menuSeq: number;
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
    /** 菜单序列号（每次打开递增）：作为 Menu key 强制重建，消除受控竞态残留 */
    menuSeq,
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
            theme={
              isActive
                ? {
                    // 灰色治理（DESIGN_SPEC §1.8）：选中态改域彩 12% 底，不再用 surfaceVariant
                    colors: {
                      secondaryContainer: withOpacity(
                        theme.colors.primary,
                        0.12,
                      ),
                    },
                  }
                : undefined
            }
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
            key={`${session.id}-${menuSeq}`}
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
              leadingIcon={() =>
                renderMenuLeadingIcon('edit', theme.colors.primary)
              }
            />
            <Menu.Item
              onPress={() => {
                onPressFork(session);
                onMenuDismiss();
              }}
              label={l10n.components.sidebarContent.forkSession}
              leadingIcon={() =>
                renderMenuLeadingIcon('fork', theme.colors.primary)
              }
            />
            <Menu.Item
              onPress={() => {
                onPressExport(session.id);
                onMenuDismiss();
              }}
              label={l10n.common.export}
              leadingIcon={() =>
                renderMenuLeadingIcon('export', theme.colors.primary)
              }
            />
            <Menu.Item
              onPress={() => {
                onPressDelete(session.id);
                onMenuDismiss();
              }}
              label={l10n.common.delete}
              labelStyle={{color: theme.colors.error}}
              leadingIcon={() =>
                renderMenuLeadingIcon('delete', theme.colors.error)
              }
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
