import * as React from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
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

export function MemoryScreen({navigation}: any) {
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
        return '#4CAF50';
      case 'episode':
        return '#2196F3';
      case 'insight':
        return '#FF9800';
      default:
        return '#999';
    }
  };

  const renderItem = ({item}: {item: AiosMemory}) => (
    <List.Item
      title={item.content}
      description={`${item.type} · ${new Date(item.ts).toLocaleString()}`}
      left={() => (
        <View style={[styles.typeBadge, {backgroundColor: typeColor(item.type)}]}>
          <Text style={styles.typeText}>{item.type[0].toUpperCase()}</Text>
        </View>
      )}
      right={() => (
        <View style={{flexDirection: 'row'}}>
          <IconButton
            icon="pencil-outline"
            size={20}
            onPress={() => handleEdit(item)}
          />
          <IconButton
            icon="delete-outline"
            size={20}
            onPress={() => handleDelete(item.id)}
          />
        </View>
      )}
      style={styles.listItem}
    />
  );

  const sizeStr =
    fileSize > 1024
      ? `${(fileSize / 1024).toFixed(1)} KB`
      : `${fileSize} B`;

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="记忆管理" />
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  infoText: {fontSize: 12, color: '#666', flex: 1},
  listItem: {paddingVertical: 4},
  typeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  typeText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40},
  emptyText: {color: '#999', textAlign: 'center'},
  emptyList: {flex: 1},
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  modalTitle: {fontSize: 16, fontWeight: 'bold', marginBottom: 12},
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
