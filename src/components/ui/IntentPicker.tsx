/**
 * IntentPicker — 意图四态选择器（CHAT_UI_SPEC §18.1 / UI_INTERACTION_SPEC v1.1）
 *
 * 会话级意图状态机的唯一用户写入口：点按助手卡意图胶囊 → 四态小卡片
 * （闲聊/倾诉/问答/任务），选择写入会话实体落库，后续轮次沿用直到再次切换。
 *
 * 用法（命令式，Promise<IntentKind | null>，null=取消）：
 *   const next = await askIntentChoice(current);
 *   if (next) { chatSessionStore.setSessionIntent(next); }
 *
 * 挂载：App 根挂载 <IntentPickerHost />（与 ConfirmDialogHost 同构）。
 * Host 未挂载时返回 null（fail-fast，不改变状态）。
 */
import * as React from 'react';
import {Modal, TouchableOpacity, View, Text} from 'react-native';

import {useTheme} from '../../hooks';
import type {IntentKind} from '../../services/aiosMemory/rituals';

interface PendingPicker {
  current?: IntentKind;
  resolve: (choice: IntentKind | null) => void;
}

type Listener = (
  current: IntentKind | undefined,
  resolve: (choice: IntentKind | null) => void,
) => void;

let listener: Listener | null = null;

/** 命令式意图选择。Host 未挂载时返回 null（fail-fast，不改变状态）。 */
export function askIntentChoice(
  current?: IntentKind,
): Promise<IntentKind | null> {
  return new Promise(resolve => {
    if (!listener) {
      console.warn('[IntentPicker] host not mounted, treating as cancelled');
      resolve(null);
      return;
    }
    listener(current, resolve);
  });
}

// 四态标签（B18 §17 硬编码口径延续：意图标签不走 l10n，中文产品叙事）
const INTENT_OPTIONS: Array<{kind: IntentKind; label: string; desc: string}> = [
  {kind: 'chat', label: '闲聊', desc: '轻松自然，像老朋友一样'},
  {kind: 'vent', label: '倾诉', desc: '先共情再回应，温柔陪伴'},
  {kind: 'qa', label: '问答', desc: '直接给准确回答'},
  {kind: 'task', label: '任务', desc: '拆解清楚再动手'},
];

/**
 * IntentPickerHost — 挂到 App 根的单例宿主，渲染当前挂起选择器。
 */
export const IntentPickerHost: React.FC = () => {
  const theme = useTheme();
  const [pending, setPending] = React.useState<PendingPicker | null>(null);

  React.useEffect(() => {
    listener = (current, resolve) => setPending({current, resolve});
    return () => {
      listener = null;
    };
  }, []);

  const close = (choice: IntentKind | null) => {
    pending?.resolve(choice);
    setPending(null);
  };

  return (
    <Modal
      visible={pending !== null}
      transparent
      animationType="fade"
      onRequestClose={() => close(null)}>
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
        activeOpacity={1}
        onPress={() => close(null)}>
        <View
          style={{
            width: '100%',
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radius.ml,
            padding: theme.spacing.ml,
            gap: theme.spacing.xs,
            elevation: 4,
          }}>
          <Text
            style={{
              ...theme.typography.titleS,
              fontWeight: '600',
              color: theme.colors.onSurface,
              marginBottom: theme.spacing.xxs,
            }}>
            切换聊天状态
          </Text>
          {INTENT_OPTIONS.map(opt => {
            const selected = pending?.current === opt.kind;
            return (
              <TouchableOpacity
                key={opt.kind}
                testID={`intent-picker-${opt.kind}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 44,
                  borderRadius: theme.radius.s,
                  paddingHorizontal: theme.spacing.sm,
                  borderWidth: theme.stroke.sm,
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.outlineVariant,
                  backgroundColor: selected
                    ? theme.colors.primary + '1F' // 12% 主色底（同模型 chip 语言）
                    : 'transparent',
                }}
                onPress={() => close(opt.kind)}>
                <View>
                  <Text
                    style={{
                      ...theme.typography.uiM,
                      fontWeight: selected ? '600' : '400',
                      color: selected
                        ? theme.colors.primary
                        : theme.colors.onSurface,
                    }}>
                    {opt.label}
                  </Text>
                  <Text
                    style={{
                      ...theme.typography.captionS,
                      color: theme.colors.onSurfaceVariant,
                    }}>
                    {opt.desc}
                  </Text>
                </View>
                {selected && (
                  <Text style={{color: theme.colors.primary}}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

IntentPickerHost.displayName = 'IntentPickerHost';
