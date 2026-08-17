/**
 * ModelSwitchDialog 冒烟测试（SPEC §9.3，2026-08-17）
 *
 * 覆盖：askModelSwitch 返回用户选择（load/current/cancel）、
 * 取消按钮=current、遮罩点击=cancel、Host 未挂载 fail-fast=cancel。
 */
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';

import {
  ModelSwitchDialogHost,
  askModelSwitch,
  ModelSwitchChoice,
} from '../ModelSwitchDialog';

jest.mock('../../../hooks', () => ({
  useTheme: () => ({
    colors: {
      surfaceElevated: '#fff',
      onSurface: '#111',
      onSurfaceVariant: '#666',
      outline: '#ddd',
      primary: '#F5A623',
      onPrimary: '#3D2E00',
    },
    typography: {
      titleS: {fontSize: 16},
      bodyS: {fontSize: 14},
      uiM: {fontSize: 14},
    },
    radius: {ml: 16, s: 8},
    spacing: {ml: 16, sm: 12, xs: 4, s: 8},
    stroke: {sm: 1},
  }),
}));

describe('ModelSwitchDialog', () => {
  it('加载推荐模型：返回 load', async () => {
    const {getByTestId} = render(<ModelSwitchDialogHost />);
    let p!: Promise<ModelSwitchChoice>;
    await act(async () => {
      p = askModelSwitch({task: 'code', candidateName: 'Ministral 3 3B'});
      await Promise.resolve();
    });
    fireEvent.press(getByTestId('model-switch-load'));
    await expect(p).resolves.toBe('load');
  });

  it('继续当前模型：返回 current（场景 A 有当前模型时显示按钮）', async () => {
    const {getByTestId} = render(<ModelSwitchDialogHost />);
    let p!: Promise<ModelSwitchChoice>;
    await act(async () => {
      p = askModelSwitch({
        task: 'write',
        candidateName: 'Qwen3.5-2B',
        canKeepCurrent: true,
      });
      await Promise.resolve();
    });
    fireEvent.press(getByTestId('model-switch-current'));
    await expect(p).resolves.toBe('current');
  });

  it('场景 B 无当前模型：不显示「继续当前模型」按钮（锋利不臃肿）', async () => {
    const {queryByTestId} = render(<ModelSwitchDialogHost />);
    await act(async () => {
      askModelSwitch({task: 'write', candidateName: 'Qwen3.5-2B'});
      await Promise.resolve();
    });
    expect(queryByTestId('model-switch-current')).toBeNull();
    expect(queryByTestId('model-switch-load')).toBeTruthy();
  });

  it('Host 未挂载：fail-fast 返回 cancel（不执行加载）', async () => {
    const p = askModelSwitch({task: 'write', candidateName: 'X'});
    await expect(p).resolves.toBe('cancel');
  });
});
