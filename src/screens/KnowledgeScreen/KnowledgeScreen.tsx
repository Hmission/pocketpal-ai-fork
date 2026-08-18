import * as React from 'react';
import {Animated, View, FlatList, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Appbar, Divider, TextInput, Button} from 'react-native-paper';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {
  listConversationDates,
  readConversationLog,
} from '../../services/aiosMemory/conversationLog';
import {searchMemory} from '../../services/aiosMemory';
import {
  listSummaryDates,
  readSummary,
} from '../../services/aiosMemory/compaction';
import {AIOS_MEMORY_FILE} from '../../utils/paths';
import {listToys, readToy, ToyEntry} from '../../services/toyChest';
import {HtmlPreviewBubble} from '../../components/HtmlPreviewBubble';
import {useTheme, useStaggerEntry} from '../../hooks';
import type {Theme} from '../../utils/types';
import {IconTile, ListItem} from '../../components/ui';
import {
  GridIcon,
  MessageCircleMdIcon,
  PencilLineIcon,
  PlayIcon,
} from '../../assets/icons';

type Tab = 'conversations' | 'summaries' | 'longterm' | 'toys';

// 列表行错峰入场（DESIGN_SPEC §5：一次性、不循环；JS driver）
const StaggeredListItem = ({
  index,
  title,
  subtitle,
  Icon,
  color,
  onPress,
}: {
  index: number;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<any>;
  color: string;
  onPress: () => void;
}) => {
  const entry = useStaggerEntry(index);
  return (
    <Animated.View style={entry}>
      <ListItem
        title={title}
        subtitle={subtitle}
        Icon={Icon}
        color={color}
        onPress={onPress}
      />
    </Animated.View>
  );
};

export function KnowledgeScreen({navigation}: any) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [tab, setTab] = React.useState<Tab>('conversations');
  const [dates, setDates] = React.useState<string[]>([]);
  const [summaryDates, setSummaryDates] = React.useState<string[]>([]);
  const [_selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [content, setContent] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<string[]>([]);
  // 玩具箱（P8 玩具工坊，PLAY_SPEC）：render_html 成品清单 + 选中玩具
  const [toys, setToys] = React.useState<ToyEntry[]>([]);
  const [selectedToy, setSelectedToy] = React.useState<{
    title: string;
    html: string;
  } | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await listConversationDates();
      setDates(list);
      const slist = await listSummaryDates();
      setSummaryDates(slist);
      setToys(await listToys());
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
    setSelectedToy(null);
    const results = await searchMemory(query, 10);
    setSearchResults(results);
  };

  const openToy = async (toy: ToyEntry) => {
    setSelectedDate(null);
    setSearchResults([]);
    const html = await readToy(toy.id);
    setSelectedToy(html ? {title: toy.title, html} : null);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={
            <View style={styles.appbarTitleRow}>
              <IconTile
                icon={GridIcon}
                color={theme.colors.domain.knowledge}
                size="s"
              />
              <Text style={styles.appbarTitle}>知识库</Text>
            </View>
          }
        />
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
          <Text
            style={
              tab === 'conversations' ? styles.tabTextActive : styles.tabText
            }>
            对话日志
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'summaries' && styles.tabActive]}
          onPress={() => setTab('summaries')}>
          <Text
            style={tab === 'summaries' ? styles.tabTextActive : styles.tabText}>
            摘要
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'longterm' && styles.tabActive]}
          onPress={() => {
            setTab('longterm');
            loadLongTermMemory();
          }}>
          <Text
            style={tab === 'longterm' ? styles.tabTextActive : styles.tabText}>
            长期记忆
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'toys' && styles.tabActive]}
          onPress={() => {
            setTab('toys');
            setSelectedToy(null);
            refresh();
          }}>
          <Text style={tab === 'toys' ? styles.tabTextActive : styles.tabText}>
            玩具箱
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content area */}
      {selectedToy ? (
        <HtmlPreviewBubble html={selectedToy.html} title={selectedToy.title} />
      ) : searchResults.length > 0 ? (
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
          renderItem={({item, index}) => (
            <StaggeredListItem
              index={index}
              title={item}
              subtitle="对话日志"
              Icon={MessageCircleMdIcon}
              color={theme.colors.domain.knowledge}
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
          renderItem={({item, index}) => (
            <StaggeredListItem
              index={index}
              title={item}
              subtitle="对话摘要"
              Icon={PencilLineIcon}
              color={theme.colors.domain.knowledge}
              onPress={() => loadSummary(item)}
            />
          )}
          keyExtractor={item => item}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {summaryDates.length === 0
                ? '暂无摘要。对话超过阈值后自动生成摘要。'
                : ''}
            </Text>
          }
        />
      ) : tab === 'toys' ? (
        <FlatList
          data={toys}
          renderItem={({item, index}) => (
            <StaggeredListItem
              index={index}
              title={item.title}
              subtitle={new Date(item.createdAt).toLocaleString()}
              Icon={PlayIcon}
              color={theme.colors.domain.knowledge}
              onPress={() => openToy(item)}
            />
          )}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {toys.length === 0
                ? '玩具箱空空的。在聊天里说「做个玩具：贪吃蛇」让小鸡造一个吧！'
                : ''}
            </Text>
          }
        />
      ) : null}
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
      backgroundColor: theme.colors.surface,
    },
    searchInput: {
      flex: 1,
      marginRight: theme.spacing.s,
      backgroundColor: theme.colors.surface,
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: theme.stroke.sm,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: theme.spacing.s,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: theme.stroke.md,
      borderBottomColor: theme.colors.domain.knowledge,
    },
    tabText: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
    },
    tabTextActive: {
      ...theme.typography.bodyS,
      color: theme.colors.domain.knowledge,
      fontWeight: 'bold',
    },
    resultItem: {padding: theme.spacing.sm},
    resultText: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurface,
    },
    contentContainer: {padding: theme.spacing.m},
    contentText: {
      ...theme.typography.bodyS,
      lineHeight: 22,
      color: theme.colors.onSurface,
    },
    empty: {
      textAlign: 'center',
      color: theme.colors.outlineVariant,
      padding: theme.spacing.xxl,
    },
  });
