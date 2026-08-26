import React, {useContext} from 'react';
import {TouchableOpacity, View, Text} from 'react-native';

import {useTheme} from '../../hooks/useTheme';
import {createStyles} from './styles';
import {Checkbox} from '..';
import {ShareIcon, TrashIcon} from '../../assets/icons';
import {L10nContext} from '../../utils';
import {t} from '../../locales';

interface SelectionModeBarProps {
  selectedCount: number;
  allSelected: boolean;
  onCancel: () => void;
  onExport: () => void;
  onDelete: () => void;
  onToggleAll: () => void;
}

/**
 * SelectionModeBar — 选择模式：头部（取消/计数/批量导出/批量删除）+ 全选行。
 * testID（cancel-selection-button/bulk-export-button/bulk-delete-button/select-all-row）不变。
 */
export const SelectionModeBar: React.FC<SelectionModeBarProps> = ({
  selectedCount,
  allSelected,
  onCancel,
  onExport,
  onDelete,
  onToggleAll,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);

  return (
    <>
      <View style={styles.selectionModeHeader}>
        <TouchableOpacity onPress={onCancel} testID="cancel-selection-button">
          <Text style={{color: theme.colors.primary}}>
            {l10n.common.cancel}
          </Text>
        </TouchableOpacity>

        <Text style={styles.selectedCountText}>
          {t(l10n.components.sidebarContent.nSelected, {
            count: selectedCount.toString(),
          })}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={onExport}
            disabled={selectedCount === 0}
            style={[
              styles.headerActionButton,
              selectedCount === 0 && styles.headerActionButtonDisabled,
            ]}
            testID="bulk-export-button">
            <ShareIcon
              stroke={
                selectedCount === 0
                  ? theme.colors.onSurfaceDisabled
                  : theme.colors.primary
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            disabled={selectedCount === 0}
            style={[
              styles.headerActionButton,
              selectedCount === 0 && styles.headerActionButtonDisabled,
            ]}
            testID="bulk-delete-button">
            <TrashIcon
              stroke={
                selectedCount === 0
                  ? theme.colors.onSurfaceDisabled
                  : theme.colors.error
              }
            />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        onPress={onToggleAll}
        style={styles.selectAllRow}
        testID="select-all-row">
        <View style={styles.selectAllCheckbox}>
          <Checkbox checked={allSelected} onPress={onToggleAll} />
        </View>
        <Text style={styles.selectAllText}>
          {l10n.components.sidebarContent.selectAll}
        </Text>
      </TouchableOpacity>
    </>
  );
};

SelectionModeBar.displayName = 'SelectionModeBar';
