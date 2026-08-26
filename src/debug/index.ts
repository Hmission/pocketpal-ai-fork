/**
 * #711 debug/index | CP=DRC-006 | ST=idle | 测试: 无
 *   SSOT: docs/DebugRemoteControl/DRC_SPEC.md
 *   角色: DRC 模块统一出口——挂载点与注册槽（供 ChatScreen 注册聊天发送器）。
 */
export {DrcBridge} from './DrcBridge';
export {
  registerNavSlot,
  registerChatSender,
  executeAction,
  drcActions,
} from './actionRegistry';
export {emit, buildEventLine} from './eventStream';
export {buildStateSnapshot, refreshStateSnapshot} from './stateSnapshot';
export {toCompass, STATE_REGISTRY} from './stateCompass';
export {DRC_ENABLED} from './drcTypes';
export type {
  DrcCommand,
  DrcResult,
  DrcEvent,
  DrcStateSnapshot,
  StateCompass,
} from './drcTypes';
