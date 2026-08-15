import * as React from 'react';
import {View, FlatList, Text, StyleSheet} from 'react-native';
import {Appbar, List, Divider, Switch} from 'react-native-paper';
import {deriveToolSchemas} from '../../services/talents';
import {palStore, chatSessionStore} from '../../store';
import type {ToolDefinition} from '../../services/talents/types';
import {toJS} from 'mobx';
import {useTheme} from '../../hooks';
import type {Theme} from '../../utils/types';
import {withOpacity} from '../../utils/colorUtils';
import {IconTile} from '../../components/ui';
import {AtomIcon} from '../../assets/icons';

export function ToolScreen({navigation}: any) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
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
                ts: new Date(msg.createdAt ?? 0)
                  .toLocaleTimeString()
                  .slice(0, 5),
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
      updatedTalents = [
        ...currentTalents,
        {name, necessity: 'optional' as const},
      ];
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
    // device_control is a Phase 2 skeleton — surface the gap instead of
    // letting users toggle a tool whose execute() always errors out.
    const isPhase2 = name === 'device_control';
    return (
      <List.Item
        title={
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{name}</Text>
            {isPhase2 && <Text style={styles.phase2Badge}>Phase 2 未实现</Text>}
          </View>
        }
        description={item.function.description?.slice(0, 80)}
        left={props => (
          <List.Icon
            {...props}
            icon={enabled ? 'check-circle' : 'circle-outline'}
          />
        )}
        right={() => (
          <Switch
            value={enabled}
            disabled={isPhase2}
            onValueChange={v => toggleTalent(name, v)}
          />
        )}
      />
    );
  };

  const renderHistoryItem = ({
    item,
  }: {
    item: {name: string; summary: string; ts: string};
  }) => (
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
        <Appbar.Content
          title={
            <View style={styles.appbarTitleRow}>
              <IconTile
                icon={AtomIcon}
                color={theme.colors.domain.tools}
                size="s"
              />
              <Text style={styles.appbarTitle}>工具配置</Text>
            </View>
          }
        />
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
              <Text style={styles.sectionHeader}>
                工具调用历史 (最近 {toolHistory.length} 次)
              </Text>
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
        ListEmptyComponent={<Text style={styles.empty}>暂无工具注册</Text>}
      />
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    titleText: {
      ...theme.typography.titleS,
      color: theme.colors.onSurface,
    },
    phase2Badge: {
      ...theme.typography.captionS,
      color: theme.colors.warning,
      backgroundColor: withOpacity(theme.colors.warning, 0.12),
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.xs,
      overflow: 'hidden',
    },
    infoBar: {
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
      backgroundColor: theme.colors.surfaceVariant,
    },
    infoText: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
    sectionHeader: {
      ...theme.typography.bodyS,
      fontWeight: 'bold',
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
      backgroundColor: theme.colors.surfaceVariant,
    },
    historyItem: {
      padding: theme.spacing.sm,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    historyName: {
      ...theme.typography.bodyS,
      fontWeight: '500',
      color: theme.colors.onSurface,
    },
    historyTime: {
      ...theme.typography.captionS,
      color: theme.colors.outlineVariant,
    },
    historySummary: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
    empty: {
      textAlign: 'center',
      color: theme.colors.outlineVariant,
      padding: theme.spacing.xxl,
    },
  });
