import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';

import Clipboard from '@react-native-clipboard/clipboard';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {CopyIcon} from '../../assets/icons';

import {useTheme} from '../../hooks';

import {createStyles} from './styles';

interface CodeBlockHeaderProps {
  language: string;
  content: string;
}

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const CodeBlockHeader: React.FC<CodeBlockHeaderProps> = ({
  language,
  content,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const handleCopy = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    Clipboard.setString(content.trim());
  };

  return (
    <View style={styles.codeHeader}>
      <Text style={styles.codeLanguage} numberOfLines={1} ellipsizeMode="tail">
        {language}
      </Text>
      <TouchableOpacity onPress={handleCopy} style={styles.iconTouchable}>
        <CopyIcon
          width={16}
          height={16}
          stroke={theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>
    </View>
  );
};
