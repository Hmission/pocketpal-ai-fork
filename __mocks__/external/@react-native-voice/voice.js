/**
 * Jest mock for `@react-native-voice/voice`.
 *
 * The real package is an old-bridge native module that Jest cannot load.
 * We expose the subset ChatInput uses: isAvailable/start/stop/cancel/destroy
 * plus the event-handler setters. Tests drive recognition through the
 * exported `__emit*` helpers.
 */

// 默认不可用：现有测试（空输入时发送钮）行为保持不变；语音相关测试
// 通过 __setVoiceAvailable(true) 显式启用。
let _isAvailable = false;
let _handlers = {
  onSpeechStart: null,
  onSpeechRecognized: null,
  onSpeechEnd: null,
  onSpeechError: null,
  onSpeechResults: null,
  onSpeechPartialResults: null,
  onSpeechVolumeChanged: null,
};

export const __emitSpeechStart = () => {
  _handlers.onSpeechStart && _handlers.onSpeechStart({error: false});
};

export const __emitSpeechEnd = () => {
  _handlers.onSpeechEnd && _handlers.onSpeechEnd({error: false});
};

export const __emitSpeechResults = value => {
  _handlers.onSpeechResults && _handlers.onSpeechResults({value});
};

export const __emitSpeechPartialResults = value => {
  _handlers.onSpeechPartialResults && _handlers.onSpeechPartialResults({value});
};

export const __emitSpeechError = message => {
  _handlers.onSpeechError &&
    _handlers.onSpeechError({error: {code: '9', message}});
};

/** Toggle what `isAvailable()` resolves to (voice recognition service). */
export const __setVoiceAvailable = available => {
  _isAvailable = available;
};

export const __resetVoiceMock = () => {
  _handlers = {
    onSpeechStart: null,
    onSpeechRecognized: null,
    onSpeechEnd: null,
    onSpeechError: null,
    onSpeechResults: null,
    onSpeechPartialResults: null,
    onSpeechVolumeChanged: null,
  };
  _isAvailable = false;
};

const voice = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  isAvailable: jest.fn(() => Promise.resolve(_isAvailable)),
  isRecognizing: jest.fn().mockResolvedValue(0),
  getSpeechRecognitionServices: jest.fn().mockResolvedValue([]),
  set onSpeechStart(fn) {
    _handlers.onSpeechStart = fn;
  },
  set onSpeechRecognized(fn) {
    _handlers.onSpeechRecognized = fn;
  },
  set onSpeechEnd(fn) {
    _handlers.onSpeechEnd = fn;
  },
  set onSpeechError(fn) {
    _handlers.onSpeechError = fn;
  },
  set onSpeechResults(fn) {
    _handlers.onSpeechResults = fn;
  },
  set onSpeechPartialResults(fn) {
    _handlers.onSpeechPartialResults = fn;
  },
  set onSpeechVolumeChanged(fn) {
    _handlers.onSpeechVolumeChanged = fn;
  },
};

export default voice;
