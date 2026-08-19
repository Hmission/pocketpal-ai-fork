import React from 'react';
import {FlatList} from 'react-native';
import {act, fireEvent, render, waitFor} from '../../../../jest/test-utils';
import {ImageGenScreen} from '../ImageGenScreen';
import {imageGenStore} from '../../../store/imageGenStore';
import {listAvailableModels} from '../../../utils/imageGenManifest';
import {launchImageLibrary} from 'react-native-image-picker';

// P4 编排层对齐（MASTER_LOG §13.2）：仅 Panel 级冒烟不够，这里覆盖
// Screen 编排层全链路——出图流 / 编辑流，mock 单通道（dreamLiteEngine 经 store 收口）。

// 编排层不扫真实设备目录：DreamLite 固定置顶（scanModels 拼接），其余模型列表为空。
jest.mock('../../../utils/imageGenManifest', () => ({
  listAvailableModels: jest.fn().mockResolvedValue([]),
  resolveCompanions: jest.fn().mockResolvedValue({extras: {}, missing: []}),
}));

// 报错报告工具 mock：编排层失败路径调 buildErrorReport 组装报告 → failTask 回填任务。
jest.mock('../../../utils/errorReport', () => ({
  buildErrorReport: jest.fn().mockResolvedValue({
    summary: '报错摘要mock',
    detail: '报错详情mock',
  }),
  copyAndSaveErrorReport: jest.fn().mockResolvedValue('/mock/error.txt'),
}));

// imageGenStore 单通道 mock：只保留编排层消费的字段/方法，行为由用例注入。
jest.mock('../../../store/imageGenStore', () => ({
  imageGenStore: {
    modelLoaded: false,
    loadedModelId: null,
    dreamliteLoaded: false,
    generating: false,
    error: null,
    history: [],
    pendingPrompt: null,
    pendingEditSource: null,
    chatInlineGenerating: false,
    loading: false,
    loadingStartedAt: 0,
    progress: -1,
    progressText: '',
    stage: '',
    logTail: [],
    lastEventAt: 0,
    stepTime: 0,
    genStartedAt: 0,
    gpuRenderer: '',
    init: jest.fn().mockResolvedValue(undefined),
    pushHistory: jest.fn(),
    deleteHistory: jest.fn().mockResolvedValue(undefined),
    saveToAlbum: jest.fn().mockResolvedValue(true),
    loadModel: jest.fn().mockResolvedValue(true),
    unloadModel: jest.fn().mockResolvedValue(undefined),
    loadDreamLiteEntry: jest.fn().mockResolvedValue(true),
    unloadDreamLiteEntry: jest.fn().mockResolvedValue(undefined),
    generate: jest.fn().mockResolvedValue(null),
    generateDreamLiteEntry: jest.fn().mockResolvedValue(null),
    editDreamLiteEntry: jest.fn().mockResolvedValue(null),
    decodeEditImage: jest.fn().mockResolvedValue(new Float32Array(0)),
    setChatInlineGenerating: jest.fn(),
    // 任务化契约：beginTask 建 running 条目 → 成功 finishTask 回填 uri / 失败 failTask 回填报错
    beginTask: jest.fn().mockReturnValue('task_test_1'),
    finishTask: jest.fn(),
    failTask: jest.fn(),
    pushFailedTask: jest.fn(),
    deleteTask: jest.fn(),
  },
}));

// KeyboardAwareScrollView 需要原生模块，测试环境降级为纯 View。
jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    KeyboardAwareScrollView: (props: any) =>
      React.createElement(View, props),
  };
});

// 编排层不挂在真实 Navigator screen 上下文：useNavigation 降级为桩（setOptions 是 headerRight 挂载点）。
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      addListener: jest.fn((_evt: string, _cb: any) => ({remove: jest.fn()})),
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      dispatch: jest.fn(),
    }),
    useRoute: () => ({key: 'test', name: 'ImageGen'}),
  };
});

