/**
 * @format
 */

// Import URL polyfill for React Native/Hermes compatibility
import 'react-native-url-polyfill/auto';

import {AppRegistry, LogBox} from 'react-native';

// Silence LogBox in E2E builds so the in-app warning toast doesn't cover
// chat-bottom controls Appium needs. Left active otherwise so warnings
// surface during development.
if (__E2E__) {
  LogBox.ignoreAllLogs(true);
}

import App from './App';
import {name as appName} from './app.json';
import {registerGlobalErrorReporter} from './src/utils/errorReport';

// RN 全局 JS 异常唯一出口（SPEC §七 CORE-8）：必须在 registerComponent 之前接上，
// 否则红屏/未接住的 rejection 不进 error_*.txt，只能靠开发者当场看到。
// 它只做“额外留档”，原 handler（dev 红屏）仍被链式调用，不替代。
registerGlobalErrorReporter();

AppRegistry.registerComponent(appName, () => App);
