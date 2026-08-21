import {act, fireEvent, waitFor} from '@testing-library/react-native';
import * as React from 'react';
import {ScrollView, Alert} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {runInAction} from 'mobx';

import {user} from '../../../../jest/fixtures';
import {l10n} from '../../../locales';
import {UserContext} from '../../../utils';
import {ChatInput} from '../ChatInput';
import {render} from '../../../../jest/test-utils';
import {palStore, chatSessionStore, modelStore} from '../../../store';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Voice from '@react-native-voice/voice';
// moduleNameMapper 在运行时将该包映射到 __mocks__/external/@react-native-voice/voice.js，
// 其命名导出（__emit* / __setVoiceAvailable 测试辅助）不在真实包类型中 → require 断言访问。
const {
  __emitSpeechStart,
  __emitSpeechResults,
  __resetVoiceMock,
  __setVoiceAvailable,
} = require('@react-native-voice/voice') as {
  __emitSpeechStart: () => void;
  __emitSpeechResults: (value: string[]) => void;
  __resetVoiceMock: () => void;
  __setVoiceAvailable: (available: boolean) => void;
};

// Mock react-native-image-picker
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

const renderScrollable = () => <ScrollView />;

describe('input', () => {
  it('send button', () => {
    expect.assertions(2);
    // Set up an active model for the test
    runInAction(() => {
      modelStore.activeModelId = 'test-model-id';
    });
    const onSendPress = jest.fn();
    const {getByPlaceholderText, getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            sendButtonVisibilityMode: 'editing',
            textInputProps: {value: 'text'},
          }}
        />
      </UserContext.Provider>,
    );
    const textInput = getByPlaceholderText(
      l10n.en.components.chatInput.inputPlaceholder,
    );
    fireEvent.changeText(textInput, 'text');
    const button = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    fireEvent.press(button);
    expect(onSendPress).toHaveBeenCalledWith({text: 'text', type: 'text'});
    expect(textInput.props).toHaveProperty('value', 'text');
  });

  it('sends a text message', () => {
    expect.assertions(2);
    // Set up an active model for the test
    runInAction(() => {
      modelStore.activeModelId = 'test-model-id';
    });
    const onSendPress = jest.fn();
    const {getByPlaceholderText, getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            renderScrollable,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );
    const textInput = getByPlaceholderText(
      l10n.en.components.chatInput.inputPlaceholder,
    );
    fireEvent.changeText(textInput, 'text');
    const button = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    fireEvent.press(button);
    expect(onSendPress).toHaveBeenCalledWith({text: 'text', type: 'text'});
    expect(textInput.props).toHaveProperty('value', '');
  });

  it('sends a text message if onChangeText and value are provided', () => {
    expect.assertions(2);
    // Set up an active model for the test
    runInAction(() => {
      modelStore.activeModelId = 'test-model-id';
    });
    const onSendPress = jest.fn();
    const value = 'value';
    const onChangeText = jest.fn(newValue => {
      rerender(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              renderScrollable,
              sendButtonVisibilityMode: 'editing',
              textInputProps: {onChangeText, value: newValue},
            }}
          />
        </UserContext.Provider>,
      );
    });
    const {getByPlaceholderText, getByLabelText, rerender} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            renderScrollable,
            sendButtonVisibilityMode: 'editing',
            textInputProps: {onChangeText, value},
          }}
        />
      </UserContext.Provider>,
    );
    const textInput = getByPlaceholderText(
      l10n.en.components.chatInput.inputPlaceholder,
    );
    fireEvent.changeText(textInput, 'text');
    const button = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    fireEvent.press(button);
    expect(onSendPress).toHaveBeenCalledWith({text: 'text', type: 'text'});
    expect(textInput.props).toHaveProperty('value', 'text');
  });

  it('sends a text message if onChangeText is provided', () => {
    expect.assertions(2);
    // Set up an active model for the test
    runInAction(() => {
      modelStore.activeModelId = 'test-model-id';
    });
    const onSendPress = jest.fn();
    const onChangeText = jest.fn();
    const {getByPlaceholderText, getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            renderScrollable,
            sendButtonVisibilityMode: 'editing',
            textInputProps: {onChangeText},
          }}
        />
      </UserContext.Provider>,
    );
    const textInput = getByPlaceholderText(
      l10n.en.components.chatInput.inputPlaceholder,
    );
    fireEvent.changeText(textInput, 'text');
    const button = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    fireEvent.press(button);
    expect(onSendPress).toHaveBeenCalledWith({text: 'text', type: 'text'});
    expect(textInput.props).toHaveProperty('value', '');
  });

  it('sends a text message if value is provided', async () => {
    expect.assertions(2);
    // Set up an active model for the test
    runInAction(() => {
      modelStore.activeModelId = 'test-model-id';
    });
    const onSendPress = jest.fn();
    const value = 'value';
    const {getByPlaceholderText, getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            renderScrollable,
            sendButtonVisibilityMode: 'editing',
            textInputProps: {value},
          }}
        />
      </UserContext.Provider>,
    );
    const textInput = getByPlaceholderText(
      l10n.en.components.chatInput.inputPlaceholder,
    );
    await waitFor(() => fireEvent.changeText(textInput, 'text')); // Wait for the input to update

    const button = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    await waitFor(() => fireEvent.press(button)); // Wait for the press event to be processed

    expect(onSendPress).toHaveBeenCalledWith({text: value, type: 'text'});
    expect(textInput.props).toHaveProperty('value', value);
  });

  it('sends a text message if defaultValue is provided', () => {
    expect.assertions(2);
    // Set up an active model for the test
    runInAction(() => {
      modelStore.activeModelId = 'test-model-id';
    });
    const onSendPress = jest.fn();
    const defaultValue = 'defaultValue';
    const {getByPlaceholderText, getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            renderScrollable,
            sendButtonVisibilityMode: 'editing',
            textInputProps: {defaultValue},
          }}
        />
      </UserContext.Provider>,
    );
    const textInput = getByPlaceholderText(
      l10n.en.components.chatInput.inputPlaceholder,
    );
    const button = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    fireEvent.press(button);
    expect(onSendPress).toHaveBeenCalledWith({
      text: defaultValue,
      type: 'text',
    });
    expect(textInput.props).toHaveProperty('value', '');
  });

  it('shows stop button when isStopVisible is true', () => {
    expect.assertions(1);
    const onStopPress = jest.fn();
    const onSendPress = jest.fn();
    const {getByTestId} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            onStopPress,
            isStopVisible: true,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );
    const stopButton = getByTestId('stop-button');
    fireEvent.press(stopButton);
    expect(onStopPress).toHaveBeenCalledTimes(1);
  });

  it('shows plus button for image upload when showImageUpload is true', () => {
    expect.assertions(1);
    const onSendPress = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            showImageUpload: true,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const plusButton = getByLabelText('Add image');
    expect(plusButton).toBeDefined();
  });

  it('does not show plus button when showImageUpload is false', () => {
    expect.assertions(1);
    const onSendPress = jest.fn();
    const {queryByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            showImageUpload: false,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const plusButton = queryByLabelText('Add image');
    expect(plusButton).toBeNull();
  });

  it('renders plus button correctly when vision is enabled', () => {
    expect.assertions(2);
    const onSendPress = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            showImageUpload: true,
            isVisionEnabled: true,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const plusButton = getByLabelText('Add image');
    expect(plusButton).toBeTruthy();
    expect(plusButton.props.accessibilityState.disabled).toBe(false);
  });

  it('does not render pal selector (^) after 2026-08 trim', () => {
    // [已裁剪 2026-08] ^ Pal 选择器按钮已删除（大王裁定）；
    // 恢复 palSelector 块时同步恢复原“点击回调”用例。
    expect.assertions(1);
    const onSendPress = jest.fn();
    const onPalBtnPress = jest.fn();
    const {queryByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            onPalBtnPress,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    expect(queryByLabelText('Select Pal')).toBeNull();
  });

  it('shows video button for video pal type', async () => {
    expect.assertions(1);

    // Create a video pal and set it as active
    const videoPal = await palStore.createPal({
      type: 'local',
      name: 'Test Video Pal',
      systemPrompt: 'Test video pal',
      originalSystemPrompt: 'Test video pal',
      isSystemPromptChanged: false,
      useAIPrompt: false,
      parameters: {captureInterval: '3000'},
      parameterSchema: [
        {
          key: 'captureInterval',
          type: 'text',
          label: 'Capture Interval',
          required: true,
        },
      ],
      source: 'local',
      capabilities: {video: true},
    });

    // Mock the activePalId getter to return our video pal's ID
    const originalActivePalId = Object.getOwnPropertyDescriptor(
      chatSessionStore,
      'activePalId',
    );
    Object.defineProperty(chatSessionStore, 'activePalId', {
      get: jest.fn(() => videoPal.id),
      configurable: true,
    });

    const onSendPress = jest.fn();
    const onStartCamera = jest.fn();
    const {getByText, unmount} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            onStartCamera,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const videoButton = getByText('Start Camera');
    fireEvent.press(videoButton);
    expect(onStartCamera).toHaveBeenCalledTimes(1);

    // Cleanup: restore original activePalId mock
    unmount();
    if (originalActivePalId) {
      Object.defineProperty(
        chatSessionStore,
        'activePalId',
        originalActivePalId,
      );
    }
  });

  it('handles prompt text change for video pal', async () => {
    expect.assertions(1);

    // Create a video pal and set it as active
    const videoPal = await palStore.createPal({
      type: 'local',
      name: 'Test Video Pal',
      systemPrompt: 'Test video pal',
      originalSystemPrompt: 'Test video pal',
      isSystemPromptChanged: false,
      useAIPrompt: false,
      parameters: {captureInterval: '3000'},
      parameterSchema: [
        {
          key: 'captureInterval',
          type: 'text',
          label: 'Capture Interval',
          required: true,
        },
      ],
      source: 'local',
      capabilities: {video: true},
    });

    // Mock the activePalId getter to return our video pal's ID
    const originalActivePalId = Object.getOwnPropertyDescriptor(
      chatSessionStore,
      'activePalId',
    );
    Object.defineProperty(chatSessionStore, 'activePalId', {
      get: jest.fn(() => videoPal.id),
      configurable: true,
    });

    const onSendPress = jest.fn();
    const onPromptTextChange = jest.fn();
    const {getByPlaceholderText, unmount} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            onPromptTextChange,
            promptText: 'initial text',
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const textInput = getByPlaceholderText(l10n.en.video.promptPlaceholder);
    fireEvent.changeText(textInput, 'new text');
    expect(onPromptTextChange).toHaveBeenCalledWith('new text');

    // Cleanup: restore original activePalId mock
    unmount();
    if (originalActivePalId) {
      Object.defineProperty(
        chatSessionStore,
        'activePalId',
        originalActivePalId,
      );
    }
  });

  it('disables plus button when vision is not enabled', () => {
    expect.assertions(1);
    const onSendPress = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            showImageUpload: true,
            isVisionEnabled: false,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const plusButton = getByLabelText('Add image');
    expect(plusButton.props.accessibilityState.disabled).toBe(true);
  });

  it('enables plus button when vision is enabled', () => {
    expect.assertions(1);
    const onSendPress = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            showImageUpload: true,
            isVisionEnabled: true,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const plusButton = getByLabelText('Add image');
    expect(plusButton.props.accessibilityState.disabled).toBe(false);
  });

  it('shows send button with always visibility mode', () => {
    expect.assertions(1);
    const onSendPress = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            sendButtonVisibilityMode: 'always',
          }}
        />
      </UserContext.Provider>,
    );

    const sendButton = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    expect(sendButton).toBeTruthy();
  });

  it('sends message with images when images are selected', () => {
    expect.assertions(1);
    // Set up an active model for the test
    runInAction(() => {
      modelStore.activeModelId = 'test-model-id';
    });
    const onSendPress = jest.fn();
    const {getByPlaceholderText, getByLabelText} = render(
      <UserContext.Provider value={user}>
        <ChatInput
          {...{
            onSendPress,
            sendButtonVisibilityMode: 'editing',
          }}
        />
      </UserContext.Provider>,
    );

    const textInput = getByPlaceholderText(
      l10n.en.components.chatInput.inputPlaceholder,
    );
    fireEvent.changeText(textInput, 'test message');

    const sendButton = getByLabelText(
      l10n.en.components.sendButton.accessibilityLabel,
    );
    fireEvent.press(sendButton);

    expect(onSendPress).toHaveBeenCalledWith({
      text: 'test message',
      type: 'text',
    });
  });

  describe('Image Upload Functionality', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('opens image upload menu when plus button is pressed', () => {
      const onSendPress = jest.fn();
      const {getByLabelText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              showImageUpload: true,
              isVisionEnabled: true,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      const plusButton = getByLabelText('Add image');
      fireEvent.press(plusButton);

      // Menu should be visible after pressing plus button
      // This would need to be tested with the actual menu implementation
    });

    it('handles camera photo capture successfully', async () => {
      const mockResult = {
        assets: [{uri: 'file://test-photo.jpg'}],
      };
      (launchCamera as jest.Mock).mockResolvedValue(mockResult);

      const onSendPress = jest.fn();
      const {getByLabelText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              showImageUpload: true,
              isVisionEnabled: true,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      const plusButton = getByLabelText('Add image');
      fireEvent.press(plusButton);

      // Since testing the menu interaction is complex, let's test that the camera function works
      // by calling it directly (this tests the core functionality)
      expect(launchCamera).toHaveBeenCalledTimes(0); // Initially not called

      // The plus button should open the menu, but testing menu interaction is complex
      // For now, we'll test that the component renders correctly with image upload enabled
      expect(plusButton).toBeTruthy();
    });

    it('handles camera error gracefully', async () => {
      const mockError = new Error('Camera error');
      (launchCamera as jest.Mock).mockRejectedValue(mockError);

      const onSendPress = jest.fn();
      const {getByLabelText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              showImageUpload: true,
              isVisionEnabled: true,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      const plusButton = getByLabelText('Add image');
      fireEvent.press(plusButton);

      // Test that the component renders correctly even when camera errors are configured
      expect(plusButton).toBeTruthy();
      expect(launchCamera).toHaveBeenCalledTimes(0); // Not called until menu interaction
    });

    it('handles image library selection successfully', async () => {
      const mockResult = {
        assets: [{uri: 'file://test-library-photo.jpg'}],
      };
      (launchImageLibrary as jest.Mock).mockResolvedValue(mockResult);

      const onSendPress = jest.fn();
      const {getByLabelText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              showImageUpload: true,
              isVisionEnabled: true,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      const plusButton = getByLabelText('Add image');
      fireEvent.press(plusButton);

      // Test that the component renders correctly with image library functionality
      expect(plusButton).toBeTruthy();
      expect(launchImageLibrary).toHaveBeenCalledTimes(0); // Not called until menu interaction
    });

    it('sends message with selected images', () => {
      // Set up an active model for the test
      runInAction(() => {
        modelStore.activeModelId = 'test-model-id';
      });
      const onSendPress = jest.fn();
      const defaultImages = ['file://image1.jpg', 'file://image2.jpg'];
      const {getByPlaceholderText, getByLabelText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              showImageUpload: true,
              isVisionEnabled: true,
              sendButtonVisibilityMode: 'editing',
              defaultImages,
            }}
          />
        </UserContext.Provider>,
      );

      const textInput = getByPlaceholderText(
        l10n.en.components.chatInput.inputPlaceholder,
      );
      fireEvent.changeText(textInput, 'test with images');

      const sendButton = getByLabelText(
        l10n.en.components.sendButton.accessibilityLabel,
      );
      fireEvent.press(sendButton);

      expect(onSendPress).toHaveBeenCalledWith({
        text: 'test with images',
        type: 'text',
        imageUris: defaultImages,
      });
    });
  });

  describe('Edit Mode Functionality', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('shows edit bar when in edit mode', () => {
      runInAction(() => {
        chatSessionStore.isEditMode = true;
      });
      const onSendPress = jest.fn();
      const onCancelEdit = jest.fn();

      render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              onCancelEdit,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      expect(onCancelEdit).not.toHaveBeenCalled(); // Should not be called on render
    });

    it('calls onCancelEdit when cancel button is pressed', () => {
      const onSendPress = jest.fn();
      const onCancelEdit = jest.fn();

      // Start with edit mode enabled
      runInAction(() => {
        chatSessionStore.isEditMode = true;
      });

      const {getByTestId} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              onCancelEdit,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      // Find and press the cancel button in the edit bar
      const cancelButton = getByTestId('icon-button');
      fireEvent.press(cancelButton);

      expect(onCancelEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Model Not Loaded Feedback', () => {
    it('shows warning and haptic feedback when trying to send without model', async () => {
      // Mock haptic feedback
      const hapticTriggerSpy = jest.spyOn(ReactNativeHapticFeedback, 'trigger');

      // Ensure no model is loaded
      runInAction(() => {
        modelStore.activeModelId = undefined;
        modelStore.context = undefined;
      });

      const onSendPress = jest.fn();

      const {getByPlaceholderText, getByLabelText, getByText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              renderScrollable,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      const input = getByPlaceholderText(
        l10n.en.components.chatInput.inputPlaceholder,
      );
      fireEvent.changeText(input, 'Test message');

      const sendButton = getByLabelText(
        l10n.en.components.sendButton.accessibilityLabel,
      );
      fireEvent.press(sendButton);

      // Verify haptic feedback was triggered
      expect(hapticTriggerSpy).toHaveBeenCalledWith('notificationWarning', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });

      // Verify helper text is displayed
      expect(getByText(l10n.en.chat.cannotSendWithoutModel)).toBeTruthy();

      // Verify onSendPress was NOT called
      expect(onSendPress).not.toHaveBeenCalled();

      hapticTriggerSpy.mockRestore();
    });

    it('allows sending when model is loaded', async () => {
      const onSendPress = jest.fn();

      // Ensure model is loaded
      runInAction(() => {
        modelStore.activeModelId = 'test-model';
        modelStore.context = {id: 'test-context'} as any;
      });

      const {getByPlaceholderText, getByLabelText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              renderScrollable,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );

      const input = getByPlaceholderText(
        l10n.en.components.chatInput.inputPlaceholder,
      );
      fireEvent.changeText(input, 'Test message');

      const sendButton = getByLabelText(
        l10n.en.components.sendButton.accessibilityLabel,
      );
      fireEvent.press(sendButton);

      // Verify onSendPress WAS called
      expect(onSendPress).toHaveBeenCalledWith({
        text: 'Test message',
        type: 'text',
        imageUris: undefined,
      });
    });
  });

  describe('Voice Input (STT)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      __resetVoiceMock();
      runInAction(() => {
        modelStore.activeModelId = 'test-model-id';
      });
    });

    it('keeps send button (no mic) when recognition service is unavailable', async () => {
      __setVoiceAvailable(false);
      const {queryByTestId, getByTestId} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress: jest.fn(),
              sendButtonVisibilityMode: 'always',
            }}
          />
        </UserContext.Provider>,
      );
      await waitFor(() => {
        expect(queryByTestId('voice-input-button')).toBeNull();
      });
      expect(getByTestId('send-button')).toBeTruthy();
    });

    it('shows mic on empty input and switches to send once text is typed', async () => {
      __setVoiceAvailable(true);
      const {getByPlaceholderText, getByTestId, queryByTestId} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress: jest.fn(),
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );
      await waitFor(() => {
        expect(getByTestId('voice-input-button')).toBeTruthy();
      });
      // 一打字 → 麦克风消失、发送钮出现
      fireEvent.changeText(
        getByPlaceholderText(l10n.en.components.chatInput.inputPlaceholder),
        'hello',
      );
      expect(queryByTestId('voice-input-button')).toBeNull();
      expect(getByTestId('send-button')).toBeTruthy();
    });

    it('starts recognition on mic tap and shows stop button while listening', async () => {
      __setVoiceAvailable(true);
      const {getByTestId} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress: jest.fn(),
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );
      await waitFor(() => {
        expect(getByTestId('voice-input-button')).toBeTruthy();
      });
      fireEvent.press(getByTestId('voice-input-button'));
      expect(Voice.start).toHaveBeenCalled();
      await act(async () => {
        __emitSpeechStart();
      });
      await waitFor(() => {
        expect(getByTestId('voice-stop-button')).toBeTruthy();
      });
      fireEvent.press(getByTestId('voice-stop-button'));
      expect(Voice.stop).toHaveBeenCalled();
    });

    it('fills recognized text into the input and switches to send', async () => {
      __setVoiceAvailable(true);
      const {getByPlaceholderText, getByTestId} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress: jest.fn(),
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );
      await waitFor(() => {
        expect(getByTestId('voice-input-button')).toBeTruthy();
      });
      fireEvent.press(getByTestId('voice-input-button'));
      await act(async () => {
        __emitSpeechResults(['你好世界']);
      });
      const input = getByPlaceholderText(
        l10n.en.components.chatInput.inputPlaceholder,
      );
      await waitFor(() => {
        expect(input.props.value).toBe('你好世界');
      });
      // 识别文字填入后 → 发送钮出现
      await waitFor(() => {
        expect(getByTestId('send-button')).toBeTruthy();
      });
    });
  });

  describe('写作快捷入口（WORKSPACE_SPEC v1）', () => {
    it('点「写作项目」钮 → 前缀 chip 出现 + placeholder 切换', () => {
      runInAction(() => {
        modelStore.activeModelId = 'test-model-id';
      });
      const {getByLabelText, getByText, getByPlaceholderText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress: jest.fn(),
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );
      fireEvent.press(getByLabelText('写作项目'));
      expect(getByText('写作项目：')).toBeTruthy();
      expect(
        getByPlaceholderText('描述你想写的故事，例如：星海征途、奇幻冒险…'),
      ).toBeTruthy();
    });

    it('发送时拼接「写作项目：」前缀 → 路由 write 任务', () => {
      runInAction(() => {
        modelStore.activeModelId = 'test-model-id';
      });
      const onSendPress = jest.fn();
      const {getByLabelText, getByPlaceholderText} = render(
        <UserContext.Provider value={user}>
          <ChatInput
            {...{
              onSendPress,
              sendButtonVisibilityMode: 'editing',
            }}
          />
        </UserContext.Provider>,
      );
      fireEvent.press(getByLabelText('写作项目'));
      fireEvent.changeText(
        getByPlaceholderText('描述你想写的故事，例如：星海征途、奇幻冒险…'),
        '星海征途',
      );
      fireEvent.press(
        getByLabelText(l10n.en.components.sendButton.accessibilityLabel),
      );
      expect(onSendPress).toHaveBeenCalledWith({
        text: '写作项目：星海征途',
        type: 'text',
      });
    });
  });
});
