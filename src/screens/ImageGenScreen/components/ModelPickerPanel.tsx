import * as React from 'react';
import {TouchableOpacity, View, Text, ActivityIndicator} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {FAMILY_BADGE, ModelEntry} from '../constants';

interface ModelPickerPanelProps {
  /** 设备扫描结果 + DreamLite 内置条目 */
  available: ModelEntry[];
  /** 当前选中的模型条目（未选中为 null） */
  selectedEntry: ModelEntry | null;
  selectedId: string | null;
  scanning: boolean;
  /** 任一模型加载中（store.loading） */
  loading: boolean;
  /** 选中族引擎已就绪 */
  loaded: boolean;
  isDream: boolean;
  showModelDrop: boolean;
  /** 状态胶囊右侧文案（加载中…/已就绪/未加载） */
  modelStatus: string;
  /** 计时刷新锚（加载耗时展示） */
  now: number;
  /** 加载开始时间戳（耗时计算） */
  loadingStartedAt: number;
  /** 当前加载阶段文案（store.stage） */
  stage: string;
  /** 任一引擎生成/编辑进行中（行按钮禁用条件） */
  generating: boolean;
  modelsDir: string;
  onToggleDrop: () => void;
  onSelectModel: (entry: ModelEntry) => void;
  onRowAction: (entry: ModelEntry) => void;
  isRowLoaded: (entry: ModelEntry) => boolean;
}

/**
 * ModelPickerPanel — 顶部模型状态胶囊 + 锚定悬浮下拉（盖住下方 + 点外收起）。
 * 只读 props 渲染，所有状态与动作由编排层注入。
 */
export const ModelPickerPanel: React.FC<ModelPickerPanelProps> = ({
  available,
  selectedEntry,
  selectedId,
  scanning,
  loading,
  loaded,
  isDream,
  showModelDrop,
  modelStatus,
  now,
  loadingStartedAt,
  stage,
  generating,
  modelsDir,
  onToggleDrop,
  onSelectModel,
  onRowAction,
  isRowLoaded,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  return (
    <View>
      <TouchableOpacity style={s.modelChip} onPress={onToggleDrop}>
        <Text style={s.modelChipText} numberOfLines={1}>
          {selectedEntry
            ? `${
                FAMILY_BADGE[selectedEntry.manifest.family]
                  ? `[${FAMILY_BADGE[selectedEntry.manifest.family]}] `
                  : ''
              }${selectedEntry.manifest.label}`
            : '选择模型'}
          {selectedEntry?.manifest.experimental ? (
            <Text style={s.badgeExp}> [实验性]</Text>
          ) : null}
        </Text>
        <Text style={s.modelChipStatus}>
          {modelStatus} {showModelDrop ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>

      {/* 模型锚定下拉：悬浮盖住下方 + 点外收起 */}
      {showModelDrop && (
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
                return (
                  <TouchableOpacity
                    key={item.manifest.id}
                    style={[
                      s.modelRow,
                      selectedId === item.manifest.id && s.modelRowSelected,
                    ]}
                    onPress={() => onSelectModel(item)}>
                    <View style={s.modelRowMain}>
                      <Text style={s.modelName} numberOfLines={1}>
                        {FAMILY_BADGE[item.manifest.family] ? (
                          <Text
                            style={
                              item.manifest.family === 'sd3'
                                ? s.badgeSd3
                                : item.manifest.family === 'dreamlite'
                                  ? s.badgeDream
                                  : s.badgeZ
                            }>
                            [{FAMILY_BADGE[item.manifest.family]}]{' '}
                          </Text>
                        ) : null}
                        {item.manifest.label}
                        {item.manifest.experimental ? (
                          <Text style={s.badgeExp}> [实验性]</Text>
                        ) : null}
                      </Text>
                      {item.manifest.note ? (
                        <Text style={s.modelNote} numberOfLines={2}>
                          {item.manifest.note}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        s.rowActionBtn,
                        rowLoaded && s.rowActionBtnUnload,
                      ]}
                      disabled={loading || generating}
                      onPress={() => onRowAction(item)}>
                      {rowLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={rowLoaded ? '#c62828' : '#ffffff'}
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
      )}
    </View>
  );
};
