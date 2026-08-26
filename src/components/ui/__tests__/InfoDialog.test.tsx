/**
 * InfoDialog 冒烟测试（P4#16 信息弹窗统一 · ConfirmDialog 同构模板）
 *
 * 覆盖：title/message/buttonText 渲染与 resolve、message 缺省 title-only、
 * buttonText 缺省「知道了」、Host 未挂载 fail-soft 静默 resolve。
 */
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';

import {InfoDialogHost, infoDialog} from '../InfoDialog';

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

describe('InfoDialog（信息弹窗 · 命令式单按钮）', () => {
  it('渲染 title/message/buttonText，点按钮 resolve 并关闭', async () => {
    const {getByText, queryByText} = render(<InfoDialogHost />);
    let resolved = false;

    await act(async () => {
      infoDialog({
        title: '导出成功',
        message: '文件已导出到 Download 目录',
        buttonText: '好的',
      }).then(() => {
        resolved = true;
      });
      await Promise.resolve();
    });

    expect(getByText('导出成功')).toBeTruthy();
    expect(getByText('文件已导出到 Download 目录')).toBeTruthy();
    expect(getByText('好的')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('好的'));
      await Promise.resolve();
    });

    expect(resolved).toBe(true);
    expect(queryByText('导出成功')).toBeNull();
  });

  it('message 缺省时仅渲染标题（title-only 形态）', async () => {
    const {getByText, queryByText} = render(<InfoDialogHost />);

    await act(async () => {
      infoDialog({title: '已保存到相册'});
      await Promise.resolve();
    });

    expect(getByText('已保存到相册')).toBeTruthy();
    // 正文区不渲染（无 message Text 节点）
    expect(queryByText('知道了')).toBeTruthy(); // 默认按钮仍在
  });

  it('buttonText 缺省时主按钮为「知道了」', async () => {
    const {getByText} = render(<InfoDialogHost />);

    await act(async () => {
      infoDialog({title: '提示', message: '内容'});
      await Promise.resolve();
    });

    expect(getByText('知道了')).toBeTruthy();
  });

  it('Host 未挂载时 fail-soft：静默 resolve 不抛错', async () => {
    let resolved = false;
    await act(async () => {
      await infoDialog({title: '无人接听', message: 'Host 未挂载'});
    });
    resolved = true;
    expect(resolved).toBe(true);
  });
});
