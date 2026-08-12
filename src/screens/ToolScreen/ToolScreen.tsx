import * as React from 'react';
import {View, FlatList, Text, StyleSheet} from 'react-native';
import {Appbar, List, Divider, Switch} from 'react-native-paper';
import {deriveToolSchemas} from '../../services/talents';
import {palStore, chatSessionStore} from '../../store';
import type {ToolDefinition} from '../../services/talents/types';
import {toJS} from 'mobx';

export function ToolScreen({navigation}: any) {
  const [tools, setTools] = React.useState<ToolDefinition[]>([]);
  const [enabledTalents, setEnabledTalents] = React.useState<Set<string>>(
    new Set(),
  );
  const [toolHistory, setToolHistory] = React.useState<
    {name: string; summary: string; ts: string}[]
  >([]);

  const refresh = React.useCallback(() => {
    const schemas = deriveToolSchemas();
    setTools(schemas);
    const aiosPal = palStore.getAiosPal?.();
    if (aiosPal?.pact?.talents) {
      setEnabledTalents(new Set(aiosPal.pact.talents.map(t => t.name)));
    }
    // Extract tool call history from current session messages
    const session = chatSessionStore.sessions.find(
      s => s.id === chatSessionStore.activeSessionId,
    );
    const history: {name: string; summary: string; ts: string}[] = [];
    if (session) {
      const messages = toJS(session.messages);
      for (const msg of messages) {
        if (msg.type === 'assistant_turn') {
          const turn = msg as any;
          for (const step of turn.steps ?? []) {
            for (const outcome of step.toolOutcomes ?? []) {
              history.push({
                name: outcome.toolName ?? 'unknown',
                summary: (outcome.responseContent ?? '').slice(0, 80),
                ts: new Date(msg.createdAt ?? 0).toLocaleTimeString().slice(0, 5),
              });
            }
          }
        }
      }
    }
    setToolHistory(history.slice(-20).reverse()); // Last 20, newest first
  }, []);

  React.useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const toggleTalent = async (name: string, enable: boolean) => {
    const aiosPal = palStore.getAiosPal?.();
    if (!aiosPal) {
      return;
    }
    const currentTalents = aiosPal.pact?.talents ?? [];
    let updatedTalents;
    if (enable) {
      if (currentTalents.some(t => t.name === name)) {
        return; // Already enabled
      }
      updatedTalents = [...currentTalents, {name, necessity: 'optional' as const}];
    } else {
      updatedTalents = currentTalents.filter(t => t.name !== name);
    }
    await palStore.updatePal(aiosPal.id, {
      pact: {talents: updatedTalents},
    });
    setEnabledTalents(new Set(updatedTalents.map(t => t.name)));
  };

  const renderItem = ({item}: {item: ToolDefinition}) => {
    const name = item.function.name;
    const enabled = enabledTalents.has(name);
    return (
      <List.Item
        title={name}
        description={item.function.description?.slice(0, 80)}
        left={props => (
          <List.Icon {...props} icon={enabled ? 'check-circle' : 'circle-outline'} />
        )}
        right={() => (
          <Switch
            value={enabled}
            onValueChange={(v) => toggleTalent(name, v)}
          />
        )}
      />
    );
  };

  const renderHistoryItem = ({item}: {item: {name: string; summary: string; ts: string}}) => (
    <View style={styles.historyItem}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyName}>{item.name}</Text>
        <Text style={styles.historyTime}>{item.ts}</Text>
      </View>
      <Text style={styles.historySummary} numberOfLines={2}>
        {item.summary}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation?.goBack()} />
        <Appbar.Content title="工具配置" />
      </Appbar.Header>

      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {tools.length} 个工具已注册 · {enabledTalents.size} 个启用
        </Text>
      </View>

      <FlatList
        data={tools}
        renderItem={renderItem}
        keyExtractor={item => item.function.name}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <Text style={styles.sectionHeader}>已注册工具</Text>
        }
        ListFooterComponent={
          toolHistory.length > 0 ? (
            <View>
              <Text style={styles.sectionHeader}>工具调用历史 (最近 {toolHistory.length} 次)</Text>
              <FlatList
                data={toolHistory}
                renderItem={renderHistoryItem}
                keyExtractor={(item, i) => String(i)}
                ItemSeparatorComponent={Divider}
                scrollEnabled={false}
              />
            </View>
          ) : (
            <Text style={styles.empty}>暂无工具调用记录</Text>
          )
        }
        ListEmptyComponent={
          <Text style={styles.empty}>暂无工具注册</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  infoBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  infoText: {fontSize: 12, color: '#666'},
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
  },
  historyItem: {
    padding: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyName: {fontSize: 13, fontWeight: '500', color: '#333'},
  historyTime: {fontSize: 11, color: '#999'},
  historySummary: {fontSize: 12, color: '#666'},
  empty: {textAlign: 'center', color: '#999', padding: 40},
});
