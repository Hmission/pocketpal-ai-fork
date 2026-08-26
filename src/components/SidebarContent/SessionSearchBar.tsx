import React, {useContext, useState} from 'react';
import {TouchableOpacity, View, Text, TextInput} from 'react-native';
import {Divider} from 'react-native-paper';

import {useTheme} from '../../hooks/useTheme';
import {createStyles} from './styles';
import {PlusIcon, SearchIcon, WorkshopIcon} from '../../assets/icons';
import {L10nContext} from '../../utils';

interface SessionSearchBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewChat: () => void;
  /** 进入生图页（新对话行右侧快捷入口） */
  onImageGen: () => void;
}

/**
 * SessionSearchBar — 顶部固定区：会话搜索框 + 双按钮行（+ 新对话 ｜ 生图入口）。
 * testID（session-search-input/new-chat-button）不变；生图按钮=drawer-imagegen-button。
 */
export const SessionSearchBar: React.FC<SessionSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onNewChat,
  onImageGen,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);
  // 焦点态：聚焦时描边切标准橙黄（primary），与输入态语义对齐
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.topSection}>
      <View
        style={[
          styles.searchContainer,
          {
            borderColor: focused
              ? theme.colors.primary
              : theme.colors.outlineVariant,
          },
        ]}>
        <SearchIcon
          stroke={
            focused ? theme.colors.primary : theme.colors.onSurfaceVariant
          }
        />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={l10n.components.sidebarContent.searchPlaceholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={styles.searchInput}
          testID="session-search-input"
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <View style={styles.newChatRow}>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={onNewChat}
          testID="new-chat-button">
          <PlusIcon stroke={theme.colors.primary} width={22} height={22} />
          <Text style={styles.newChatText}>
            {l10n.components.sidebarContent.newChat}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.newChatImageGenButton}
          onPress={onImageGen}
          testID="drawer-imagegen-button"
          accessibilityLabel={l10n.components.sidebarContent.imageGenEntry}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          {/* 图标 20x20 与「+ 新对话」PlusIcon(22) 水平对齐（v5.4：创造工坊入口 WorkshopIcon 魔法棒+星芒） */}
          <WorkshopIcon stroke={theme.colors.primary} width={20} height={20} />
          <Text style={styles.imageGenEntryText}>
            {l10n.components.sidebarContent.imageGenEntry}
          </Text>
        </TouchableOpacity>
      </View>
      <Divider style={styles.topDivider} />
    </View>
  );
};

SessionSearchBar.displayName = 'SessionSearchBar';