const mockGenerate = imageGenStore.generateDreamLiteEntry as jest.Mock;
const mockEdit = imageGenStore.editDreamLiteEntry as jest.Mock;
const mockDecode = imageGenStore.decodeEditImage as jest.Mock;
const mockPush = imageGenStore.pushHistory as jest.Mock;
const mockList = listAvailableModels as jest.Mock;
const mockBeginTask = imageGenStore.beginTask as jest.Mock;
const mockFinishTask = imageGenStore.finishTask as jest.Mock;
const mockFailTask = imageGenStore.failTask as jest.Mock;
const {buildErrorReport} = require('../../../utils/errorReport');

describe('ImageGenScreen 编排层（P4 对齐）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockReset();
    mockEdit.mockReset();
    mockDecode.mockReset();
    mockPush.mockReset();
    mockList.mockReset();
    mockList.mockResolvedValue([]);
    mockDecode.mockResolvedValue(new Float32Array(4 * 1024 * 1024));
    mockBeginTask.mockReset();
    mockBeginTask.mockReturnValue('task_test_1');
    mockFinishTask.mockReset();
    mockFailTask.mockReset();
    (buildErrorReport as jest.Mock).mockReset();
    (buildErrorReport as jest.Mock).mockResolvedValue({
      summary: '报错摘要mock',
      detail: '报错详情mock',
    });
    (imageGenStore as any).error = null;
    (imageGenStore as any).generating = false;
    (imageGenStore as any).history = [];
    // 编排层滚动定位依赖 FlatList ref；jest 环境无原生实现，noop 化避免抛错
    jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => {});
    // toast 2.5s 自动淡出：fake timers 接管，防 teardown 后访问已销毁 RN 模块
    jest.useFakeTimers();
  });

  afterEach(() => {
    (FlatList.prototype.scrollToOffset as any).mockRestore?.();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  /** 渲染并等待扫描完成（DreamLite 置顶选中 → 「编辑」按钮出现） */
  const renderAndWaitScan = async () => {
    const utils = render(<ImageGenScreen />, {withNavigation: true});
    await waitFor(() => {
      expect(utils.getByText('编辑')).toBeTruthy();
    });
    return utils;
  };

  it('真机事件形态回归（2026-08-20 血证）：onPress 收到 GestureResponderEvent 时不得污染 promptOverride——出图必须正常发起', async () => {
    // 真机 RN 事件分发必把 GestureResponderEvent 作为首参传给 onPress；jest 的
    // fireEvent.press 默认不传参，拦不住「onPress 直传带参回调」的回归——
    // 曾导致 handleGenerate(event) → event.trim() TypeError 被事件系统吞掉，
    // 两台真机「有按压缩放动效但出图无反应」（v144 实锤，注入三重复现）。
    mockGenerate.mockResolvedValue('file:///tmp/gen_event.png');
    const {getByPlaceholderText, getByTestId} = await renderAndWaitScan();

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('描述你想生成的画面…'),
        '一只猫',
      );
    });
    await act(async () => {
      fireEvent.press(getByTestId('imagegen-generate'), {
        nativeEvent: {touches: [], changedTouches: []},
      });
    });

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith(1024, 1024, 4, '一只猫');
    });
  });

  it('出图流：输入提示词 → 点出图 → DreamLite 单通道（1024²·4 步）→ 入历史', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_1.png');
    const {getByPlaceholderText, getByText} = await renderAndWaitScan();

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('描述你想生成的画面…'),
        '一只猫',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('出图'));
    });

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith(1024, 1024, 4, '一只猫');
    });
    // 任务化契约：先建 running 任务，成功后 finishTask 回填 uri
    expect(mockBeginTask).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '一只猫',
        family: 'dreamlite',
        kind: 'generated',
        width: 1024,
        height: 1024,
      }),
    );
    expect(mockFinishTask).toHaveBeenCalledWith(
      'task_test_1',
      'file:///tmp/gen_1.png',
      expect.objectContaining({durationMs: expect.any(Number)}),
    );
    expect(getByText(/生成完成（1024×1024）/)).toBeTruthy();
  });

  it('空提示词点出图：显式 toast 提示（不静默），不触发生成（复查 2026-08-20 真机回归）', async () => {
    mockGenerate.mockClear();
    const {getByText, queryByText} = await renderAndWaitScan();

    await act(async () => {
      fireEvent.press(getByText('出图'));
    });

    // 显式反馈：不再「有动效无反应」
    expect(getByText('先输入提示词，再点出图')).toBeTruthy();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(queryByText(/生成完成/)).toBeNull();
  });

  it('出图流：失败（uri=null）→ 任务保留为 failed（failTask 回填报错），不报生成完成', async () => {
    mockGenerate.mockResolvedValue(null);
    (imageGenStore as any).error = '引擎过热';
    const {getByPlaceholderText, getByText, queryByText} =
      await renderAndWaitScan();

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('描述你想生成的画面…'),
        '一条龙',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('出图'));
    });

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith(1024, 1024, 4, '一条龙');
    });
    expect(mockFinishTask).not.toHaveBeenCalled();
    // 新契约：失败不再走底部 error 展示，而是 failTask 回填报错（页面保留可复制）
    await waitFor(() => {
      expect(mockFailTask).toHaveBeenCalledWith(
        'task_test_1',
        '报错摘要mock',
        '报错详情mock',
      );
    });
    expect(queryByText(/生成完成/)).toBeNull();
  });

  it('编辑流：无图点编辑 → 拉起相册 → 源图入槽 → 输入指令执行编辑 → 二创入历史', async () => {
    mockEdit.mockResolvedValue('file:///tmp/edit_1.png');
    const {getByPlaceholderText, getByText} = await renderAndWaitScan();

    // 无预览图：点「编辑」触发相册上传（launchImageLibrary mock 返回固定 uri）
    await act(async () => {
      fireEvent.press(getByText('编辑'));
    });
    await waitFor(() => {
      expect(launchImageLibrary).toHaveBeenCalled();
      expect(mockDecode).toHaveBeenCalledWith('mock-image-library.jpg', 1024);
    });
    // 源图作为 upload 条目入历史
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: 'file://mock-image-library.jpg',
          kind: 'upload',
        }),
      );
    });

    // 编辑预备态：输入指令后按钮变为「执行编辑」
    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('输入图像编辑指令，如：把天空换成日落、人物换上红色外套…'),
        '把背景改成海边',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('执行编辑'));
    });

    await waitFor(() => {
      expect(mockEdit).toHaveBeenCalledWith(
        expect.any(Float32Array),
        1024,
        1024,
        4,
        '把背景改成海边',
      );
    });
    // 二创结果走任务化：finishTask 回填 uri（不再是第二次 pushHistory）
    await waitFor(() => {
      expect(mockFinishTask).toHaveBeenCalledWith(
        'task_test_1',
        'file:///tmp/edit_1.png',
        expect.objectContaining({durationMs: expect.any(Number)}),
      );
    });
    expect(getByText('编辑完成')).toBeTruthy();
  });

  it('编辑流：执行编辑失败（uri=null）→ 任务保留为 failed（failTask 回填报错）', async () => {
    mockEdit.mockResolvedValue(null);
    (imageGenStore as any).error = '编辑采样失败';
    const {getByPlaceholderText, getByText} = await renderAndWaitScan();

    await act(async () => {
      fireEvent.press(getByText('编辑'));
    });
    await waitFor(() => {
      expect(mockDecode).toHaveBeenCalled();
    });
    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('输入图像编辑指令，如：把天空换成日落、人物换上红色外套…'),
        '加个太阳',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('执行编辑'));
    });

    await waitFor(() => {
      expect(mockEdit).toHaveBeenCalled();
    });
    expect(mockFinishTask).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockFailTask).toHaveBeenCalledWith(
        'task_test_1',
        '报错摘要mock',
        '报错详情mock',
      );
    });
  });

  it('画幅档位：切换 16:9 后出图按 1344×768 走单通道', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_169.png');
    const {getByPlaceholderText, getByText} = await renderAndWaitScan();

    // 展开高级参数 → 选 16:9 档位
    await act(async () => {
      fireEvent.press(getByText(/高级参数/));
    });
    await act(async () => {
      fireEvent.press(getByText('16:9'));
    });
    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('描述你想生成的画面…'),
        '海边日落',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('出图'));
    });

    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith(1344, 768, 4, '海边日落');
    });
  });
});
