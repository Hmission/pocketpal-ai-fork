/**
 * modelDisplayNames — 模型中文简称注册表 + 聊天可选性判定（单一事实源）
 *
 * 三处共用：模型选择弹窗（ChatPalModelPickerSheet）/ 长按「换模型重新生成」
 * 子菜单（ChatView）/ 未来其他模型下拉。
 *
 * 锋利原则：
 *  - 非 LLM 模型（projection/vision 嵌入模型）聊天链路不可加载，一律不显示。
 *  - 简称仅中文显示；无注册命中时回落「去量化后缀的族名」，不硬造翻译。
 */
import {Model, ModelType} from './types';

// 已知模型 → 中文简称（顺序敏感：具体版本规则在前，族兜底在后）
const DISPLAY_NAME_RULES: Array<{pattern: RegExp; short: string}> = [
  {pattern: /qwen3[.\-]?5[-_.\s]?2b/i, short: '通义千问 2B'},
  {pattern: /qwen3[.\-]?5[-_.\s]?4b/i, short: '通义千问 4B'},
  {pattern: /minicpm/i, short: '面壁 MiniCPM'},
  {pattern: /lfm2[.\-]?5[-_.\s]?2[.\-]?6b/i, short: 'Liquid 2.6B'},
  {pattern: /lfm2[.\-]?5[-_.\s]?8b/i, short: 'Liquid 8B'},
  {pattern: /ministral[-_.\s]?3[-_.\s]?3b/i, short: '小雾 3B'},
  {pattern: /ministral/i, short: '小雾'},
];

/** 回落规则：去容器后缀与量化档位，取族名（xxx-Q4_K_M.gguf → xxx） */
const fallbackName = (raw: string): string =>
  raw
    .replace(/\.(gguf|safetensors|bin)$/i, '')
    .replace(/[-_.](Q\d{1,2}_\w+|F\d{2}|I\d{1,2}_\w+)$/i, '')
    .trim();

export function getModelDisplayName(
  model: Partial<Pick<Model, 'name' | 'filename'>>,
): string {
  const raw = model.name || model.filename || '';
  for (const rule of DISPLAY_NAME_RULES) {
    if (rule.pattern.test(raw)) {
      return rule.short;
    }
  }
  return fallbackName(raw) || raw;
}

/**
 * 聊天可选性：仅 LLM。projection（多模态嵌入）/vision 等非 LLM 模型
 * 聊天引擎不加载，选择器/子菜单一律不显示（不兜底、不置灰）。
 */
export function isChatSelectable(model: Pick<Model, 'modelType'>): boolean {
  return model.modelType === ModelType.LLM;
}
