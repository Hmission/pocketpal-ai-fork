/**
 * #711 actionRegistry | CP=DRC-002 | ST=running | 测试: test_actionRegistry.ts
 *   SSOT: docs/DebugRemoteControl/DRC_SPEC.md | 铁律: BT05 向前兼容 + 白名单
 *   入口: drcService 命令执行 → 出口: store action / nav slot / chat sender slot
 *   角色: DRC 动作注册表——actionId 白名单 + zod 参数校验 + 执行器映射。
 *
 * 锋利边界：
 *   - actionId 语义永久稳定（新增不改名，BT05 向前兼容）
 *   - 白名单拒绝未知 actionId；params 过 zod schema（校验失败显式报错）
 *   - 无文件删除/系统命令类动作（安全面最小）
 *   - 组件级能力（导航/聊天发送）走「单槽注册」模式（复用 engineMutex 先例），
 *     保持调度链路单一事实源：ChatScreen 挂载时注册 wrappedSendPress，卸载注销。
 */
import {z} from 'zod';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {SRStyle} from '../services/superResEngine';
import {chatSessionStore, modelStore} from '../store';
import {imageGenStore} from '../store/imageGenStore';
import {audioStore} from '../store/audioStore';
import {transcribeFile} from '../services/asrEngine';
import {TtsGenEngineId} from '../services/ttsEngine';
import {KOKORO_VOICES} from '../services/tts/engines/kokoro/voices';
import {SUPERTONIC_VOICES} from '../services/tts/engines/supertonic/voices';
import {KITTEN_VOICES} from '../services/tts/engines/kitten/voices';
import {AIOS_EVENTS_LOG} from '../utils/paths';
import {DrcDomain} from './drcTypes';
import {emit} from './eventStream';

/** ── 单槽注册：导航（DrcBridge 在 NavigationContainer 内注册）── */
type NavFn = (route: string, params?: Record<string, unknown>) => void;
let navSlot: NavFn | null = null;
export function registerNavSlot(fn: NavFn | null): void {
  navSlot = fn;
}

/** ── 单槽注册：聊天发送器（ChatScreen 挂载时注册 wrappedSendPress）── */
type ChatSender = (message: {text: string}) => Promise<void>;
let chatSenderSlot: ChatSender | null = null;
export function registerChatSender(fn: ChatSender | null): void {
  chatSenderSlot = fn;
}
/** 取当前聊天发送槽（B39 基准套件复用完整调度链；无槽返 null，调用方诚实报错） */
export function getChatSender(): ChatSender | null {
  return chatSenderSlot;
}

/** 动作定义 */
export interface DrcActionDef {
  id: string;
  domain: DrcDomain;
  description: string;
  paramsSchema?: z.ZodTypeAny;
  execute: (params: never) => Promise<unknown>;
}

const routeSchema = z.enum([
  'Chat',
  'Models',
  'Pals (experimental)',
  'Benchmark',
  'Settings',
  'GenerationSettings',
  'SystemSettings',
  'App Info',
  'Memory',
  'Knowledge',
  'Workspace',
  'Tool',
  'ImageGen',
  'ModelDirs',
  'Dev Tools',
]);

