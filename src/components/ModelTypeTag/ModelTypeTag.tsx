import React from 'react';
import {View} from 'react-native';

import {Text} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTheme} from '../../hooks';

import {createStyles} from './styles';

export type ModelType = 'vision' | 'mmproj' | 'llm';

interface ModelTypeTagProps {
  type: ModelType;
  label?: string;
  size?: 'small' | 'medium';
}

export const ModelTypeTag: React.FC<ModelTypeTagProps> = ({
  type,
  label,
  size = 'small',
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, type, size);

  const getIconName = () => {
    switch (type) {
      case 'vision':
        return 'eye';
      case 'mmproj':
        return 'image-outline';
      case 'llm':
        return 'brain';
      default:
        return 'cube-outline';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'vision':
        return theme.colors.tertiary;
      case 'mmproj':
        return theme.colors.tertiary;
      case 'llm':
        return theme.colors.secondary;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const iconSize = size === 'small' ? 12 : 16;
  const iconColor = getColor();

  return (
    <View style={styles.container} testID="model-type-tag-container">
      <Icon name={getIconName()} size={iconSize} color={iconColor} />
      {label && <Text style={styles.text}>{label}</Text>}
    </View>
  );
};
