import React from 'react';
import {View} from 'react-native';

import {Text} from 'react-native-paper';

import {useTheme} from '../../hooks';

import {createStyles} from './styles';

interface TextDividerProps {
  text: string;
  style?: any;
  textStyle?: any;
}

export const TextDivider: React.FC<TextDividerProps> = ({
  text,
  style,
  textStyle,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.line} />
      <Text style={[styles.text, textStyle]}>{text}</Text>
      <View style={styles.line} />
    </View>
  );
};
