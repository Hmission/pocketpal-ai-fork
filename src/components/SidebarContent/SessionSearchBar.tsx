import React, {useContext} from 'react';
import {TouchableOpacity, View, Text, TextInput} from 'react-native';
import {Divider} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {PlusIcon, SearchIcon} from '../../assets/icons';
import {L10nContext} from '../../utils';

interface SessionSearchBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewChat: () => void;
}

/**
 * SessionSearchBar — 顶部固定区：会话搜索框 + 「+ 新对话」行。
 * testID（session-search-input/new-chat-button）不变。
 */
export const SessionSearchBar: React.FC<SessionSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onNewChat,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);

  return (
    <View style={styles.topSection}>
      <View style={styles.searchContainer}>
        <SearchIcon stroke={theme.colors.onSurfaceVariant} />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={l10n.components.sidebarContent.searchPlaceholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={styles.searchInput}
          testID="session-search-input"
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <TouchableOpacity
        style={styles.newChatRow}
        onPress={onNewChat}
        testID="new-chat-button">
        <PlusIcon stroke={theme.colors.primary} width={22} height={22} />
        <Text style={styles.newChatText}>
          {l10n.components.sidebarContent.newChat}
        </Text>
      </TouchableOpacity>
      <Divider style={styles.topDivider} />
    </View>
  );
};

SessionSearchBar.displayName = 'SessionSearchBar';
