import * as React from 'react';
import {View, FlatList, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Appbar, List, Divider, TextInput, Button, RadioButton} from 'react-native-paper';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {
  listConversationDates,
  readConversationLog,
} from '../../services/aiosMemory/conversationLog';
import {searchMemory} from '../../services/aiosMemory';
import {listSummaryDates, readSummary} from '../../services/aiosMemory/compaction';
import {AIOS_MEMORY_FILE} from '../../utils/paths';

type Tab = 'conversations' | 'summaries' | 'longterm';

export function KnowledgeScreen({navigation}: any) {
  const [tab, setTab] = React.useState<Tab>('conversations');
  const [dates, setDates] = React.useState<string[]>([]);
  const [summaryDates, setSummaryDates] = React.useState<string[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [content, setContent] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<string[]>([]);

  const refresh = React.useCallback(async () => {
    try {
      const list = await listConversationDates();
      setDates(list);
      const slist = await listSummaryDates();
      setSummaryDates(slist);
    } catch (e) {
      console.warn('[KnowledgeScreen] refresh failed:', e);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const loadDate = async (date: string) => {
    setSelectedDate(date);
    setSearchResults([]);
    const c = await readConversationLog(date);
    setContent(c);
  };

  const loadSummary = async (date: string) => {
    setSelectedDate(date);
    setSearchResults([]);
    const c = await readSummary(date);
    setContent(c);
  };

  const loadLongTermMemory = async () => {
    setSelectedDate('MEMORY.md');
    setSearchResults([]);
    try {
      if (await RNFS.exists(AIOS_MEMORY_FILE)) {
        const c = await RNFS.readFile(AIOS_MEMORY_FILE, 'utf8');
        setContent(c);
      } else {
        setContent('（MEMORY.md 尚未创建）');
      }
    } catch {
      setContent('（读取失败）');
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }
    setContent('');
    setSelectedDate(null);
    const results = await searchMemory(query, 10);
    setSearchResults(results);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="知识库" />
      </Appbar.Header>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          placeholder="搜索对话/记忆..."
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          dense
        />
        <Button mode="contained" onPress={handleSearch} compact>
          搜
        </Button>
      </View>

      {/* Tab selector */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'conversations' && styles.tabActive]}
          onPress={() => setTab('conversations')}>
          <Text style={tab === 'conversations' ? styles.tabTextActive : styles.tabText}>
            对话日志
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'summaries' && styles.tabActive]}
          onPress={() => setTab('summaries')}>
          <Text style={tab === 'summaries' ? styles.tabTextActive : styles.tabText}>
            摘要
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'longterm' && styles.tabActive]}
          onPress={() => { setTab('longterm'); loadLongTermMemory(); }}>
          <Text style={tab === 'longterm' ? styles.tabTextActive : styles.tabText}>
            长期记忆
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content area */}
      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={({item}) => (
            <View style={styles.resultItem}>
              <Text style={styles.resultText}>{item}</Text>
            </View>
          )}
          keyExtractor={(_item, i) => String(i)}
          ItemSeparatorComponent={Divider}
        />
      ) : content ? (
        <FlatList
          data={[{key: 'content', text: content}]}
          renderItem={({item}) => (
            <View style={styles.contentContainer}>
              <Text style={styles.contentText}>{item.text}</Text>
            </View>
          )}
          keyExtractor={item => item.key}
        />
      ) : tab === 'conversations' ? (
        <FlatList
          data={dates}
          renderItem={({item}) => (
            <List.Item
              title={item}
              description="对话日志"
              left={props => <List.Icon {...props} icon="file-document-outline" />}
              onPress={() => loadDate(item)}
            />
          )}
          keyExtractor={item => item}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {dates.length === 0 ? '暂无对话日志。开始聊天后会自动落盘。' : ''}
            </Text>
          }
        />
      ) : tab === 'summaries' ? (
        <FlatList
          data={summaryDates}
          renderItem={({item}) => (
            <List.Item
              title={item}
              description="对话摘要"
              left={props => <List.Icon {...props} icon="note-text-outline" />}
              onPress={() => loadSummary(item)}
            />
          )}
          keyExtractor={item => item}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {summaryDates.length === 0 ? '暂无摘要。对话超过阈值后自动生成摘要。' : ''}
            </Text>
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  searchInput: {flex: 1, marginRight: 8, backgroundColor: '#fff'},
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6200ee',
  },
  tabText: {fontSize: 13, color: '#888'},
  tabTextActive: {fontSize: 13, color: '#6200ee', fontWeight: 'bold'},
  resultItem: {padding: 12},
  resultText: {fontSize: 13, color: '#333'},
  contentContainer: {padding: 16},
  contentText: {fontSize: 14, color: '#333', lineHeight: 22},
  empty: {textAlign: 'center', color: '#999', padding: 40},
});
