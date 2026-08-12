import {StyleSheet} from 'react-native';

import {ModelType} from './ModelTypeTag';

import {Theme} from '../../utils';

export const createStyles = (
  theme: Theme,
  type: ModelType,
  size: 'small' | 'medium',
) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: size === 'small' ? 4 : 6,
      marginRight: 4,
      height: size === 'small' ? 20 : 24,
      backgroundColor: (() => {
        switch (type) {
          case 'vision':
            return 'transparent';
          case 'mmproj':
            return theme.colors.tertiaryContainer;
          case 'llm':
            return theme.colors.secondaryContainer;
          default:
            return theme.colors.surfaceVariant;
        }
      })(),
      borderColor: (() => {
        const color = (() => {
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
        })();
        return color + '30'; // 30% opacity
      })(),
    },
    text: {
      fontWeight: '600',
      fontSize: size === 'small' ? 10 : 12,
      marginLeft: 2,
      color: (() => {
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
      })(),
    },
  });
