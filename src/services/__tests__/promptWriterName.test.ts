import {isPrompterModelName} from '../promptWriter';

describe('isPrompterModelName（管家模型判定）', () => {
  it('命中 MiniCPM5-1B 各命名形态', () => {
    expect(
      isPrompterModelName('MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-Q4_K_M.gguf'),
    ).toBe(true);
    expect(isPrompterModelName('minicpm5_1b_q4km.gguf')).toBe(true);
    expect(isPrompterModelName('MiniCPM5-1B.gguf')).toBe(true);
  });

  it('Qwen3-0.6B 已淘汰（MODEL_MATRIX 禁推）：不再识别为管家（P0 净化）', () => {
    expect(isPrompterModelName('Qwen3-0.6B-Q8_0.gguf')).toBe(false);
    expect(isPrompterModelName('qwen3_06b.gguf')).toBe(false);
  });

  it('不误伤聊天大模型', () => {
    // 连字符 qwen3-4b 是 Z-Image 的 LLM 伴侣/聊天模型，不是管家
    expect(isPrompterModelName('qwen3-4b-q4_k_m.gguf')).toBe(false);
    expect(isPrompterModelName('Qwen3.5-4B-Instruct.gguf')).toBe(false);
    expect(isPrompterModelName('Llama-3.2-3B-Instruct.gguf')).toBe(false);
    expect(isPrompterModelName('DeepSeek-R1-Distill-Qwen-7B.gguf')).toBe(false);
  });
});
