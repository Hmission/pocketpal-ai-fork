import * as React from 'react';
import {
  Animated,
  View,
  FlatList,
  Text,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import {Appbar, Button, IconButton, List, Divider} from 'react-native-paper';

import {
  listMemories,
  deleteMemory,
  clearMemories,
  updateMemoryContent,
  getMemoriesFileSize,
  AiosMemory,
} from '../../services/aiosMemory';
import {AIOS_MEMORIES_DIR} from '../../utils/paths';
import {useTheme, useStaggerEntry} from '../../hooks';
import type {Theme} from '../../utils/types';
import {IconTile} from '../../components/ui';
import {L10nContext} from '../../utils';
import {HeartIcon} from '../../assets/icons';

// 记忆行错峰入场（DESIGN_SPEC §5：一次性、不循环；JS driver）
const StaggeredMemoryRow = ({
  index,
  item,
  styles,
  typeColor,
  onEdit,
  onDelete,
}: {
  index: number;
  item: AiosMemory;
  styles: any;
  typeColor: (type: string) => string;
  onEdit: (item: AiosMemory) => void;
  onDelete: (id: string) => void;
}) => {
  const l10n = React.useContext(L10nContext);
  const entry = useStaggerEntry(index);
  return (
    <Animated.View style={entry}>
      <List.Item
        title={item.content}
        description={`${item.type} · ${new Date(item.ts).toLocaleString()}`}
        left={() => (
          <View
            style={[styles.typeBadge, {backgroundColor: typeColor(item.type)}]}>
            <Text style={styles.typeText}>{item.type[0].toUpperCase()}</Text>
          </View>
        )}
        right={() => (
          <View style={{flexDirection: 'row'}}>
            <IconButton
              icon="pencil-outline"
              size={20}
              accessibilityLabel={l10n.components.chatView.menuItems.edit}
              onPress={() => onEdit(item)}
            />
            <IconButton
              icon="delete-outline"
              size={20}
              accessibilityLabel={l10n.common.delete}
              onPress={() => onDelete(item.id)}
            />
          </View>
        )}
        style={styles.listItem}
      />
    </Animated.View>
  );
};

export function MemoryScreen({navigation}: any) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [memories, setMemories] = React.useState<AiosMemory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fileSize, setFileSize] = React.useState(0);
  const [editing, setEditing] = React.useState<AiosMemory | null>(null);
  const [editText, setEditText] = React.useState('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMemories();
      setMemories(list);
      const size = await getMemoriesFileSize();
      setFileSize(size);
    } catch (e) {
      console.warn('[MemoryScreen] refresh failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    navigation.addListener?.('focus', refresh);
    return () => navigation.removeListener?.('focus', refresh);
  }, [navigation, refresh]);

  const handleDelete = (id: string) => {
    Alert.alert('删除记忆', '确认删除这条记忆？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteMemory(id);
          refresh();
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('清空全部记忆', '确认清空所有记忆？此操作不可撤销。', [
      {text: '取消', style: 'cancel'},
      {
        text: '清空',
        style: 'destructive',
        onPress: async () => {
          await clearMemories();
          refresh();
        },
      },
    ]);
  };

  const handleEdit = (item: AiosMemory) => {
    setEditing(item);
    setEditText(item.content);
  };

  const handleSaveEdit = async () => {
    if (editing) {
      await updateMemoryContent(editing.id, editText);
      setEditing(null);
      setEditText('');
      refresh();
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'fact':
        return theme.colors.success;
      case 'episode':
        return theme.colors.info;
      case 'insight':
        return theme.colors.warning;
      default:
        return theme.colors.outlineVariant;
    }
  };

  const renderItem = ({item, index}: {item: AiosMemory; index: number}) => (
    <StaggeredMemoryRow
      index={index}
      item={item}
      styles={styles}
      typeColor={typeColor}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );

  const sizeStr =
    fileSize > 1024 ? `${(fileSize / 1024).toFixed(1)} KB` : `${fileSize} B`;

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={
            <View style={styles.appbarTitleRow}>
              <IconTile
                icon={HeartIcon}
                color={theme.colors.domain.memory}
                size="s"
              />
              <Text style={styles.appbarTitle}>记忆管理</Text>
            </View>
          }
        />
        <Appbar.Action icon="broom" onPress={handleClearAll} />
      </Appbar.Header>

      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {memories.length} 条记忆 · {sizeStr} · {AIOS_MEMORIES_DIR}
        </Text>
        <Button mode="text" onPress={refresh} loading={loading}>
          刷新
        </Button>
      </View>

      <FlatList
        data={memories}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? '加载中...' : '暂无记忆。告诉女妖一些事，她会记住的。'}
            </Text>
          </View>
        }
        contentContainerStyle={memories.length === 0 ? styles.emptyList : null}
      />

      {/* Edit Modal */}
      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑记忆</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              style={styles.modalInput}
              multiline
              autoFocus
              maxLength={200}
            />
            <View style={styles.modalButtons}>
              <Button onPress={() => setEditing(null)}>取消</Button>
              <Button mode="contained" onPress={handleSaveEdit}>
                保存
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.surface},
    appbarTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    appbarTitle: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
    },
    infoBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
      backgroundColor: theme.colors.surface,
    },
    infoText: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      flex: 1,
    },
    listItem: {paddingVertical: theme.spacing.xs},
    typeBadge: {
      width: 36,
      height: 36,
      // 形状角色：图标容器 m(12)（DESIGN_SPEC §4）
      borderRadius: theme.radius.m,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
    },
    typeText: {
      ...theme.typography.titleS,
      fontWeight: 'bold',
      // 徽章字：与语义彩色底成对（绿底白字），不再用 onPrimary（浅色下为深色）
      color: theme.colors.onSuccess,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xxl,
    },
    emptyText: {
      ...theme.typography.bodyS,
      color: theme.colors.outlineVariant,
      textAlign: 'center',
    },
    emptyList: {flex: 1},
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.backdrop,
      padding: theme.spacing.ml,
    },
    modalContent: {
      backgroundColor: theme.colors.surfaceElevated,
      // 形状角色：浮层表面 xl(32)（DESIGN_SPEC §4）
      borderRadius: theme.radius.xl,
      padding: theme.spacing.ml,
      width: '100%',
      elevation: 4,
    },
    modalTitle: {
      ...theme.typography.titleS,
      fontWeight: 'bold',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.sm,
    },
    modalInput: {
      borderWidth: theme.stroke.sm,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.s,
      padding: theme.spacing.s,
      ...theme.typography.bodyS,
      color: theme.colors.onSurface,
      minHeight: 80,
      marginBottom: theme.spacing.sm,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.s,
    },
  });
