/**
 * AudioActionBar 测试（v1.11：生成按钮吸底操作条——生图 GenActionBar 裁定向平移）
 * store 驱动（audioStore observable + ttsStore）与 AudioWorkshopTab 共享状态。
 */
import React from 'react';
import {fireEvent} from '@testing-library/react-native';

import {render} from '../../../../../jest/test-utils';
import {AudioActionBar} from '../AudioActionBar';

jest.mock('../../../../store/audioStore', () => {
  const {observable} = require('mobx');
  // deep:false —— 函数属性（jest.fn）保持原样
  const state: Record<string, any> = observable(
    {
      audioSeg: 'transcribe',
      genText: '',
      voiceId: 'v1',
      speed: 1.0,
      supertonicSteps: 5,
      genEngine: 'kokoro',
      ttsGenerating: false,
      generateTask: jest.fn().mockResolvedValue(true),
      setAudioSeg: (v: string) => {
        state.audioSeg = v;
      },
      setGenText: (v: string) => {
        state.genText = v;
      },
    },
    {},
    {deep: false},
  );
  return {audioStore: state};
});

jest.mock('../../../../store/TTSStore', () => ({
  ttsStore: {
    kokoroDownloadState: 'ready',
    supertonicDownloadState: 'ready',
    kittenDownloadState: 'ready',
  },
}));

jest.mock('../../../../services/tts', () => ({
  SUPERTONIC_VOICES: [{id: 'v1', name: 'Voice1'}],
  KOKORO_VOICES: [{id: 'v1', name: 'Voice1'}],
  KITTEN_VOICES: [{id: 'v1', name: 'Voice1'}],
}));

const audioStoreMock = require('../../../../store/audioStore').audioStore;

const renderBar = (onSnackbar = jest.fn()) =>
  render(<AudioActionBar onSnackbar={onSnackbar} />);

describe('AudioActionBar 底部吸底操作条（v1.11）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    audioStoreMock.audioSeg = 'transcribe';
    audioStoreMock.genText = '';
    audioStoreMock.ttsGenerating = false;
    audioStoreMock.genEngine = 'kokoro';
  });

  it('转写段不渲染（不占位；生成段才常驻吸底条）', () => {
    const {queryByTestId} = renderBar();
    expect(queryByTestId('audio-action-bar')).toBeNull();
  });

  it('生成段渲染吸底条；空文本禁用、有文本可用', () => {
    audioStoreMock.audioSeg = 'generate';
    const {getByTestId, queryByText} = renderBar();
    expect(getByTestId('audio-action-bar')).toBeTruthy();
    expect(queryByText('生成音频')).toBeTruthy();
    // 空文本 → 禁用
    expect(
      getByTestId('audio-generate').props.accessibilityState?.disabled,
    ).toBe(true);
    audioStoreMock.genText = '你好';
    const {getByTestId: g2} = renderBar();
    expect(g2('audio-generate').props.accessibilityState?.disabled).not.toBe(
      true,
    );
  });

  it('点击生成：调 generateTask（引擎/文本/音色/语速/步数）并成功提示', async () => {
    audioStoreMock.audioSeg = 'generate';
    audioStoreMock.genText = '你好呀';
    const onSnackbar = jest.fn();
    const {getByTestId} = renderBar(onSnackbar);
    fireEvent.press(getByTestId('audio-generate'));
    expect(audioStoreMock.generateTask).toHaveBeenCalledWith(
      'kokoro',
      '你好呀',
      {id: 'v1', name: 'Voice1'},
      {speed: 1.0, numSteps: 5},
    );
    // 异步 resolve 后提示（等待微任务）
    await Promise.resolve();
    expect(onSnackbar).toHaveBeenCalledWith('音频已生成');
  });

  it('生成中：按钮转圈（文字消失），仍可点按触发不重复校验', () => {
    audioStoreMock.audioSeg = 'generate';
    audioStoreMock.genText = '你好';
    audioStoreMock.ttsGenerating = true;
    const {getByTestId, queryByText} = renderBar();
    expect(getByTestId('audio-generate')).toBeTruthy();
    expect(queryByText('生成音频')).toBeNull(); // 转圈替代文字
    expect(
      getByTestId('audio-generate').props.accessibilityState?.disabled,
    ).toBe(true);
  });
});
