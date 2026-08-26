/**
 * #711 stateCompass | CP=DRC-008 | ST=running | 测试: test_stateCompass.ts
 *   SSOT: docs/DebugRemoteControl/COMPASS_REGISTRY.md | 铁律: BT07 观测不为SPOF
 *   入口: stateSnapshot.buildStateSnapshot → 出口: state.json 五字段指南针
 *   角色: 状态指南针——母仓 STATE_COMPASS 的 App 端移植。声明式 STATE_MAP 注册表
 *   （engine/chat/imagegen/model 域），每状态自带 nextAction（导航）/label/terminal。
 *   未知状态降级 unknown（不抛异常，BT07）。
 *
 * 与母仓对齐：六维矩阵 D5 态维度（ST-APP-NNN），编号见 COMPASS_REGISTRY.md §3。
 */
import {DrcDomain, StateCompass} from './drcTypes';

/** 状态定义：state/nextAction/label/terminal 四元组（evidence 由调用方注入） */
export type StateDef = Omit<StateCompass, 'evidence'>;

/** 声明式状态机注册表：域 → 状态 → 指南针元数据。新状态追加一行，零代码变更。 */
export const STATE_MAP: Record<DrcDomain, Record<string, StateDef>> = {
  engine: {
    idle: {
      state: 'idle',
      nextAction: 'load_model',
      label: '引擎空闲',
      terminal: true,
    },
    loading: {
      state: 'loading',
      nextAction: 'await_load_finish',
      label: '引擎加载中',
      terminal: false,
    },
    ready: {
      state: 'ready',
      nextAction: 'run_task',
      label: '引擎就绪',
      terminal: false,
    },
    running: {
      state: 'running',
      nextAction: 'await_completion',
      label: '任务执行中',
      terminal: false,
    },
    error: {
      state: 'error',
      nextAction: 'investigate_and_retry',
      label: '引擎错误',
      terminal: true,
    },
  },
  chat: {
    idle: {
      state: 'idle',
      nextAction: 'send_message',
      label: '会话空闲',
      terminal: true,
    },
    sending: {
      state: 'sending',
      nextAction: 'await_reply',
      label: '消息发送中',
      terminal: false,
    },
    thinking: {
      state: 'thinking',
      nextAction: 'await_reply',
      label: '模型思考中',
      terminal: false,
    },
    running: {
      state: 'running',
      nextAction: 'await_completion',
      label: '回合执行中',
      terminal: false,
    },
    done: {
      state: 'done',
      nextAction: 'next_turn',
      label: '回合完成',
      terminal: false,
    },
    error: {
      state: 'error',
      nextAction: 'investigate_and_retry',
      label: '回合错误',
      terminal: true,
    },
  },
  imagegen: {
    idle: {
      state: 'idle',
      nextAction: 'load_model',
      label: '生图空闲',
      terminal: true,
    },
    loading: {
      state: 'loading',
      nextAction: 'await_load_finish',
      label: '引擎加载中',
      terminal: false,
    },
    ready: {
      state: 'ready',
      nextAction: 'generate',
      label: '引擎就绪',
      terminal: false,
    },
    generating: {
      state: 'generating',
      nextAction: 'await_sampling',
      label: '采样生成中',
      terminal: false,
    },
    done: {
      state: 'done',
      nextAction: 'next_generation',
      label: '生成完成',
      terminal: false,
    },
    error: {
      state: 'error',
      nextAction: 'investigate_and_retry',
      label: '生成错误',
      terminal: true,
    },
  },
  model: {
    idle: {
      state: 'idle',
      nextAction: 'load_model',
      label: '模型未加载',
      terminal: true,
    },
    loading: {
      state: 'loading',
      nextAction: 'await_load_finish',
      label: '模型加载中',
      terminal: false,
    },
    ready: {
      state: 'ready',
      nextAction: 'run_task',
      label: '模型就绪',
      terminal: false,
    },
    unloading: {
      state: 'unloading',
      nextAction: 'await_release',
      label: '模型卸载中',
      terminal: false,
    },
    error: {
      state: 'error',
      nextAction: 'investigate_and_retry',
      label: '模型错误',
      terminal: true,
    },
  },
  app: {},
  nav: {},
  system: {},
  error: {},
  audio: {
    idle: {
      state: 'idle',
      nextAction: 'pick_audio_task',
      label: '音频空闲',
      terminal: true,
    },
    transcribing: {
      state: 'transcribing',
      nextAction: 'await_transcribe',
      label: '转写中',
      terminal: false,
    },
    generating: {
      state: 'generating',
      nextAction: 'await_synthesis',
      label: '生成音频中',
      terminal: false,
    },
    error: {
      state: 'error',
      nextAction: 'investigate_and_retry',
      label: '音频错误',
      terminal: true,
    },
  },
};

/** 未知状态降级（母仓 BT07：观测不为 SPOF，不抛异常） */
const UNKNOWN: StateDef = {
  state: 'unknown',
  nextAction: 'inspect_state',
  label: '未知状态',
  terminal: false,
};

/**
 * 构造状态指南针五字段（纯函数）。
 * @param domain 状态域（engine/chat/imagegen/model）
 * @param state 当前状态名
 * @param evidence 凭证数据（progress/stage/error 等，深入字段）
 */
export function toCompass(
  domain: DrcDomain,
  state: string,
  evidence?: Record<string, unknown>,
): StateCompass {
  const base = STATE_MAP[domain]?.[state] ?? UNKNOWN;
  return {...base, evidence};
}

/** 域状态注册表别名（测试/外部读取） */
export const STATE_REGISTRY = STATE_MAP;
