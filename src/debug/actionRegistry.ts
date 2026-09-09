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
import {
  chatSessionStore,
  imageGenStore,
  modelStore,
  serverStore,
} from '../store';
import {normalizeUrl} from '../api/openaiClient/helpers';
import {SERVER_TYPE_OPTIONS, ServerTypeOption} from '../utils/serverTypes';
import {listMemories, memoryDimension} from '../services/aiosMemory';
import {audioStore} from '../store/audioStore';
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

  /**
   * 文生视频取证入口（VIDEO_GEN_SPEC P2 / 项 45 定界链第②步的前置）。
   *
   * 为何必须单独一条：此前 27 个动作里**没有任何视频入口**，而真机一旦出片失败
   *（项 45：引擎 UMT5 前向返空 → GGML_ASSERT 主动 abort）就只能靠 UI 点「出片」
   * 复现——单次几十分钟、参数靠肉眼在页面上改，做不了单变量实验。
   *
   * 本动作是**直通唯一入口** `imageGenStore.generateVideo`（与 runGenTask 按快照
   * `videoFrames` 分派后调的是同一个函数），**不新建第二套链路**；代价是不经任务层，
   * 因此不写画廊/历史行（取证用，帧目录与封面 uri 直接在结果里回）。
   */
  'imagegen.generateVideo': {
    id: 'imagegen.generateVideo',
    domain: 'imagegen',
    description:
      '文生视频出片（直通 generateVideo；uri=封面帧，另回 dir/frames/fps）',
    paramsSchema: z.object({
      prompt: z.string().min(1),
      // 帧数与画幅是内存硬约束的两个旋钮（§9.3），强制显式给出：取证不许靠默认值猜
      videoFrames: z.number().int().min(1).max(128),
      width: z.number().int().min(64).max(2048),
      height: z.number().int().min(64).max(2048),
      steps: z.number().int().min(1).max(64),
      cfg: z.number().min(0).max(20),
      videoFps: z.number().int().min(1).max(64).optional(),
      seed: z.number().int().optional(),
      negativePrompt: z.string().optional(),
      modelLabel: z.string().optional(),
    }),
    execute: async params => {
      const p = params as {
        prompt: string;
        videoFrames: number;
        width: number;
        height: number;
        steps: number;
        cfg: number;
        videoFps?: number;
        seed?: number;
        negativePrompt?: string;
        modelLabel?: string;
      };
      // 与 imagegen.generate 同一口径：前置未满足就当场抛可判读的错误，
      // 而不是把一条注定被 C-4 守卫拦下的命令送到引擎里去撞超时。
      if (!imageGenStore.modelLoaded) {
        throw new Error(
          '视频模型未加载：先执行 imagegen.loadModel（带 t5xxl 与 modality:"video"）',
        );
      }
      const res = await imageGenStore.generateVideo({
        prompt: p.prompt,
        steps: p.steps,
        cfg: p.cfg,
        width: p.width,
        height: p.height,
        seed: p.seed ?? 0,
        videoFrames: p.videoFrames,
        videoFps: p.videoFps,
        negativePrompt: p.negativePrompt,
        modelLabel: p.modelLabel,
      });
      if (!res) {
        throw new Error(
          imageGenStore.error ??
            '出片失败（详见事件流 imagegen.failed 与 Documents/AIOS/imagegen_stderr.log）',
        );
      }
      return res;
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
      // UMT5（Wan 视频族）：与 UI 同一条 extras 链，供真机取证时直接拉模型而不经页面
      t5xxl: z.string().optional(),
      backend: z.string().optional(),
      // C-4 登记面：取证时也要显式声明模态（不声明=按 image 登记，出片会被守卫拦）
      modality: z.enum(['image', 'video']).optional(),
    }),
    execute: async params => {
      const p = params as {
        modelPath: string;
        clipL?: string;
        clipG?: string;
        llm?: string;
        vae?: string;
        t5xxl?: string;
        backend?: string;
        modality?: 'image' | 'video';
      };
      const ok = await imageGenStore.loadModel(p.modelPath, {
        clipL: p.clipL,
        clipG: p.clipG,
        llm: p.llm,
        vae: p.vae,
        t5xxl: p.t5xxl,
        backend: p.backend,
        modality: p.modality,
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
    description:
      'TTS 音频生成（与音频工坊「生成音频」按钮同链路：audioStore.generateTask）',
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
      // 🔴 旧写法 `find(...) ?? voices[0]`：传了不存在的 voiceId 也会静默换成首音色
      // 并报告成功——那是在用兜底掩盖调用方错。现在：缺省才用首音色（文档已承诺），
      // 显式传错则报错并列出可用集。
      const voice = p.voiceId
        ? (voices.find(v => v.id === p.voiceId) ?? null)
        : (voices[0] ?? null);
      if (!voice) {
        const available = voices.map(v => v.id).join(', ') || '（空）';
        throw new Error(
          p.voiceId
            ? `${engine} 无音色 ${p.voiceId}；可用：${available}`
            : `${engine} 音色列表为空`,
        );
      }
      // 缺省不在此注入：`speed` / `numSteps` 的唯一默认点在 `ttsEngine`（旧写法在本文件
      // 再写一份 `1.0` / `5`，与本文件下方的透传行还不自洽——两条 DRC 链默认值行为不同）。
      const out = await audioStore.generateTask(engine, p.text, voice, {
        speed: p.speed,
        numSteps: p.numSteps,
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
    description:
      '转写 wav 音频文件（SenseVoice，任务化入画廊 kind=transcribe）',
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

  // 🔴 已删除 'audio.ttsGenerate'（2026-09-09，留痕见 DRC_SPEC §5 末）。
  // 它从未登记 §5（不受 BT05 兼容承诺保护）、零使用方，且与 audio.generateTts
  // 同走 audioStore.generateTask 一条 store 路径，只是引擎集更窄（无 kitten）、
  // 并用 `{id, name, engine}` 合成音色对象绕过音色校验——同语义双路径里的劣化那条。
  // 不保留别名：别名仍是两条路。

  'memory.list': {
    id: 'memory.list',
    domain: 'model',
    description:
      '读端侧记忆库（复用 aiosMemory.listMemories，不开第二路）——provenance 可观测面',
    paramsSchema: z.object({
      limit: z.number().int().min(1).max(500).optional(),
      contains: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
    }),
    execute: async params => {
      const p = params as {
        limit?: number;
        contains?: string;
        type?: string;
      };
      // 立项理由：G3/G4 全在记忆域，但记忆面零 emit、零 DRC 动作，
      // provenance 写了没人能查 → 验收只能人工翻设备 JSON，与「链路可观测」矛盾。
      const all = await listMemories();
      let items = all;
      if (p.type) {
        items = items.filter(m => m.type === p.type);
      }
      if (p.contains) {
        const needle = p.contains.toLowerCase();
        items = items.filter(m => m.content.toLowerCase().includes(needle));
      }
      // 新的在前：落库顺序就是 push 序，取尾部再倒转，与 UI 面口径一致
      const recent = items.slice(-1 * (p.limit ?? 20)).reverse();
      return {
        total: all.length,
        matched: items.length,
        // provenance 汇总：让「兜底率」第一次真正可数（SPEC Wave C+/CORE-6 验收面）
        byProvenance: all.reduce<Record<string, number>>((acc, m) => {
          const k = m.provenance ?? 'unknown';
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
        items: recent.map(m => ({
          id: m.id,
          type: m.type,
          // 维度是 type 的派生视图（§Wave C+/CORE-5：不落盘）——旧写法 `m.dimension ?? null`
          // 读的是一个全仓零写入方的字段，永远只会输出 null：把假闭环传播到了新的观测面。
          dimension: memoryDimension(m),
          provenance: m.provenance ?? null,
          ts: m.ts,
          content: m.content.slice(0, 120),
        })),
      };
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

  'server.list': {
    id: 'server.list',
    domain: 'model',
    description:
      '列出已配置的远程服务器（id/name/url/serverType）——义肢链路取证入口',
    execute: async () => ({
      count: serverStore.servers.length,
      servers: serverStore.servers.map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        serverType: s.serverType ?? null,
      })),
    }),
  },

  'server.add': {
    id: 'server.add',
    domain: 'model',
    description:
      '登记一台远程服务器（同 ServerDetailsSheet 落库路径：addServer + setApiKey）。apiKey 走 Keychain，不入命令文件回显',
    paramsSchema: z.object({
      name: z.string().min(1).max(100),
      url: z.string().min(1),
      apiKey: z.string().optional(),
      // 🔴 旧写法 `z.string().optional()` + 下方 `as any`：本窗刚在模板上把
      // `serverType` 收到 `ServerTypeOption` 并声称「编译期即报」，但 DRC 这条口
      // 可以写入任意字符串（含非法小写 'openai'）——收口被自己另一面打穿。
      // 现用 z.enum：非法值直接拒并列出合法集。
      serverType: z.enum(SERVER_TYPE_OPTIONS).optional(),
      requestTimeoutMs: z.number().int().min(1000).max(600000).optional(),
    }),
    execute: async params => {
      const p = params as {
        name: string;
        url: string;
        apiKey?: string;
        serverType?: ServerTypeOption;
        requestTimeoutMs?: number;
      };
      const serverId = serverStore.addServer({
        name: p.name,
        url: p.url,
        serverType: p.serverType,
        requestTimeoutMs: p.requestTimeoutMs,
      });
      if (p.apiKey) {
        await serverStore.setApiKey(serverId, p.apiKey);
        // 回读自证：`setApiKey` 内部失败会抛（旧版是 console.error 吞掉），但
        // “写了”不等于“写进去了”——Keychain 写失败时旧版仍报 ok:true，下轮 probe
        // 拿 401 会把「没存进去」误判为「密钥错」，污染整条取证链。
        const back = await serverStore.getApiKey(serverId);
        if (!back) {
          throw new Error(
            `服务器已登记（${serverId}）但密钥未落进 Keychain（回读为空）；请检查 Keystore 可用性，本动作判失败`,
          );
        }
      }
      // 回显实际落库的 url，供调用方确认未被加工
      const stored = serverStore.servers.find(s => s.id === serverId);
      return {serverId, storedUrl: stored?.url ?? null};
    },
  },

  'server.probe': {
    id: 'server.probe',
    domain: 'model',
    description:
      '对已登记服务器探连通（复用 serverStore.testServerConnection，与 UI「测试连接」同链路）。回传 requestUrl 作为 normalizeUrl /v1 幂等的直接证据；失败 error 含诊断文案（如铁律 8.2 401 专属域提示）',
    paramsSchema: z.object({serverId: z.string().min(1)}),
    execute: async params => {
      const {serverId} = params as {serverId: string};
      const server = serverStore.servers.find(s => s.id === serverId);
      if (!server) {
        throw new Error(
          `未找到服务器 ${serverId}；先用 server.list 查 id（或 server.add 登记）`,
        );
      }
      // 探测走 store 单一路径，不在此重拼一份连接逻辑
      const result = await serverStore.testServerConnection(serverId);
      return {
        ...result,
        serverId,
        inputUrl: server.url,
        // 与 fetchModelsWithHeaders 同一 normalizeUrl：带 /v1 的入库 url 应被剥尾，
        // 此处不得出现 /v1/v1（G1-1 幂等铁律的可观测面）
        requestUrl: `${normalizeUrl(server.url)}/v1/models`,
      };
    },
  },

  'server.remove': {
    id: 'server.remove',
    domain: 'model',
    description:
      '移除一台服务器（测试收尾用，避免真验痕迹污染用户配置）：走 serverStore.removeServer，连带清 Keychain 密钥',
    paramsSchema: z.object({serverId: z.string().min(1)}),
    execute: async params => {
      const {serverId} = params as {serverId: string};
      const existed = serverStore.servers.some(s => s.id === serverId);
      if (!existed) {
        throw new Error(`未找到服务器 ${serverId}，无需移除`);
      }
      serverStore.removeServer(serverId);
      return {removed: true, serverId, remaining: serverStore.servers.length};
    },
  },

  'server.models': {
    id: 'server.models',
    domain: 'model',
    description:
      '列已拉取的远端模型 id（可按子串过滤）。/v1/models 可能回上百条，全量回显会抢爆结果文件',
    paramsSchema: z.object({
      serverId: z.string().min(1),
      contains: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }),
    execute: async params => {
      const p = params as {
        serverId: string;
        contains?: string;
        limit?: number;
      };
      const all = serverStore.serverModels.get(p.serverId) ?? [];
      const filtered = p.contains
        ? all.filter(m =>
            m.id.toLowerCase().includes(p.contains!.toLowerCase()),
          )
        : all;
      const limit = p.limit ?? 30;
      return {
        serverId: p.serverId,
        fetched: all.length,
        matched: filtered.length,
        shown: Math.min(filtered.length, limit),
        models: filtered.slice(0, limit).map(m => m.id),
      };
    },
  },

  'server.addModel': {
    id: 'server.addModel',
    domain: 'model',
    description:
      '把已拉取的远端模型加入可见集（同 UI「添加模型」addUserSelectedModel）。义肢链路必走此步：remoteModels 只派生自 userSelectedModels',
    paramsSchema: z.object({
      serverId: z.string().min(1),
      remoteModelId: z.string().min(1),
    }),
    execute: async params => {
      const {serverId, remoteModelId} = params as {
        serverId: string;
        remoteModelId: string;
      };
      const fetched = serverStore.serverModels.get(serverId) ?? [];
      if (!fetched.some(m => m.id === remoteModelId)) {
        const sample = fetched
          .slice(0, 8)
          .map(m => m.id)
          .join(', ');
        throw new Error(
          `模型 ${remoteModelId} 不在该服务器已拉取列表（共 ${fetched.length} 个）；先 server.probe 拉模型，再用 server.models 查 id。前 8 个：${
            sample || '（空）'
          }`,
        );
      }
      serverStore.addUserSelectedModel(serverId, remoteModelId);
      return {
        added: true,
        serverId,
        remoteModelId,
        remoteModelCount: modelStore.remoteModels.length,
      };
    },
  },

  'server.removeModel': {
    id: 'server.removeModel',
    domain: 'model',
    description:
      '从可见集移出单个远端模型（removeUserSelectedModel），测试收尾用',
    paramsSchema: z.object({
      serverId: z.string().min(1),
      remoteModelId: z.string().min(1),
    }),
    execute: async params => {
      const {serverId, remoteModelId} = params as {
        serverId: string;
        remoteModelId: string;
      };
      serverStore.removeUserSelectedModel(serverId, remoteModelId);
      return {
        removed: true,
        serverId,
        remoteModelId,
        remoteModelCount: modelStore.remoteModels.length,
      };
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
