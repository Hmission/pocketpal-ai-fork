import * as React from 'react';
import {TouchableOpacity, View, Text, ActivityIndicator} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {FAMILY_BADGE, ModelEntry} from '../constants';

/**
 * D1 顶栏重构（DESIGN_SPEC §5 生图顶栏）：原「顶部模型胶囊 + 锚定下拉」
 * 拆为两半——
 *  - ModelPickerTrigger：紧凑胶囊，挂在 IMAGE_GEN 的 headerRight（AppBar 右侧），
 *    回收内容区顶部垂直空间，使结果预览区顶到顶栏、首屏可见出图按钮。
 *  - ModelPickerDropdown：屏级悬浮下拉。屏幕根 View 位于 AppBar 之下，absoluteFill
 *    overlay 天然只盖内容区（不遮顶栏/触发胶囊），点外收起；逻辑不下沉到内容区。
 * 推理链路代码零触碰；testID 零变更。
 */

interface TriggerProps {
  selectedEntry: ModelEntry | null;
  loaded: boolean;
  loading: boolean;
  scanning: boolean;
  showModelDrop: boolean;
  onToggleDrop: () => void;
  onQuickLoad: () => void;
}

export const ModelPickerTrigger: React.FC<TriggerProps> = ({
  selectedEntry,
  loaded,
  loading,
  scanning,
  showModelDrop,
  onToggleDrop,
  onQuickLoad,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const label = selectedEntry
    ? `${
        FAMILY_BADGE[selectedEntry.manifest.family]
          ? `[${FAMILY_BADGE[selectedEntry.manifest.family]}] `
          : ''
      }${selectedEntry.manifest.label}`
    : '选择模型';

  return (
    <View style={s.triggerWrap}>
      <TouchableOpacity
        style={s.triggerPill}
        onPress={onToggleDrop}
        testID="imagegen-model-trigger"
        hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
        <Text style={s.triggerText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.triggerArrow}>{showModelDrop ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {!loaded && !loading && !scanning ? (
        <TouchableOpacity
          style={s.triggerLoadBtn}
          onPress={onQuickLoad}
          testID="imagegen-quick-load"
          hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
          <Text style={s.triggerLoadText}>加载</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

interface DropdownProps {
  available: ModelEntry[];
  selectedId: string | null;
  scanning: boolean;
  loading: boolean;
  loaded: boolean;
  isDream: boolean;
  showModelDrop: boolean;
  now: number;
  loadingStartedAt: number;
  stage: string;
  generating: boolean;
  modelsDir: string;
  /** 设备不兼容判定（单点在 ImageGenScreen：按 manifest.gpuPolicy 声明式矩阵灰置） */
  isIncompatible?: (entry: ModelEntry) => boolean;
  onToggleDrop: () => void;
  onSelectModel: (entry: ModelEntry) => void;
  onRowAction: (entry: ModelEntry) => void;
  isRowLoaded: (entry: ModelEntry) => boolean;
}

export const ModelPickerDropdown: React.FC<DropdownProps> = ({
  available,
  selectedId,
  scanning,
  loading,
  loaded,
  isDream,
  showModelDrop,
  now,
  loadingStartedAt,
  stage,
  generating,
  modelsDir,
  isIncompatible,
  onToggleDrop,
  onSelectModel,
  onRowAction,
  isRowLoaded,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  if (!showModelDrop) {
    return null;
  }
  return (
    <View style={s.dropOverlay} pointerEvents="box-none">
      <TouchableOpacity
        style={s.dropBackdrop}
        activeOpacity={1}
        onPress={onToggleDrop}
      />
      <View style={s.dropPanelAbs}>
        {scanning ? (
          <ActivityIndicator size="small" />
        ) : available.length === 0 ? (
          <Text style={s.hint}>
            未找到生图模型，请将 SDXL Turbo / SD3.5 / Z-Image-Turbo
            套件（GGUF）放入 {modelsDir}
          </Text>
        ) : (
          available.map(item => {
            const rowLoaded = isRowLoaded(item);
            const rowLoading = loading;
            const rowIncompat = isIncompatible?.(item) === true;
            return (
              <TouchableOpacity
                key={item.manifest.id}
                style={[
                  s.modelRow,
                  selectedId === item.manifest.id && s.modelRowSelected,
                  rowIncompat && s.modelRowIncompat,
                ]}
                onPress={() => !rowIncompat && onSelectModel(item)}>
                <View style={s.modelRowMain}>
                  <Text style={s.modelName} numberOfLines={1}>
                    {FAMILY_BADGE[item.manifest.family] ? (
                      <Text
                        style={
                          item.manifest.family === 'sd3'
                            ? s.badgeSd3
                            : item.manifest.family === 'dreamlite'
                              ? s.badgeDream
                              : item.manifest.family === 'flux'
                                ? s.badgeFlux
                                : item.manifest.family === 'krea2'
                                  ? s.badgeKrea2
                                  : s.badgeZ
                        }>
                        [{FAMILY_BADGE[item.manifest.family]}]{' '}
                      </Text>
                    ) : null}
                    {item.manifest.label}
                    {item.manifest.experimental ? (
                      <Text style={s.badgeExp}> [实验性]</Text>
                    ) : null}
                    {rowIncompat ? (
                      <Text style={s.badgeExp}> [本机不可用]</Text>
                    ) : null}
                  </Text>
                  {item.manifest.note ? (
                    <Text style={s.modelNote} numberOfLines={2}>
                      {item.manifest.note}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[s.rowActionBtn, rowLoaded && s.rowActionBtnUnload]}
                  disabled={loading || generating || rowIncompat}
                  onPress={() => onRowAction(item)}>
                  {rowLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        rowLoaded ? theme.colors.danger : theme.colors.onPrimary
                      }
                    />
                  ) : (
                    <Text
                      style={[
                        s.rowActionText,
                        rowLoaded && s.rowActionTextUnload,
                      ]}>
                      {rowLoaded ? '卸载' : '加载'}
                    </Text>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
        {loading && (
          <View style={s.statusPanel}>
            <Text style={s.progressText}>
              正在加载模型…{' · 已耗时 '}
              {Math.max(0, Math.round((now - loadingStartedAt) / 1000))}
              {'s'}
            </Text>
            {stage ? (
              <Text style={s.stageText} numberOfLines={2}>
                ▸ {stage}
              </Text>
            ) : null}
          </View>
        )}
        {loaded && !loading && (
          <Text style={s.readyText}>
            {isDream
              ? '✓ 模型已就绪，可以出图（4 步 1024px 约 25s）'
              : '✓ 模型已就绪（CPU 后端，512px 预计数分钟，请耐心）'}
          </Text>
        )}
      </View>
    </View>
  );
};
