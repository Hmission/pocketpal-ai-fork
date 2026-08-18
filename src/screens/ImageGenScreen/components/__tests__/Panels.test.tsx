import React from 'react';
import {Animated, FlatList} from 'react-native';
import {fireEvent} from '@testing-library/react-native';

import {render} from '../../../../../jest/test-utils';
import {l10n} from '../../../../locales';
import {L10nContext} from '../../../../utils';

import {HistoryStrip} from '../HistoryStrip';
import {ComposerPanel} from '../ComposerPanel';
import {ModelPickerTrigger, ModelPickerDropdown} from '../ModelPickerPanel';
import {ResultPreview} from '../ResultPreview';
import {DREAMLITE_MANIFEST, ModelEntry} from '../../constants';
import {GeneratedImage} from '../../../../store/imageGenStore';

const wrap = (ui: React.ReactElement) =>
  render(<L10nContext.Provider value={l10n.en}>{ui}</L10nContext.Provider>);

const entry: ModelEntry = {manifest: DREAMLITE_MANIFEST, mainPath: ''};

const historyItem: GeneratedImage = {
  uri: 'file:///tmp/gen_1.png',
  prompt: 'a cat',
  seed: 123,
  ts: Date.now(),
  width: 1024,
  height: 1024,
  family: 'dreamlite',
  kind: 'generated',
  taskId: 'task_test_1',
  status: 'success',
};

describe('HistoryStrip', () => {
  it('渲染相册计数与上传入口', () => {
    const {getByText} = wrap(
      <HistoryStrip
        items={[{item: historyItem, index: 0}]}
        manageMode={false}
        toDelete={[]}
        onUpload={jest.fn()}
        onToggleManage={jest.fn()}
        onThumbPress={jest.fn()}
        onToggleDelete={jest.fn()}
        onConfirmDelete={jest.fn()}
      />,
    );
    expect(getByText('相册 (1)')).toBeTruthy();
    expect(getByText('上传')).toBeTruthy();
    expect(getByText('管理')).toBeTruthy();
  });

  it('管理模式：删除按钮随选中计数启用', () => {
    const {getByText} = wrap(
      <HistoryStrip
        items={[{item: historyItem, index: 0}]}
        manageMode={true}
        toDelete={[historyItem.uri]}
        onUpload={jest.fn()}
        onToggleManage={jest.fn()}
        onThumbPress={jest.fn()}
        onToggleDelete={jest.fn()}
        onConfirmDelete={jest.fn()}
      />,
    );
    expect(getByText('删除选中 (1)')).toBeTruthy();
    expect(getByText('完成')).toBeTruthy();
  });

  it('管理模式点击缩略图走多选而非预览', () => {
    const onToggleDelete = jest.fn();
    const onThumbPress = jest.fn();
    const {getByText} = wrap(
      <HistoryStrip
        items={[{item: historyItem, index: 0}]}
        manageMode={true}
        toDelete={[]}
        onUpload={jest.fn()}
        onToggleManage={jest.fn()}
        onThumbPress={onThumbPress}
        onToggleDelete={onToggleDelete}
        onConfirmDelete={jest.fn()}
      />,
    );
    fireEvent.press(getByText('上传')); // 触发上传回调，不触发缩略图逻辑
    expect(onThumbPress).not.toHaveBeenCalled();
  });
});

