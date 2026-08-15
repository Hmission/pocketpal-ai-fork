import * as React from 'react';
import {runInAction} from 'mobx';

import {render} from '../../../../jest/test-utils';
import {imageGenStore} from '../../../store/imageGenStore';

import {ImageTaskProgress} from '../ImageTaskProgress';

describe('ImageTaskProgress（聊天任务卡生成动效）', () => {
  beforeEach(() => {
    runInAction(() => {
      imageGenStore.loading = false;
      imageGenStore.generating = false;
      imageGenStore.progress = -1;
      imageGenStore.progressText = '';
      imageGenStore.stepTime = 0;
      imageGenStore.stage = '';
      imageGenStore.genStartedAt = 0;
    });
  });

  it('引擎空闲时渲染 null（自守卫：卡片回写瞬间不闪烁）', () => {
    const {queryByTestId} = render(<ImageTaskProgress />);
    expect(queryByTestId('image-task-progress')).toBeNull();
  });

  it('生成中：波浪标题 + 采样进度 + 步耗时 + 总耗时 + 阶段', () => {
    runInAction(() => {
      imageGenStore.generating = true;
      imageGenStore.progress = 50;
      imageGenStore.progressText = '2/4';
      imageGenStore.stepTime = 1.2;
      imageGenStore.stage = 'sampling latent';
      imageGenStore.genStartedAt = Date.now() - 5000;
    });
    const {getByTestId, getByText} = render(<ImageTaskProgress />);
    expect(getByTestId('image-task-progress')).toBeTruthy();
    expect(getByText('正在生成新图…')).toBeTruthy();
    expect(getByText(/采样 2\/4（1\.2s\/步） · 5s/)).toBeTruthy();
    expect(getByText(/▸ sampling latent/)).toBeTruthy();
  });

  it('加载中（无确定进度）：显示加载文案与 2% 底条', () => {
    runInAction(() => {
      imageGenStore.loading = true;
    });
    const {getByText} = render(<ImageTaskProgress />);
    expect(getByText(/加载权重\/准备中/)).toBeTruthy();
  });
});
