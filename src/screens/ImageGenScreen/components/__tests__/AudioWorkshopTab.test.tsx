import React from 'react';
import {fireEvent} from '@testing-library/react-native';

import {render} from '../../../../../jest/test-utils';
import {AudioWorkshopTab} from '../AudioWorkshopTab';
import {GeneratedImage} from '../../../../store/imageGenStore';

// B36 回归：音频工坊结果区整卡三态（running 波浪 / success 全文卡 / failed 报错页）
// + 历史条点按联动结果区 + 引擎状态全部收口顶栏（composer 无模型管理行）。

const makeTask = (
  over: Partial<GeneratedImage> & {kind: 'transcribe' | 'tts'},
): GeneratedImage => ({
  uri: '',
  prompt: '测试音频内容',
  seed: 0,
  ts: Date.now(),
  width: 0,
  height: 0,
  family: 'tts',
  taskId: 'task_test',
  status: 'success',
  ...over,
});

// 可变 mock 状态：用例内改写后渲染——v1.11 起用 mobx observable（吸底条/切段经
// observer 订阅联动；此前普通对象切段依赖组件内 useState 才能重渲染）
jest.mock('../../../../store/audioStore', () => {
  const {observable} = require('mobx');
  // deep:false —— 函数属性（jest.fn）保持原样，不被 observable 包装（否则 toHaveBeenCalled 失配）
  const state: Record<string, any> = observable(
    {
      transcribing: false,
      transcribeStage: '',
      ttsGenerating: false,
      ttsStage: '',
      genEngine: 'kokoro',
      asrState: 'ready',
      asrProgress: 0,
      // B38 播放器状态机
      playingUri: null,
      playPosition: 0,
      playDuration: 0,
      isPlaying: false,
      // v1.11 吸底条共享状态（observable：切段/输入经 observer 联动）
      audioSeg: 'transcribe',
      genText: '',
      voiceId: null,
      speed: 1.0,
      supertonicSteps: 5,
      togglePlay: jest.fn(),
      seekTo: jest.fn(),
      stopPlayback: jest.fn(),
      refreshAsrState: jest.fn(),
      generateTask: jest.fn(),
      transcribeTask: jest.fn(),
      setGenEngine: jest.fn(),
      setAudioSeg: (v: string) => {
        state.audioSeg = v;
      },
      setGenText: (v: string) => {
        state.genText = v;
      },
      setVoiceId: (v: string | null) => {
        state.voiceId = v;
      },
      setSpeed: (v: number) => {
        state.speed = v;
      },
      setSupertonicSteps: (v: number) => {
        state.supertonicSteps = v;
      },
    },
    {},
    {deep: false},
  );
  return {audioStore: state};
});

jest.mock('../../../../store/imageGenStore', () => ({
  imageGenStore: {
    history: [],
    deleteTask: jest.fn(),
    beginTask: jest.fn(),
    finishTask: jest.fn(),
    failTask: jest.fn(),
  },
}));

jest.mock('../../../../store/TTSStore', () => ({
  ttsStore: {
    kokoroDownloadState: 'ready',
    supertonicDownloadState: 'ready',
    kittenDownloadState: 'ready',
    kokoroDownloadProgress: 0,
    supertonicDownloadProgress: 0,
    kittenDownloadProgress: 0,
  },
}));

jest.mock('../../../../store', () => ({
  chatSessionStore: {
    addMessageToCurrentSession: jest.fn(),
  },
}));

jest.mock('../../../../services/tts', () => ({
  SUPERTONIC_VOICES: [{id: 'v1', name: 'Voice1'}],
  KOKORO_VOICES: [{id: 'v1', name: 'Voice1'}],
  KITTEN_VOICES: [{id: 'v1', name: 'Voice1'}],
}));

jest.mock('../../../../services/ttsEngine', () => ({
  playTtsFile: jest.fn().mockResolvedValue(1000),
  getPlayPosition: jest.fn().mockResolvedValue({
    position: 0,
    duration: 1000,
    isPlaying: false,
  }),
  seekPlayFile: jest.fn(),
  pausePlayFile: jest.fn(),
  resumePlayFile: jest.fn(),
  stopTtsPlay: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../services/asrEngine', () => ({
  resolveAudioPath: jest.fn(),
}));

jest.mock('../../../../utils/errorReport', () => ({
  copyAndSaveErrorReport: jest.fn().mockResolvedValue('/mock/audio_error.txt'),
}));

jest.mock('../../../../components/InputSlider', () => ({
  InputSlider: () => null,
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {audio: 'audio/*'},
}));

// B38：时间轴 Slider 为原生组件，jest 环境降级为纯 View
jest.mock('@react-native-community/slider', () => {
  const R = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => R.createElement(View, props),
  };
});

