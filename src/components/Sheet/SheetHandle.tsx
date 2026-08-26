import React from 'react';
import {View, StyleSheet} from 'react-native';
import {BottomSheetHandleProps} from '@gorhom/bottom-sheet';
import {useTheme} from '../../hooks/useTheme';
import {radius} from '../../theme/tokens';

export const SheetHandle: React.FC<BottomSheetHandleProps> = () => {
  const theme = useTheme();

  return (
    <View style={styles.container} testID="sheet-handle">
      <View
        style={[styles.indicator, {backgroundColor: theme.colors.primary}]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  indicator: {
    width: 32,
    height: 4,
    // 形状角色：胶囊 grabber（DESIGN_SPEC §4）
    borderRadius: radius.full,
  },
});
