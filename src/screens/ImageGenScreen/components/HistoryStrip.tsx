import * as React from 'react';
import {TouchableOpacity, View, Text, Image, FlatList} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {GeneratedImage} from '../../../store/imageGenStore';
import {CheckMdIcon} from '../../../assets/icons';

interface HistoryStripProps {
  /** 成功任务条目 + 原始历史索引（翻页定位用；running/failed 不入缩略图条） */
  items: {item: GeneratedImage; index: number}[];
  manageMode: boolean;
  toDelete: string[];
  onUpload: () => void;
  onToggleManage: () => void;
  /** 点击缩略图 → 大图预览翻到对应页 + 回填参数 */
  onThumbPress: (item: GeneratedImage, index: number) => void;
  onToggleDelete: (uri: string) => void;
  onConfirmDelete: () => void;
}

/**
 * HistoryStrip — ②历史区（紧凑横条）：上传入口 + 成功任务缩略图（点击联动大图预览），
 * [管理] 进入多选删除。只读 props 渲染。
 */
export const HistoryStrip: React.FC<HistoryStripProps> = ({
  items,
  manageMode,
  toDelete,
  onUpload,
  onToggleManage,
  onThumbPress,
  onToggleDelete,
  onConfirmDelete,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  return (
    <View style={s.card}>
      <View style={s.historyHeader}>
        <Text style={s.cardTitle}>相册 ({items.length})</Text>
        <View style={s.historyHeaderActions}>
          <TouchableOpacity onPress={onUpload}>
            <Text style={s.uploadText}>上传</Text>
          </TouchableOpacity>
          {items.length > 0 && (
            <TouchableOpacity onPress={onToggleManage}>
              <Text style={s.manageText}>{manageMode ? '完成' : '管理'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={({item}) => item.taskId ?? item.uri}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({item: {item, index}}) => (
            <TouchableOpacity
              style={s.historyItem}
              onPress={() => {
                if (manageMode) {
                  onToggleDelete(item.uri);
                  return;
                }
                onThumbPress(item, index);
              }}>
              <Image source={{uri: item.uri}} style={s.historyThumb} />
              {item.kind === 'upload' && !manageMode && (
                <View style={s.historyKindBadge}>
                  <Text style={s.historyKindText}>上传</Text>
                </View>
              )}
              {manageMode && toDelete.includes(item.uri) && (
                <View style={s.historySel}>
                  <CheckMdIcon width={20} height={20} stroke="#fff" />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
      {manageMode && (
        <TouchableOpacity
          style={[s.button, s.buttonDanger]}
          disabled={toDelete.length === 0}
          onPress={onConfirmDelete}>
          <Text style={[s.buttonText, s.buttonTextOnDanger]}>
            删除选中 ({toDelete.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