/** 动作注册表（新增动作在此登记，永不删除/改名既有 id） */
export const drcActions: Record<string, DrcActionDef> = {
  'system.ping': {
    id: 'system.ping',
    domain: 'system',
    description: '连通性探测：返回 pong + 时间戳',
    execute: async () => ({pong: true, ts: Date.now()}),
  },

  'nav.go': {
    id: 'nav.go',
    domain: 'nav',
    description: '跳转到指定页面（ROUTES 名）',
    paramsSchema: z.object({
      route: routeSchema,
      params: z.record(z.string(), z.unknown()).optional(),
    }),
    execute: async params => {
      if (!navSlot) {
        throw new Error(
          '导航槽未注册：DrcBridge 未挂载在 NavigationContainer 内',
        );
      }
      const {route, params: routeParams} = params as {
        route: string;
        params?: Record<string, unknown>;
      };
      navSlot(route, routeParams);
      emit('nav', 'nav.go', {route});
      return {route};
    },
  },

  'chat.send': {
    id: 'chat.send',
    domain: 'chat',
    description: '发送聊天消息（走 ChatScreen 调度链路，含意图路由/管家直答）',
    paramsSchema: z.object({text: z.string().min(1).max(20000)}),
    execute: async params => {
      if (!chatSenderSlot) {
        throw new Error('聊天发送槽未注册：请先 nav.go 到 Chat 页面');
      }
      const {text} = params as {text: string};
      await chatSenderSlot({text});
      return {sent: true, text};
    },
  },

  'chat.switchPal': {
    id: 'chat.switchPal',
    domain: 'chat',
    description: '切换当前会话的 Pal',
    paramsSchema: z.object({palId: z.string()}),
    execute: async params => {
      const {palId} = params as {palId: string};
      await chatSessionStore.setActivePal(palId);
      return {palId};
    },
  },

  'imagegen.generate': {
    id: 'imagegen.generate',
    domain: 'imagegen',
    description: '生图（DreamLite/SD 全参数）',
    paramsSchema: z.object({
      prompt: z.string().min(1),
      steps: z.number().int().min(1).max(64).optional(),
      cfg: z.number().min(0).max(20).optional(),
      width: z.number().int().min(64).max(2048).optional(),
      height: z.number().int().min(64).max(2048).optional(),
      seed: z.number().int().optional(),
      negativePrompt: z.string().optional(),
      loraPath: z.string().optional(),
      loraMultiplier: z.number().min(0).max(2).optional(),
      modelLabel: z.string().optional(),
    }),
    execute: async params => {
      const p = params as {
        prompt: string;
        steps?: number;
        cfg?: number;
        width?: number;
        height?: number;
        seed?: number;
        negativePrompt?: string;
        loraPath?: string;
        loraMultiplier?: number;
        modelLabel?: string;
      };
      if (!imageGenStore.modelLoaded && !imageGenStore.dreamliteLoaded) {
        throw new Error(
          '生图模型未加载：请先执行 imagegen.loadModel / imagegen.loadDreamLite',
        );
      }
      const uri = await imageGenStore.generate(p.prompt, {
        steps: p.steps,
        cfg: p.cfg,
        width: p.width,
        height: p.height,
        seed: p.seed,
        negativePrompt: p.negativePrompt,
        loraPath: p.loraPath,
        loraMultiplier: p.loraMultiplier,
        modelLabel: p.modelLabel,
      });
      if (!uri) {
        throw new Error(
          imageGenStore.error ?? '生图失败（详见事件流 imagegen.failed）',
        );
      }
      return {uri};
    },
  },

  'imagegen.loadModel': {
    id: 'imagegen.loadModel',
    domain: 'imagegen',
    description: '加载 SD 生图模型（modelPath 或 manifest 内模型 id）',
    paramsSchema: z.object({
      modelPath: z.string().min(1),
      clipL: z.string().optional(),
      clipG: z.string().optional(),
      llm: z.string().optional(),
      vae: z.string().optional(),
      backend: z.string().optional(),
    }),
    execute: async params => {
      const p = params as {
        modelPath: string;
        clipL?: string;
        clipG?: string;
        llm?: string;
        vae?: string;
        backend?: string;
      };
      const ok = await imageGenStore.loadModel(p.modelPath, {
        clipL: p.clipL,
        clipG: p.clipG,
        llm: p.llm,
        vae: p.vae,
        backend: p.backend,
      });
      if (!ok) {
        throw new Error(imageGenStore.error ?? '模型加载失败');
      }
      return {loaded: true};
    },
  },

  'imagegen.loadDreamLite': {
    id: 'imagegen.loadDreamLite',
    domain: 'imagegen',
    description: '加载 DreamLite 引擎（unet/vae/TE 单路径）',
    execute: async () => {
      const ok = await imageGenStore.loadDreamLiteEntry();
      if (!ok) {
        throw new Error(imageGenStore.error ?? 'DreamLite 加载失败');
      }
      return {loaded: true};
    },
  },

  'imagegen.generateDreamLite': {
    id: 'imagegen.generateDreamLite',
    domain: 'imagegen',
    description:
      'DreamLite 文生图（4 步 DMD2 蒸馏；未加载时自动加载）——与 UI「出图」按钮同链路：走 beginTask/finishTask 编排（建 running 任务页 + PerfPanel 进度卡可达），非 raw 引擎直调',
    paramsSchema: z.object({
      prompt: z.string().min(1),
      width: z.number().int().min(64).max(2048).optional(),
      height: z.number().int().min(64).max(2048).optional(),
      steps: z.number().int().min(1).max(64).optional(),
    }),
    execute: async params => {
      const p = params as {
        prompt: string;
        width?: number;
        height?: number;
        steps?: number;
      };
      const width = p.width ?? 512;
      const height = p.height ?? 512;
      const steps = p.steps ?? 4;
      // 与 UI「出图」按钮（handleGenerate isDream 分支）同链路：
      // 先建 running 任务页（PerfPanel 进度卡可达）→ 生成 → 成功回填 / 失败保留报错页。
      // 消除「同语义双链路」（§75.5 DRC 缺陷根治，DRC_SPEC §9「与用户点按钮同链路」铁律）。
      const startTs = Date.now();
      const taskId = await imageGenStore.beginTask({
        uri: '',
        prompt: p.prompt,
        seed: Date.now() % 1e9,
        ts: Date.now(),
        width,
        height,
        steps,
        family: 'dreamlite',
        kind: 'generated',
        modelLabel: 'DreamLite',
      });
      const uri = await imageGenStore.generateDreamLiteEntry(
        width,
        height,
        steps,
        p.prompt,
      );
      if (!uri) {
        await imageGenStore.failTask(
          taskId,
          '生成失败',
          imageGenStore.error ??
            'DreamLite 生成失败（详见事件流 imagegen.failed）',
        );
        throw new Error(imageGenStore.error ?? 'DreamLite 生成失败');
      }
      await imageGenStore.finishTask(taskId, uri, {
        durationMs: Date.now() - startTs,
      });
      return {uri};
    },
  },

  'imagegen.unloadModel': {
    id: 'imagegen.unloadModel',
    domain: 'imagegen',
    description: '卸载 SD 生图模型（释放内存）',
    execute: async () => {
      await imageGenStore.unloadModel();
      return {unloaded: true};
    },
  },

  'imagegen.upscale': {
    id: 'imagegen.upscale',
    domain: 'imagegen',
    description:
      'RealESRGAN 通用放大（P6-6）：对指定图片 2×/4× 放大，风格 general/anime/anime_fast（动漫高清/快速）；耗时较长（CPU）',
    paramsSchema: z.object({
      uri: z.string().min(1),
      scale: z.union([z.literal(2), z.literal(4)]).optional(),
      style: z.enum(['general', 'anime', 'anime_fast']).optional(),
    }),
    execute: async params => {
      const p = params as {
        uri: string;
        scale?: 2 | 4;
        style?: SRStyle;
      };
      const out = await imageGenStore.upscaleImageEntry(
        p.uri,
        p.scale ?? 2,
        p.style ?? 'anime',
      );
      if (!out) {
        throw new Error(imageGenStore.error ?? '放大失败');
      }
      return {uri: out};
    },
  },

  'imagegen.recoverHistory': {
    id: 'imagegen.recoverHistory',
    domain: 'imagegen',
    description:
      '相册记录一次性恢复（B27 开发工具）：扫描磁盘图文件（gen_*/upscaled_*/dreamlite_*）重建 legacy 条目并与现有 history 合并去重——非产品兜底机制',
    execute: async () => {
      const recovered = await imageGenStore.recoverHistoryFromDisk();
      return {recovered, total: imageGenStore.history.length};
    },
  },

  'models.scan': {
    id: 'models.scan',
    domain: 'model',
    description: '扫描本地模型目录',
    execute: async () => {
      await modelStore.scanLocalModels();
      return {count: modelStore.displayModels.length};
    },
  },

  'models.load': {
    id: 'models.load',
    domain: 'model',
    description: '加载指定模型（modelId，displayModels 内）并设为活动模型',
    paramsSchema: z.object({modelId: z.string().min(1)}),
    execute: async params => {
      const {modelId} = params as {modelId: string};
      const model = modelStore.displayModels.find(m => m.id === modelId);
      if (!model) {
        const available = modelStore.displayModels.map(m => m.id).join(', ');
        throw new Error(
          `未找到模型 ${modelId}；可用: ${available || '（无）'}`,
        );
      }
      await modelStore.selectModel(model);
      return {loaded: modelId};
    },
  },

  'models.unload': {
    id: 'models.unload',
    domain: 'model',
    description: '释放当前活动模型上下文（manualReleaseContext）',
    execute: async () => {
      await modelStore.manualReleaseContext();
      return {unloaded: true};
    },
  },

  'audio.generateTts': {
    id: 'audio.generateTts',
    domain: 'audio',
    description: 'TTS 音频生成（与音频工坊「生成音频」按钮同链路：audioStore.generateTask）',
    paramsSchema: z.object({
      engine: z.enum(['kokoro', 'supertonic', 'kitten']).default('kokoro'),
      text: z.string().min(1).max(20000),
      voiceId: z.string().optional(),
      speed: z.number().min(0.5).max(2).optional(),
      numSteps: z.number().int().min(1).max(20).optional(),
    }),
    execute: async params => {
      const p = params as {
        engine?: 'kokoro' | 'supertonic' | 'kitten';
        text: string;
        voiceId?: string;
        speed?: number;
        numSteps?: number;
      };
      const engine = p.engine ?? 'kokoro';
      const voices =
        engine === 'kokoro'
          ? KOKORO_VOICES
          : engine === 'supertonic'
          ? SUPERTONIC_VOICES
          : KITTEN_VOICES;
      const voice =
        voices.find(v => v.id === p.voiceId) ?? voices[0] ?? null;
      if (!voice) {
        throw new Error(`${engine} 音色列表为空`);
      }
      const out = await audioStore.generateTask(engine, p.text, voice, {
        speed: p.speed ?? 1.0,
        numSteps: p.numSteps ?? 5,
      });
      if (!out) {
        throw new Error(audioStore.ttsError ?? 'TTS 生成失败');
      }
      return {generated: true, text: p.text, voiceId: voice.id, uri: out};
    },
  },

  'audio.transcribe': {
    id: 'audio.transcribe',
    domain: 'audio',
    description: '转写 wav 音频文件（SenseVoice，任务化入画廊 kind=transcribe）',
    paramsSchema: z.object({
      path: z.string().min(1),
    }),
    execute: async params => {
      const {path} = params as {path: string};
      const text = await audioStore.transcribeTask(path);
      if (!text) {
        throw new Error(audioStore.asrError ?? '转写失败（详见事件流）');
      }
      return {text};
    },
  },

  'audio.ttsGenerate': {
    id: 'audio.ttsGenerate',
    domain: 'audio',
    description: '生成音频文件（TTS 合成 wav，任务化入画廊 kind=tts）',
    paramsSchema: z.object({
      engine: z.enum(['kokoro', 'supertonic']),
      text: z.string().min(1),
      voiceId: z.string().min(1),
      speed: z.number().min(0.5).max(2).optional(),
      numSteps: z.number().int().min(1).max(20).optional(),
    }),
    execute: async params => {
      const p = params as {
        engine: TtsGenEngineId;
        text: string;
        voiceId: string;
        speed?: number;
        numSteps?: number;
      };
      const out = await audioStore.generateTask(
        p.engine,
        p.text,
        {id: p.voiceId, name: p.voiceId, engine: p.engine},
        {speed: p.speed, numSteps: p.numSteps},
      );
      if (!out) {
        throw new Error(audioStore.ttsError ?? '生成失败（详见事件流）');
      }
      return {uri: out};
    },
  },

  'chat.newSession': {
    id: 'chat.newSession',
    domain: 'chat',
    description: '新建会话（可选 title）',
    paramsSchema: z.object({
      title: z.string().max(100).optional(),
    }),
    execute: async params => {
      const {title} = params as {title?: string};
      await chatSessionStore.createNewSession(title ?? '新会话');
      return {created: true, title: title ?? '新会话'};
    },
  },

  'system.events': {
    id: 'system.events',
    domain: 'system',
    description: '读事件流尾部（默认最后 20 行，JSONL 原文）',
    paramsSchema: z.object({
      last: z.number().int().min(1).max(500).optional(),
    }),
    execute: async params => {
      const {last = 20} = params as {last?: number};
      let raw = '';
      try {
        raw = await RNFS.readFile(AIOS_EVENTS_LOG, 'utf8');
      } catch {
        return {events: [], note: '事件流不存在（DRC 未激活或未产生事件）'};
      }
      const lines = raw.split('\n').filter(Boolean);
      const tail = lines.slice(-last);
      const events = tail.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return {raw: line};
        }
      });
      return {count: events.length, events};
    },
  },

  'system.state': {
    id: 'system.state',
    domain: 'system',
    description: '返回当前状态快照（状态指南针）',
    execute: async () => {
      const {buildStateSnapshot} = await import('./stateSnapshot');
      return buildStateSnapshot();
    },
  },
};

/** 执行动作（白名单 + zod 校验）。未知 actionId / 校验失败抛错 → drcService 写回失败结果。 */
export async function executeAction(
  actionId: string,
  params: Record<string, unknown> | undefined,
): Promise<unknown> {
  const def = drcActions[actionId];
  if (!def) {
    throw new Error(`未知 actionId: ${actionId}（DRC_SPEC §动作注册表）`);
  }
  const parsed = def.paramsSchema
    ? def.paramsSchema.parse(params ?? {})
    : params;
  return def.execute(parsed as never);
}

/** 测试辅助：当前是否注册了导航/发送槽 */
export function __drcSlotsForTest(): {nav: boolean; chat: boolean} {
  return {nav: navSlot !== null, chat: chatSenderSlot !== null};
}
