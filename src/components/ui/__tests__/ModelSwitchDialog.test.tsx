/**
 * ModelSwitchDialog 冒烟测试（SPEC §9.3 → §18.7 多候选 + 弹窗内加载）
 *
 * 覆盖：候选列表渲染（推荐标记 + 一句话说明）、默认选中推荐项、
 * load 返回 modelId、onLoad 弹窗内加载（loading 态 → 自动关）、
 * onLoad 抛错显示失败态（不关闭，可取消）、current、
 * 场景 B 隐藏死按钮、Host 未挂载 fail-fast=cancel。
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
      error: '#B3261E',
      primary: '#F5A623',
      onPrimary: '#3D2E00',
      backdrop: 'rgba(51,51,51,0.6)',
      surfaceContainerLow: '#f2f2f2',
      secondaryContainer: '#e0e0e0',
      onSecondaryContainer: '#424242',
      onError: '#fff',
      pressedStateOpacity: 0.12,
      shadow: '#000',
    },
    typography: {
      titleS: {fontSize: 16},
      bodyS: {fontSize: 14},
      uiM: {fontSize: 14},
      uiS: {fontSize: 12},
      captionS: {fontSize: 10},
    },
    radius: {ml: 16, s: 8, xl: 32, xxs: 4},
    spacing: {ml: 16, sm: 12, xs: 4, s: 8, xxs: 2, m: 16, l: 24},
    stroke: {sm: 1},
    shapeRoles: {surface: 'xl'},
  }),
}));

const CANDIDATES = [
  {
    id: 'qwen-2b',
    name: 'Qwen3.5-2B',
    size: 1.8 * 1024 ** 3,
    note: '写作/聊天主力',
  },
  {
    id: 'qwen-4b',
    name: 'Qwen3.5-4B',
    size: 3.1 * 1024 ** 3,
    note: '日用均衡档',
  },
  {
    id: 'big-8b',
    name: 'Big-8B',
    size: 6.2 * 1024 ** 3,
    note: '更大更强，但加载更慢',
  },
];

describe('ModelSwitchDialog（多候选 + 弹窗内加载）', () => {
  it('渲染全部候选并标记推荐项与一句话说明', async () => {
    const {getByTestId} = render(<ModelSwitchDialogHost />);
    await act(async () => {
      askModelSwitch({task: 'write', candidates: CANDIDATES});
      await Promise.resolve();
    });
    expect(getByTestId('model-switch-candidate-qwen-2b')).toBeTruthy();
    expect(getByTestId('model-switch-candidate-qwen-4b')).toBeTruthy();
    expect(getByTestId('model-switch-candidate-big-8b')).toBeTruthy();
    // 「· 推荐」与一句话说明嵌套在候选行 Text 内，按行内匹配
    expect(
      within(getByTestId('model-switch-candidate-qwen-2b')).getByText(/推荐/),
    ).toBeTruthy();
    expect(
      within(getByTestId('model-switch-candidate-big-8b')).getByText(
        /更大更强/,
      ),
    ).toBeTruthy();
  });

  it('默认选中推荐项：load 返回首项 modelId（无 onLoad 直接关）', async () => {
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

  it('onLoad 弹窗内加载：loading 态 → 完成后自动关并恢复（遮罩保持阻塞）', async () => {
    const onLoad = jest.fn().mockResolvedValue(undefined);
    const {getByTestId, queryByTestId} = render(<ModelSwitchDialogHost />);
    let p!: Promise<ModelSwitchResult>;
    await act(async () => {
      p = askModelSwitch({task: 'write', candidates: CANDIDATES, onLoad});
      await Promise.resolve();
    });
    fireEvent.press(getByTestId('model-switch-load'));
    // loading 态可见（交互阻塞中），弹窗未关
    expect(getByTestId('model-switch-loading')).toBeTruthy();
    expect(onLoad).toHaveBeenCalledWith('qwen-2b');
    await act(async () => {
      await p;
    });
    // 完成后自动关
    expect(queryByTestId('model-switch-loading')).toBeNull();
    await expect(p).resolves.toEqual({choice: 'load', modelId: 'qwen-2b'});
  });

  it('onLoad 抛错：显示失败态不关闭（可取消），不静默', async () => {
    const onLoad = jest.fn().mockRejectedValue(new Error('OOM'));
    const {getByTestId, queryByTestId, getByText} = render(
      <ModelSwitchDialogHost />,
    );
    let resolved = false;
    const p = askModelSwitch({task: 'write', candidates: CANDIDATES, onLoad});
    p.finally(() => {
      resolved = true;
    });
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.press(getByTestId('model-switch-load'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByTestId('model-switch-load-error')).toBeTruthy();
    expect(getByText(/加载失败/)).toBeTruthy();
    // 弹窗未关、未 resolve（失败可重试/取消）
    expect(queryByTestId('model-switch-load-error')).toBeTruthy();
    expect(resolved).toBe(false);
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
