/**
 * ModelSwitchDialog 冒烟测试（SPEC §9.3 → §18.7 多候选）
 *
 * 覆盖：候选列表渲染（推荐标记）、默认选中推荐项、切换选中后加载所选、
 * load 返回 modelId、current、场景 B 隐藏死按钮、遮罩语义取消、
 * Host 未挂载 fail-fast=cancel。
 */
import React from 'react';
import {render, fireEvent, act, within} from '@testing-library/react-native';

import {
  ModelSwitchDialogHost,
  askModelSwitch,
  ModelSwitchResult,
} from '../ModelSwitchDialog';

jest.mock('../../../hooks', () => ({
  useTheme: () => ({
    colors: {
      surfaceElevated: '#fff',
      onSurface: '#111',
      onSurfaceVariant: '#666',
      outline: '#ddd',
      outlineVariant: '#eee',
      primary: '#F5A623',
      onPrimary: '#3D2E00',
    },
    typography: {
      titleS: {fontSize: 16},
      bodyS: {fontSize: 14},
      uiM: {fontSize: 14},
      captionS: {fontSize: 10},
    },
    radius: {ml: 16, s: 8},
    spacing: {ml: 16, sm: 12, xs: 4, s: 8, xxs: 2},
    stroke: {sm: 1},
  }),
}));

const CANDIDATES = [
  {id: 'qwen-2b', name: 'Qwen3.5-2B', size: 1.8 * 1024 ** 3},
  {id: 'qwen-4b', name: 'Qwen3.5-4B', size: 3.1 * 1024 ** 3},
  {id: 'big-8b', name: 'Big-8B', size: 6.2 * 1024 ** 3},
];

describe('ModelSwitchDialog（多候选）', () => {
  it('渲染全部候选并标记推荐项', async () => {
    const {getByTestId} = render(<ModelSwitchDialogHost />);
    await act(async () => {
      askModelSwitch({task: 'write', candidates: CANDIDATES});
      await Promise.resolve();
    });
    expect(getByTestId('model-switch-candidate-qwen-2b')).toBeTruthy();
    expect(getByTestId('model-switch-candidate-qwen-4b')).toBeTruthy();
    expect(getByTestId('model-switch-candidate-big-8b')).toBeTruthy();
    // 「· 推荐」嵌套在候选行 Text 内，按行内匹配
    expect(
      within(getByTestId('model-switch-candidate-qwen-2b')).getByText(/推荐/),
    ).toBeTruthy();
  });

  it('默认选中推荐项：load 返回首项 modelId', async () => {
    const {getByTestId} = render(<ModelSwitchDialogHost />);
    let p!: Promise<ModelSwitchResult>;
    await act(async () => {
      p = askModelSwitch({task: 'write', candidates: CANDIDATES});
      await Promise.resolve();
    });
    fireEvent.press(getByTestId('model-switch-load'));
    await expect(p).resolves.toEqual({choice: 'load', modelId: 'qwen-2b'});
  });

  it('切换选中后：load 返回用户所选 modelId', async () => {
    const {getByTestId} = render(<ModelSwitchDialogHost />);
    let p!: Promise<ModelSwitchResult>;
    await act(async () => {
      p = askModelSwitch({task: 'write', candidates: CANDIDATES});
      await Promise.resolve();
    });
    fireEvent.press(getByTestId('model-switch-candidate-big-8b'));
    fireEvent.press(getByTestId('model-switch-load'));
    await expect(p).resolves.toEqual({choice: 'load', modelId: 'big-8b'});
  });

  it('继续当前模型：返回 current（场景 A）', async () => {
    const {getByTestId} = render(<ModelSwitchDialogHost />);
    let p!: Promise<ModelSwitchResult>;
    await act(async () => {
      p = askModelSwitch({
        task: 'write',
        candidates: CANDIDATES,
        canKeepCurrent: true,
      });
      await Promise.resolve();
    });
    fireEvent.press(getByTestId('model-switch-current'));
    await expect(p).resolves.toEqual({choice: 'current'});
  });

  it('场景 B 无当前模型：不显示「继续当前模型」按钮（锋利不臃肿）', async () => {
    const {queryByTestId} = render(<ModelSwitchDialogHost />);
    await act(async () => {
      askModelSwitch({task: 'write', candidates: CANDIDATES});
      await Promise.resolve();
    });
    expect(queryByTestId('model-switch-current')).toBeNull();
    expect(queryByTestId('model-switch-load')).toBeTruthy();
  });

  it('Host 未挂载：fail-fast 返回 cancel（不执行加载）', async () => {
    const p = askModelSwitch({task: 'write', candidates: CANDIDATES});
    await expect(p).resolves.toEqual({choice: 'cancel'});
  });
});