// v1.10：波形条读文件逻辑依赖原生 RNFS，jest 环境降级为占位 View
jest.mock('../WaveformBars', () => {
  const R = require('react');
  const {View} = require('react-native');
  return {
    WaveformBars: (props: any) =>
      R.createElement(View, {...props, testID: 'waveform-bars'}),
  };
});

// v1.11：跑分面板数据源为 imageGenStore（本测试 mock 无 perf 字段），降级占位
jest.mock('../PerfPanel', () => {
  const R = require('react');
  const {View} = require('react-native');
  return {
    PerfPanel: () => R.createElement(View, {testID: 'perf-panel'}),
  };
});

const imageGenStoreMock =
  require('../../../../store/imageGenStore').imageGenStore;
const audioStoreMock = require('../../../../store/audioStore').audioStore;

const renderTab = () => render(<AudioWorkshopTab onSnackbar={jest.fn()} />);

describe('AudioWorkshopTab 结果区三态（B36）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    audioStoreMock.transcribing = false;
    audioStoreMock.ttsGenerating = false;
    audioStoreMock.genEngine = 'kokoro';
    audioStoreMock.audioSeg = 'transcribe';
    audioStoreMock.genText = '';
  });

  it('转写段 success：3 行折叠全文 + 播放原文/复制/发送到聊天/删除四按钮', () => {
    imageGenStoreMock.history = [
      makeTask({
        kind: 'transcribe',
        taskId: 't1',
        prompt: '转写出的文字内容',
        modelLabel: 'SenseVoice',
        uri: '/tmp/in.wav',
      }),
    ];
    const {getAllByText, getByText, getByTestId} = renderTab();
    expect(getByText('转写结果')).toBeTruthy();
    // 结果区 + 历史方形卡同文本（72px 卡），多节点匹配
    expect(getAllByText('转写出的文字内容').length).toBeGreaterThan(0);
    expect(getByText('展开 ▾')).toBeTruthy();
    // v1.10：对照播放（源音频持久化后播放原文/暂停原文切换）
    expect(getByTestId('audio-play-source')).toBeTruthy();
    expect(getByText('播放原文')).toBeTruthy();
    audioStoreMock.playingUri = '/tmp/in.wav';
    audioStoreMock.isPlaying = true;
    const {queryByText: q} = renderTab();
    expect(q('暂停原文')).toBeTruthy();
    expect(getByTestId('audio-copy')).toBeTruthy();
    expect(getByTestId('audio-send-chat')).toBeTruthy();
    expect(getByTestId('audio-delete-transcribe')).toBeTruthy();
  });

  // v1.10 回归：useMemo 依赖 history.length 对 finishTask status patch 不重算，
  // 新转写成功后历史条永不出现（2026-08-30 真机实锤）——直接派生后 status 变更即刷新
  it('转写任务 running→success（数组长度不变）后历史条出现（v1.10 回归）', () => {
    imageGenStoreMock.history = [
      makeTask({
        kind: 'transcribe',
        taskId: 't1',
        prompt: '你好',
        status: 'running',
      }),
    ];
    const {getByText, queryByText, rerender} = renderTab();
    expect(queryByText('转写记录 (1)')).toBeNull();
    imageGenStoreMock.history[0].status = 'success';
    rerender(<AudioWorkshopTab onSnackbar={jest.fn()} />);
    expect(getByText('转写记录 (1)')).toBeTruthy();
  });

  it('转写段 failed：报错页三按钮（复制报错/重试/删除）+ 摘要', () => {
    imageGenStoreMock.history = [
      makeTask({
        kind: 'transcribe',
        taskId: 't1',
        status: 'failed',
        errorSummary: '转写失败：音频解码错误',
        errorDetail: 'detail...',
        uri: '/tmp/in.wav',
      }),
    ];
    const {getByText, getByTestId} = renderTab();
    expect(getByText('转写失败')).toBeTruthy();
    expect(getByText('转写失败：音频解码错误')).toBeTruthy();
    expect(getByTestId('audio-copy-error')).toBeTruthy();
    expect(getByTestId('audio-retry-transcribe')).toBeTruthy();
  });

  it('转写段 running：三点波浪进度卡（阶段文本可见）', () => {
    audioStoreMock.transcribing = true;
    audioStoreMock.transcribeStage = '加载语音模型…';
    const {getByText} = renderTab();
    expect(getByText('正在转写…')).toBeTruthy();
    expect(getByText(/加载语音模型…/)).toBeTruthy();
  });

  it('历史条点按联动：点第二条 → 结果区切换为该条内容（不直接播放/复制）', () => {
    imageGenStoreMock.history = [
      makeTask({kind: 'transcribe', taskId: 't2', prompt: '最新转写内容'}),
      makeTask({kind: 'transcribe', taskId: 't1', prompt: '旧转写内容'}),
    ];
    const {getAllByText, getByTestId} = renderTab();
    // 默认显示最新（结果区 + 历史方形卡同文本，多节点）
    expect(getAllByText('最新转写内容').length).toBeGreaterThan(0);
    // 点历史卡第二条（testID 定位）
    fireEvent.press(getByTestId('audio-history-transcribe-t1'));
    expect(getAllByText('旧转写内容').length).toBeGreaterThan(0);
    // 结果区已切换：最新内容只剩历史卡节点
    expect(getAllByText('最新转写内容').length).toBe(1);
  });

  it('生成段 failed：生成失败 + 重试按钮', () => {
    imageGenStoreMock.history = [
      makeTask({
        kind: 'tts',
        taskId: 't1',
        status: 'failed',
        errorSummary: '生成失败：模型未安装完整',
        prompt: '要合成的文本',
      }),
    ];
    const {getByText, getByTestId} = renderTab();
    fireEvent.press(getByTestId('audio-seg-generate'));
    expect(getByText('生成失败')).toBeTruthy();
    expect(getByText('生成失败：模型未安装完整')).toBeTruthy();
    expect(getByTestId('audio-retry-tts')).toBeTruthy();
  });

  it('生成段 success：播放器预览窗口（大播放键 + 时间轴 + 时长）', () => {
    imageGenStoreMock.history = [
      makeTask({
        kind: 'tts',
        taskId: 't1',
        prompt: '你好',
        modelLabel: 'Kitten',
        durationMs: 2500,
        uri: 'file:///tmp/a.wav',
      }),
    ];
    const {getByText, getByTestId} = renderTab();
    fireEvent.press(getByTestId('audio-seg-generate'));
    expect(getByTestId('audio-play-big')).toBeTruthy();
    // v1.10：波形条（时间轴上方）
    expect(getByTestId('waveform-bars')).toBeTruthy();
    expect(getByText('Kitten · 0:03')).toBeTruthy();
    expect(getByText('0:00')).toBeTruthy();
    expect(getByText('0:03')).toBeTruthy();
    expect(getByTestId('audio-regen')).toBeTruthy();
    expect(getByTestId('audio-share')).toBeTruthy();
    expect(getByTestId('audio-delete')).toBeTruthy();
  });

  it('生成段历史卡点击：仅加载预览窗口，不直接播放', () => {
    imageGenStoreMock.history = [
      makeTask({
        kind: 'tts',
        taskId: 't1',
        prompt: '第一条',
        uri: 'file:///tmp/a.wav',
      }),
      makeTask({
        kind: 'tts',
        taskId: 't2',
        prompt: '第二条',
        uri: 'file:///tmp/b.wav',
      }),
    ];
    const {getByTestId} = renderTab();
    fireEvent.press(getByTestId('audio-seg-generate'));
    fireEvent.press(getByTestId('audio-history-tts-t2'));
    expect(audioStoreMock.togglePlay).not.toHaveBeenCalled();
  });

  it('生成段无模型管理行（B36：引擎状态/动作并入顶栏下拉）', () => {
    imageGenStoreMock.history = [
      makeTask({kind: 'tts', taskId: 't1', prompt: '你好'}),
    ];
    const {queryByText, queryByTestId, getByTestId} = renderTab();
    fireEvent.press(getByTestId('audio-seg-generate'));
    expect(queryByText('Kokoro（330MB）')).toBeNull();
    expect(queryByText('Supertonic（380MB）')).toBeNull();
    expect(queryByText('Kitten（57MB）')).toBeNull();
    // v1.11：生成按钮已移吸底条（ImageGenScreen 层 AudioActionBar），tab 内无重复按钮
    expect(queryByTestId('audio-generate')).toBeNull();
  });

  // v1.11：生成按钮吸底——吸底条本体在 ImageGenScreen 层（AudioActionBar 单独测试），
  // tab 层验证两点：转写段/生成段均无吸底条实例、composer 无重复生成按钮
  it('tab 层无吸底条与重复生成按钮（v1.11，本体另测 AudioActionBar）', () => {
    imageGenStoreMock.history = [
      makeTask({kind: 'tts', taskId: 't1', prompt: '你好', uri: '/tmp/a.wav'}),
    ];
    audioStoreMock.genText = '你好';
    const {queryByTestId, getByTestId} = renderTab();
    expect(queryByTestId('audio-action-bar')).toBeNull();
    fireEvent.press(getByTestId('audio-seg-generate'));
    expect(queryByTestId('audio-action-bar')).toBeNull();
    expect(queryByTestId('audio-generate')).toBeNull();
  });

  // v1.11：TTS running 页含跑分面板（复用生图 PerfPanel，任务流统一跑分）
  it('TTS 生成中 running 页含跑分面板（v1.11）', () => {
    audioStoreMock.ttsGenerating = true;
    audioStoreMock.ttsStage = '加载模型…';
    const {getByText, getByTestId} = renderTab();
    fireEvent.press(getByTestId('audio-seg-generate'));
    expect(getByText('正在生成音频…')).toBeTruthy();
    expect(getByTestId('perf-panel')).toBeTruthy();
  });
});