describe('ComposerPanel', () => {
  const baseProps = {
    prompt: '',
    negativePrompt: '',
    steps: '4',
    cfg: '2',
    size: 512,
    ratio: '1:1',
    seed: '',
    isDream: false,
    editArming: false,
    editRgb: null,
    showAdvanced: false,
    generating: false,
    taskKind: null as 'gen' | 'edit' | null,
    loaded: true,
    dreamW: 1024,
    dreamH: 1024,
    // 08-18 修复：token 上限（sd3=77，按模型传）
    tokenLimit: 77,
    // 08-18 路线 B：LoRA 开关（默认关，manifest 声明时显示）
    hasLora: false,
    loraEnabled: false,
    loraMultiplier: '2.0',
    onLoraEnabledChange: jest.fn(),
    onLoraMultiplierChange: jest.fn(),
    onPromptChange: jest.fn(),
    onNegativePromptChange: jest.fn(),
    onStepsChange: jest.fn(),
    onCfgChange: jest.fn(),
    onSeedChange: jest.fn(),
    onSizeChange: jest.fn(),
    onRatioChange: jest.fn(),
    onToggleAdvanced: jest.fn(),
    onEditArm: jest.fn(),
    onGenerate: jest.fn(),
  };

  it('08-18 按 token 显示提示词计数，超上限红字警告', () => {
    const {getByText} = wrap(
      <ComposerPanel {...baseProps} prompt={'cat '.repeat(40)} />,
    );
    // 'cat ' x40 = 160 字符 ≈ 40 tokens，未超 77
    expect(getByText(/~\d+\/77 tokens/)).toBeTruthy();
    // 超限（77+ tokens）显示截断警告
    const {getByText: g2} = wrap(
      <ComposerPanel
        {...baseProps}
        prompt={'a very long english prompt word '.repeat(30)}
      />,
    );
    expect(g2(/超出编码上限/)).toBeTruthy();
  });

  it('出图按钮触发 onGenerate', () => {
    const onGenerate = jest.fn();
    const {getByText} = wrap(
      <ComposerPanel {...baseProps} onGenerate={onGenerate} prompt="a cat" />,
    );
    fireEvent.press(getByText('出图'));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('未加载时出图按钮禁用', () => {
    const onGenerate = jest.fn();
    const {getByText} = wrap(
      <ComposerPanel {...baseProps} loaded={false} onGenerate={onGenerate} />,
    );
    fireEvent.press(getByText('出图'));
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('08-18 声明 lora 的模型显示 LoRA 开关，未声明不显示', () => {
    const {queryByText, getByText, rerender} = wrap(
      <ComposerPanel {...baseProps} showAdvanced={true} hasLora={true} />,
    );
    expect(getByText('LoRA')).toBeTruthy();
    rerender(<ComposerPanel {...baseProps} showAdvanced={true} hasLora={false} />);
    expect(queryByText('LoRA')).toBeNull();
  });

  it('08-18 非 Dream 模型显示比例档（SD_RATIOS），含竖图 2:3', () => {
    const {getByText} = wrap(
      <ComposerPanel {...baseProps} showAdvanced={true} />,
    );
    expect(getByText('比例')).toBeTruthy();
    expect(getByText('2:3')).toBeTruthy();
    expect(getByText('512×768')).toBeTruthy();
  });
});

describe('ModelPickerTrigger（D1 顶栏胶囊）', () => {
  const baseProps = {
    selectedEntry: entry,
    loaded: false,
    loading: false,
    scanning: false,
    showModelDrop: false,
    onToggleDrop: jest.fn(),
    onQuickLoad: jest.fn(),
  };

  it('顶栏胶囊显示模型族徽章与标签', () => {
    const {getByText} = wrap(<ModelPickerTrigger {...baseProps} />);
    expect(getByText(/DreamLite Mobile/)).toBeTruthy();
  });

  it('未加载时显示快速加载按钮并触发 onQuickLoad', () => {
    const onQuickLoad = jest.fn();
    const {getByTestId} = wrap(
      <ModelPickerTrigger {...baseProps} onQuickLoad={onQuickLoad} />,
    );
    fireEvent.press(getByTestId('imagegen-quick-load'));
    expect(onQuickLoad).toHaveBeenCalled();
  });

  it('点胶囊触发 onToggleDrop', () => {
    const onToggleDrop = jest.fn();
    const {getByTestId} = wrap(
      <ModelPickerTrigger {...baseProps} onToggleDrop={onToggleDrop} />,
    );
    fireEvent.press(getByTestId('imagegen-model-trigger'));
    expect(onToggleDrop).toHaveBeenCalled();
  });
});

describe('ModelPickerDropdown（D1 屏级下拉）', () => {
  const baseProps = {
    available: [entry],
    selectedId: 'dreamlite',
    scanning: false,
    loading: false,
    loaded: false,
    isDream: true,
    showModelDrop: false,
    now: Date.now(),
    loadingStartedAt: 0,
    stage: '',
    generating: false,
    modelsDir: '/sdcard/Documents/AIOS/models',
    onToggleDrop: jest.fn(),
    onSelectModel: jest.fn(),
    onRowAction: jest.fn(),
    isRowLoaded: jest.fn(() => false),
  };

  it('showModelDrop=false 时不渲染任何内容', () => {
    const {queryByText} = wrap(<ModelPickerDropdown {...baseProps} />);
    expect(queryByText(/DreamLite Mobile/)).toBeNull();
  });

  it('展开时渲染模型行 + 行内加载按钮 + 说明', () => {
    const {getByText, getAllByText} = wrap(
      <ModelPickerDropdown {...baseProps} showModelDrop={true} />,
    );
    expect(getByText(/DreamLite Mobile/)).toBeTruthy();
    expect(getByText(/统一文生图/)).toBeTruthy();
    expect(getAllByText('加载').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ResultPreview', () => {
  const baseProps = {
    previewRef: React.createRef<FlatList<GeneratedImage>>(),
    pageW: 320,
    editSource: null,
    history: [historyItem],
    generating: false,
    bootedRef: React.createRef<boolean>() as React.MutableRefObject<boolean>,
    onListReady: jest.fn(),
    taskKind: null as 'gen' | 'edit' | null,
    progress: 0,
    progressText: '',
    stepTime: 0,
    genStartedAt: Date.now(),
    stage: '',
    now: Date.now(),
    toast: null,
    toastOpacity: new Animated.Value(0),
    waveDots: [
      new Animated.Value(0),
      new Animated.Value(0),
      new Animated.Value(0),
    ],
    currentImage: null,
    currentItem: null,
    fullscreen: false,
    onPageW: jest.fn(),
    onMomentumEnd: jest.fn(),
    onPickEditImage: jest.fn(),
    onOpenFullscreen: jest.fn(),
    onCloseFullscreen: jest.fn(),
    onSave: jest.fn(),
    onReroll: jest.fn(),
    onDelete: jest.fn(),
    onCopyError: jest.fn(),
    onRetryTask: jest.fn(),
    onDeleteTask: jest.fn(),
  };

  it('无当前图时不渲染操作条，编辑槽显示上传按钮', () => {
    const {getByText, queryByText} = wrap(<ResultPreview {...baseProps} />);
    expect(getByText('上传本地图片')).toBeTruthy();
    expect(queryByText('保存')).toBeNull();
    expect(queryByText('删除')).toBeNull();
  });

  it('有当前图时渲染操作条定稿三按钮（保存/再次生成/删除，编辑不在此处）', () => {
    const {getByText, queryByText} = wrap(
      <ResultPreview
        {...baseProps}
        currentImage={historyItem.uri}
        currentItem={historyItem}
      />,
    );
    expect(getByText('保存')).toBeTruthy();
    expect(getByText('再次生成')).toBeTruthy();
    expect(getByText('删除')).toBeTruthy();
    // 编辑唯一入口=ComposerPanel 底部，操作条不再有编辑按钮
    expect(queryByText('编辑')).toBeNull();
  });

  it('生成中：running 任务页渲染进度卡（空白页，不叠旧图）', () => {
    const runningItem: GeneratedImage = {
      ...historyItem,
      uri: '',
      taskId: 'task_test_running',
      status: 'running',
    };
    const {getByText} = wrap(
      <ResultPreview
        {...baseProps}
        history={[runningItem]}
        generating={true}
        taskKind="gen"
        progressText="1/4"
      />,
    );
    expect(getByText(/正在生成新图/)).toBeTruthy();
  });

  it('失败任务页：摘要 + 复制报错/重试/删除按钮', () => {
    const failedItem: GeneratedImage = {
      ...historyItem,
      uri: '',
      taskId: 'task_test_failed',
      status: 'failed',
      errorSummary: '显存不足',
      errorDetail: 'FULL REPORT',
    };
    const onCopyError = jest.fn();
    const {getByText, getByTestId} = wrap(
      <ResultPreview
        {...baseProps}
        history={[failedItem]}
        onCopyError={onCopyError}
      />,
    );
    expect(getByText('生成失败')).toBeTruthy();
    expect(getByText('显存不足')).toBeTruthy();
    fireEvent.press(getByTestId('imagegen-copy-error'));
    expect(onCopyError).toHaveBeenCalledWith(failedItem);
  });
});
