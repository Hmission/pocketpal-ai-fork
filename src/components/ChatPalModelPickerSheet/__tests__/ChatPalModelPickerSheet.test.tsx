import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Keyboard} from 'react-native';

import {ChatPalModelPickerSheet} from '../ChatPalModelPickerSheet';
import {modelStore} from '../../../store';
import {user} from '../../../../jest/fixtures';
import {UserContext, L10nContext} from '../../../utils';
import {l10n} from '../../../locales';

// Mock stores
jest.mock('../../../store', () => ({
  modelStore: {
    availableModels: [
      {
        id: 'model1',
        name: 'MiniCPM4-4B-Q4_K_M',
        filename: 'MiniCPM4-4B-Q4_K_M.gguf',
        isDownloaded: true,
        supportsMultimodal: false,
        modelType: 'llm',
      },
      {
        id: 'model2',
        name: 'LFM2.5-2.6B-Q4_K_M',
        filename: 'LFM2.5-2.6B-Q4_K_M.gguf',
        isDownloaded: true,
        supportsMultimodal: true,
        modelType: 'llm',
      },
    ],
    activeModel: {id: 'model1', name: 'MiniCPM4-4B-Q4_K_M'},
    activeModelId: 'model1',
    initContext: jest.fn(),
    selectModel: jest.fn(),
    hasRequiredProjectionModel: jest.fn().mockReturnValue(true),
    getProjectionModelStatus: jest.fn().mockReturnValue({
      isAvailable: true,
      state: 'not_needed',
    }),
    getModelVisionPreference: jest.fn().mockReturnValue(true),
  },
}));

// Mock @gorhom/bottom-sheet
jest.mock('@gorhom/bottom-sheet', () => {
  const mockReact = require('react');
  return {
    __esModule: true,
    default: mockReact.forwardRef(({children}: any, ref: any) =>
      mockReact.createElement('View', {ref, testID: 'bottom-sheet'}, children),
    ),
    BottomSheetScrollView: ({children}: any) =>
      mockReact.createElement(
        'View',
        {testID: 'bottom-sheet-scrollview'},
        children,
      ),
  };
});

// Mock Keyboard
const mockKeyboardDismiss = jest.fn();
const mockKeyboardRemove = jest.fn();
jest.spyOn(Keyboard, 'dismiss').mockImplementation(mockKeyboardDismiss);
jest.spyOn(Keyboard, 'addListener').mockImplementation(
  (_eventName, _callback) =>
    ({
      remove: mockKeyboardRemove,
    }) as any,
);

const defaultProps = {
  isVisible: true,
  chatInputHeight: 60,
  onClose: jest.fn(),
  onModelSelect: jest.fn(),
};

describe('ChatPalModelPickerSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const {getByTestId} = render(
      <UserContext.Provider value={user}>
        <L10nContext.Provider value={l10n.en}>
          <ChatPalModelPickerSheet {...defaultProps} />
        </L10nContext.Provider>
      </UserContext.Provider>,
    );

    expect(getByTestId('bottom-sheet')).toBeTruthy();
    expect(getByTestId('bottom-sheet-scrollview')).toBeTruthy();
  });

  it('does not render tab bar (single models list only)', () => {
    const {queryByText} = render(
      <UserContext.Provider value={user}>
        <L10nContext.Provider value={l10n.en}>
          <ChatPalModelPickerSheet {...defaultProps} />
        </L10nContext.Provider>
      </UserContext.Provider>,
    );

    // 无 tab 头：既无 Models tab 也无 Pals tab 文案（l10n 键已随收敛删除）
    expect(queryByText('Models')).toBeNull();
    expect(queryByText('Pals')).toBeNull();
  });

  it('shows Chinese short name with param tag, no filename subtitle', () => {
    const {getByText, queryByText} = render(
      <UserContext.Provider value={user}>
        <L10nContext.Provider value={l10n.en}>
          <ChatPalModelPickerSheet {...defaultProps} />
        </L10nContext.Provider>
      </UserContext.Provider>,
    );

    // 面壁 MiniCPM（4B_Q4）格式：中文简称 + 参数标签
    expect(getByText('面壁 MiniCPM（4B_Q4）')).toBeTruthy();
    // 原始文件名不再显示
    expect(queryByText('MiniCPM4-4B-Q4_K_M')).toBeNull();
  });

  it('dismisses keyboard when sheet becomes visible', () => {
    const {rerender} = render(
      <UserContext.Provider value={user}>
        <L10nContext.Provider value={l10n.en}>
          <ChatPalModelPickerSheet {...defaultProps} isVisible={false} />
        </L10nContext.Provider>
      </UserContext.Provider>,
    );

    expect(mockKeyboardDismiss).not.toHaveBeenCalled();

    rerender(
      <UserContext.Provider value={user}>
        <L10nContext.Provider value={l10n.en}>
          <ChatPalModelPickerSheet {...defaultProps} isVisible={true} />
        </L10nContext.Provider>
      </UserContext.Provider>,
    );

    expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
  });

  it('closes sheet when keyboard opens', () => {
    const mockOnClose = jest.fn();
    render(
      <UserContext.Provider value={user}>
        <L10nContext.Provider value={l10n.en}>
          <ChatPalModelPickerSheet
            {...defaultProps}
            isVisible={true}
            onClose={mockOnClose}
          />
        </L10nContext.Provider>
      </UserContext.Provider>,
    );

    const keyboardDidShowListener = (Keyboard.addListener as jest.Mock).mock
      .calls[0][1];
    keyboardDidShowListener();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onModelSelect when model is selected', async () => {
    const {getByText} = render(
      <UserContext.Provider value={user}>
        <L10nContext.Provider value={l10n.en}>
          <ChatPalModelPickerSheet {...defaultProps} />
        </L10nContext.Provider>
      </UserContext.Provider>,
    );

    const modelItem = getByText('面壁 MiniCPM（4B_Q4）');
    fireEvent.press(modelItem);

    await waitFor(() => {
      expect(defaultProps.onModelSelect).toHaveBeenCalledWith('model1');
      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(modelStore.selectModel).toHaveBeenCalled();
    });
  });
});
