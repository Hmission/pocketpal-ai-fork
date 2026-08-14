import React from 'react';
import {Keyboard} from 'react-native';

import {render as baseRender} from '../../../../jest/test-utils';
import {createModel} from '../../../../jest/fixtures/models';
import {ModelType} from '../../../utils/types';

import {ChatPalModelPickerSheet} from '../ChatPalModelPickerSheet';
import {modelStore} from '../../../store';

// Keyboard.addListener 在测试环境需返回带 remove 的订阅对象
jest.spyOn(Keyboard, 'addListener').mockReturnValue({remove: jest.fn()} as any);

const render = (ui: React.ReactElement) =>
  baseRender(ui, {withBottomSheetProvider: true});

// 中文简称注册表命中模型（Qwen3.5-4B → 通义千问 4B）
const llmModel = createModel({
  id: 'llm-qwen',
  name: 'Qwen3.5-4B-Uncensored-Q4_K_M',
  isDownloaded: true,
  modelType: ModelType.LLM,
});

// 非 LLM（projection 嵌入模型）：聊天链路不可加载，弹窗必须不显示
const projectionModel = createModel({
  id: 'proj-qwen',
  name: 'Qwen3.5-mmproj-f16',
  isDownloaded: true,
  modelType: ModelType.PROJECTION,
});

// 生图模型（manifest 声明文件）：即使标 LLM 也必须在聊天选择中屏蔽
const imageGenModel = createModel({
  id: 'img-sd35',
  name: 'sd35_medium_q4_k_m.gguf',
  filename: 'sd35_medium_q4_k_m.gguf',
  isDownloaded: true,
  modelType: ModelType.LLM,
});

describe('ChatPalModelPickerSheet LLM 过滤与中文简称（冒烟）', () => {
  beforeEach(() => {
    (modelStore as any).models = [llmModel, projectionModel, imageGenModel];
    (modelStore as any).activeModelId = undefined;
  });

  it('仅显示 LLM 模型：projection 嵌入模型被过滤', () => {
    const {queryByText} = render(
      <ChatPalModelPickerSheet
        isVisible
        chatInputHeight={0}
        onClose={jest.fn()}
      />,
    );
    expect(queryByText('Qwen3.5-mmproj-f16')).toBeNull();
  });

  it('生图模型（manifest 声明文件）在聊天选择中屏蔽', () => {
    const {queryByText} = render(
      <ChatPalModelPickerSheet
        isVisible
        chatInputHeight={0}
        onClose={jest.fn()}
      />,
    );
    expect(queryByText('sd35_medium_q4_k_m.gguf')).toBeNull();
  });

  it('命中注册表的 LLM 显示中文简称，原名副标题小字', () => {
    const {getByText} = render(
      <ChatPalModelPickerSheet
        isVisible
        chatInputHeight={0}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('通义千问 4B')).toBeTruthy();
    expect(getByText('Qwen3.5-4B-Uncensored-Q4_K_M')).toBeTruthy();
  });
});
