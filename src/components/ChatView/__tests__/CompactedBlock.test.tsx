/**
 * B19 压缩占位卡片测试：折叠态显示「已压缩 N 条早期对话」，点按展开摘要。
 */
import React from 'react';
import {fireEvent, render} from '../../../../jest/test-utils';

import {L10nContext} from '../../../utils';
import {l10n} from '../../../locales';

import {CompactedBlock} from '../CompactedBlock';

const renderBlock = (
  overrides: Partial<React.ComponentProps<typeof CompactedBlock>> = {},
) =>
  render(
    <L10nContext.Provider value={l10n.en}>
      <CompactedBlock
        compaction={{
          summary: '早期对话摘要：大王喜欢本地 AI 玩具。',
          messageIds: ['u0', 'a0'],
          count: 6,
          ts: Date.now(),
        }}
        {...overrides}
      />
    </L10nContext.Provider>,
  );

describe('CompactedBlock', () => {
  it('折叠态显示压缩条数，不显示摘要', () => {
    const {getByText, queryByText} = renderBlock();
    expect(getByText('Compressed 6 earlier messages.')).toBeTruthy();
    expect(queryByText(/早期对话摘要/)).toBeNull();
  });

  it('点按展开显示摘要', () => {
    const {getByTestId, getByText} = renderBlock();
    fireEvent.press(getByTestId('compacted-block'));
    expect(getByText(/早期对话摘要/)).toBeTruthy();
  });

  it('再点按折叠隐藏摘要', () => {
    const {getByTestId, queryByText} = renderBlock();
    const block = getByTestId('compacted-block');
    fireEvent.press(block);
    expect(queryByText(/早期对话摘要/)).toBeTruthy();
    fireEvent.press(block);
    expect(queryByText(/早期对话摘要/)).toBeNull();
  });
});
