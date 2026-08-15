import * as utils from '@flyerhq/react-native-link-preview/lib/utils';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import * as React from 'react';
import {Linking} from 'react-native';

import {derivedTextMessage} from '../../../../jest/fixtures';
import {render as renderWithProviders} from '../../../../jest/test-utils';
import {TextMessage} from '../TextMessage';

describe('text message', () => {
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('renders preview image and handles link press', async () => {
    const link = 'https://github.com/flyerhq/';
    const getPreviewDataMock = jest
      .spyOn(utils, 'getPreviewData')
      .mockResolvedValue({
        description: 'description',
        image: {
          height: 460,
          url: 'https://avatars2.githubusercontent.com/u/59206044',
          width: 460,
        },
        link,
        title: 'title',
      });
    const openUrlMock = jest.spyOn(Linking, 'openURL');
    const {getByRole, getByText, debug} = render(
      <TextMessage
        message={{
          ...derivedTextMessage,
          author: {id: 'newUserId', firstName: 'John'},
          text: link,
        }}
        messageWidth={440}
        onPreviewDataFetched={jest.fn}
        showName
        usePreviewData
      />,
    );
    debug();
    const image = getByRole('image');
    expect(image).toBeDefined();
    const text = getByText(link);
    fireEvent.press(text);
    expect(openUrlMock).toHaveBeenCalledWith(link);
    getPreviewDataMock.mockRestore();
    openUrlMock.mockRestore();
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('renders preview image without https and handles link press', async () => {
    expect.assertions(2);
    const link = 'github.com/flyerhq/';
    const getPreviewDataMock = jest
      .spyOn(utils, 'getPreviewData')
      .mockResolvedValue({
        description: 'description',
        image: {
          height: 460,
          url: 'https://avatars2.githubusercontent.com/u/59206044',
          width: 460,
        },
        link,
        title: 'title',
      });
    const openUrlMock = jest.spyOn(Linking, 'openURL');
    const {getByRole, getByText} = render(
      <TextMessage
        message={{...derivedTextMessage, text: link}}
        messageWidth={440}
        onPreviewDataFetched={jest.fn}
        showName={false}
        usePreviewData
      />,
    );
    await waitFor(() => getByRole('image'));
    const image = getByRole('image');
    expect(image).toBeDefined();
    const text = getByText(link);
    fireEvent.press(text);
    expect(openUrlMock).toHaveBeenCalledWith('https://' + link);
    getPreviewDataMock.mockRestore();
    openUrlMock.mockRestore();
  });

  it('renders and handles email press', async () => {
    expect.assertions(1);
    const email = 'john@flyer.chat';
    const getPreviewDataMock = jest
      .spyOn(utils, 'getPreviewData')
      .mockResolvedValue({});
    const openUrlMock = jest.spyOn(Linking, 'openURL');
    const {getByText} = render(
      <TextMessage
        message={{
          ...derivedTextMessage,
          author: {id: 'newUserId', firstName: 'John'},
          text: email,
        }}
        messageWidth={440}
        onPreviewDataFetched={jest.fn}
        showName
        usePreviewData
      />,
    );
    await waitFor(() => getByText(email));
    const text = getByText(email);
    fireEvent.press(text);
    expect(openUrlMock).toHaveBeenCalledWith(`mailto:${email}`);
    getPreviewDataMock.mockRestore();
    openUrlMock.mockRestore();
  });

  it('单图撑满卡片宽度（contain 不裁切）', () => {
    const {getByTestId} = renderWithProviders(
      <TextMessage
        message={
          {...derivedTextMessage, imageUris: ['file:///a.png']} as any
        }
        messageWidth={440}
        showName={false}
      />,
    );
    expect(getByTestId('image-content-0').props.resizeMode).toBe('contain');
    // 宽版缩略图：width 100% + 方框 aspectRatio（TouchableOpacity 已合并 style）
    expect(getByTestId('image-thumbnail-0').props.style).toEqual(
      expect.objectContaining({width: '100%', aspectRatio: 1}),
    );
  });

  it('多图保持 80×80 缩略图网格（cover）', () => {
    const {getByTestId, queryByTestId} = renderWithProviders(
      <TextMessage
        message={
          {
            ...derivedTextMessage,
            imageUris: ['file:///a.png', 'file:///b.png'],
          } as any
        }
        messageWidth={440}
        showName={false}
      />,
    );
    expect(queryByTestId('image-content-1')).toBeTruthy();
    expect(queryByTestId('image-content-2')).toBeNull();
    const thumbs = [getByTestId('image-thumbnail-0'), getByTestId('image-thumbnail-1')];
    for (const t of thumbs) {
      expect(t.props.style).not.toEqual(expect.objectContaining({width: '100%'}));
      expect(t.props.style).toEqual(expect.objectContaining({width: 80, height: 80}));
    }
    expect(getByTestId('image-content-0').props.resizeMode).toBe('cover');
  });
});
