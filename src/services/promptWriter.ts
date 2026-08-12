/**
 * PromptWriter — 端侧提示词撰写智能体（无限制超迷你 LLM）
 *
 * 生图过程中帮用户把简短中文描述扩写成高质量英文 SD 提示词。
 * 首选模型：MiniCPM5-1B-heretic Q4_K_M（~0.7GB，无审查，1B 级最强，
 * Claude-Opus/Fable5 Thinking 蒸馏）；回退 Qwen3-0.6B。
 * 独立 LlamaContext，与生图引擎/聊天模型内存可共存，用完即释放避免常驻。
 *
 * 模型约定：/sdcard/Documents/AIOS/models/ 下文件名匹配
 * minicpm5*1b*（优先 heretic）或 qwen3*0.6b。
 */
import {initLlama, LlamaContext} from 'llama.rn';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {engineStatus} from '../store/engineStatus';
import {prompterGuard} from '../utils/engineGuard';

const SD_MODELS_DIR = '/sdcard/Documents/AIOS/models';

const SYSTEM_PROMPT =
  'You are a Stable Diffusion prompt expert. ' +
  'The user gives a short Chinese description. Expand it into ONE detailed ' +
  'English Stable Diffusion prompt with subject, style, lighting, composition ' +
  'and quality tags (e.g. "masterpiece, best quality"). ' +
  'Output ONLY the English prompt, no explanation, no quotes.';

// 管家通用闲聊人设（chitchat 兜底：chat 大模型未加载时由管家直接回答）
const CHITCHAT_SYSTEM_PROMPT =
  '你是口袋八哥（Pocket Myna），一只聪明伶俐的 AI 八哥助手。' +
  '用用户的语言简洁、友好、带点机智地回答。若用户用中文提问则用中文回答。';

/**
 * 判定文件名是否属于管家模型（MiniCPM5-1B / Qwen3-0.6B）。
 * modelCapabilityRegistry 用它把管家从“写作/代码专用模型”候选中排除。
 */
export const isPrompterModelName = (name: string): boolean =>
  /minicpm5?[-_ ]?1b/i.test(name) || /qwen3[-_ ]?0\.?6b/i.test(name);

// chat 结束符（im_end / llama eos）
const STOP_TOKENS = ['<im_end>', '<|eot_id|>'];

class PromptWriter {
  private ctx: LlamaContext | undefined;
  private loading: Promise<boolean> | null = null;

  /** 扫描模型目录：优先 MiniCPM5-1B heretic，回退 Qwen3-0.6B */
  async findModelPath(): Promise<string | null> {
    try {
      const files = await RNFS.readDir(SD_MODELS_DIR);
      const ggufs = files.filter(f => f.name.endsWith('.gguf'));
      const heretic = ggufs.find(f =>
        /minicpm5?[-_ ]?1b/i.test(f.name) && /heretic/i.test(f.name),
      );
      const minicpm = ggufs.find(
        f => /minicpm5?[-_ ]?1b/i.test(f.name) && !/heretic/i.test(f.name),
      );
      const qwen = ggufs.find(f => /qwen3[-_ ]?0\.?6b/i.test(f.name));
      const hit = heretic ?? minicpm ?? qwen;
      return hit ? hit.path : null;
    } catch {
      return null;
    }
  }

  /** 懒加载引擎（并发安全） */
  async ensureLoaded(): Promise<boolean> {
    if (this.ctx) {
      return true;
    }
    if (this.loading) {
      return this.loading;
    }
    this.loading = (async () => {
      const path = await this.findModelPath();
      if (!path) {
        // 未安装管家模型是正常态（非错误），保持 idle
        engineStatus.setPhase('prompter', 'idle');
        return false;
      }
      engineStatus.setPhase('prompter', 'loading', '加载管家模型…');
      try {
        this.ctx = await initLlama({
          model: path,
          n_ctx: 2048,
          n_batch: 512,
          n_threads: 4,
          use_mlock: false,
          use_mmap: true,
          use_progress_callback: false,
        });
        const ok = !!this.ctx;
        engineStatus.setPhase('prompter', ok ? 'ready' : 'error', ok ? '' : '加载失败');
        return ok;
      } catch (e) {
        console.warn('[PromptWriter] load failed:', e);
        this.ctx = undefined;
        engineStatus.setError('prompter', `管家模型加载失败: ${(e as Error)?.message ?? e}`);
        return false;
      }
    })();
    const ok = await this.loading;
    this.loading = null;
    return ok;
  }

  get isLoaded(): boolean {
    return !!this.ctx;
  }

  /** 把中文描述扩写成英文 SD 提示词（thinking 模型关闭思考） */
  async writePrompt(chinese: string): Promise<string | null> {
    if (!this.ctx) {
      const ok = await this.ensureLoaded();
      if (!ok || !this.ctx) {
        return null;
      }
    }
    try {
      let out = '';
      // guard：管家 context 串行化+冷却窗+重试
      await prompterGuard.run(() =>
        this.ctx!.completion(
          {
            messages: [
              {role: 'system', content: SYSTEM_PROMPT},
              {role: 'user', content: chinese},
            ],
            n_predict: 220,
            temperature: 0.7,
            enable_thinking: false,
            stop: STOP_TOKENS,
          } as any,
          (data: {token?: string; content?: string}) => {
            const piece = data?.token ?? data?.content ?? '';
            if (typeof piece === 'string') {
              out += piece;
            }
          },
        ),
      );
      // 清理可能的 think 残留与首尾空白
      const cleaned = out
        .replace(/[\s\S]*?<\/think>/g, '')
        .trim();
      return cleaned.length > 0 ? cleaned : null;
    } catch (e) {
      console.warn('[PromptWriter] completion failed:', e);
      return null;
    }
  }

  /** 释放引擎（把内存还给生图/聊天） */
  async release(): Promise<void> {
    if (this.ctx) {
      await this.ctx.release();
      this.ctx = undefined;
      engineStatus.setPhase('prompter', 'idle');
    }
  }

  /**
   * 通用闲聊（chitchat 兜底）：chat 大模型未加载时，由常驻管家直接回答，
   * 实现“启动即就绪”的产品闭环。
   */
  async chat(text: string): Promise<string | null> {
    if (!this.ctx) {
      const ok = await this.ensureLoaded();
      if (!ok || !this.ctx) {
        return null;
      }
    }
    engineStatus.setPhase('prompter', 'running', '管家思考中…');
    const t0 = Date.now();
    try {
      let out = '';
      await prompterGuard.run(() =>
        this.ctx!.completion(
          {
            messages: [
              {role: 'system', content: CHITCHAT_SYSTEM_PROMPT},
              {role: 'user', content: text},
            ],
            n_predict: 512,
            temperature: 0.7,
            enable_thinking: false,
            stop: STOP_TOKENS,
          } as any,
          (data: {token?: string; content?: string}) => {
            const piece = data?.token ?? data?.content ?? '';
            if (typeof piece === 'string') {
              out += piece;
            }
          },
        ),
      );
      engineStatus.setPhase('prompter', 'ready');
      const cleaned = out.replace(/[\s\S]*?<\/think>/g, '').trim();
      console.info(
        `[PromptWriter] chat done in ${Date.now() - t0}ms, ${cleaned.length} chars`,
      );
      return cleaned.length > 0 ? cleaned : null;
    } catch (e) {
      console.warn('[PromptWriter] chat failed:', e);
      engineStatus.setPhase('prompter', 'ready');
      return null;
    }
  }
}

export const promptWriter = new PromptWriter();
