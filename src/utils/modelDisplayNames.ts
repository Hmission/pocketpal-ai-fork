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
import {IMAGE_GEN_MODEL_FILES} from './imageGenManifest';

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

/** 管家显示名（顶栏胶囊二档 / 选择器管家卡，B18 单一事实源） */
export const BUTLER_DISPLAY_NAME = '管家 MiniCPM 1B';

/** 管家模型判定：minicpm5_1b_heretic（prompter 常驻专用） */
export function isButlerModel(
  model: Partial<Pick<Model, 'name' | 'filename'>>,
): boolean {
  const raw = model.name || model.filename || '';
  return /heretic/i.test(raw) || /minicpm\s*5?[-_.]?1b/i.test(raw);
}

// 入选说明（B18，文案取自 MODEL_MATRIX §1 入选理由；选择器卡片单一事实源）
const NOTE_RULES: Array<{pattern: RegExp; note: string}> = [
  {
    pattern: /qwen3[.\-]?5[-_.\s]?2b/i,
    note: '写作/聊天主力，Q8 近无损；配对视觉伴侣可看图',
  },
  {pattern: /qwen3[.\-]?5[-_.\s]?4b/i, note: '日用均衡档，质量上限更高'},
  {pattern: /lfm2[.\-]?5[-_.\s]?2[.\-]?6b/i, note: '任务/工具调用优化，低延迟'},
  {
    pattern: /lfm2[.\-]?5[-_.\s]?8b/i,
    note: 'MoE 大模型（激活~1.5B），复杂任务质量上限',
  },
  {pattern: /ministral/i, note: '代码专长'},
  {pattern: /minicpm/i, note: '轻量聊天备选'},
];

/** 管家卡说明（卸载禁用原因 + 不占槽语义） */
export const BUTLER_NOTE =
  '常驻管家：意图识别/扩写/记忆收尾，自动加载、不占聊天槽';

/** 选择器卡片一行入选说明；管家命中管家说明，无命中返回空串 */
export function getModelNote(
  model: Partial<Pick<Model, 'name' | 'filename'>>,
): string {
  if (isButlerModel(model)) {
    return BUTLER_NOTE;
  }
  const raw = model.name || model.filename || '';
  for (const rule of NOTE_RULES) {
    if (rule.pattern.test(raw)) {
      return rule.note;
    }
  }
  return '';
}

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

/** 参数量提取：name/filename 中的「4B / 1B / 2.6B」→ 大写 B 统一 */
const extractParamSize = (raw: string): string => {
  // 不能要求 \b 单词边界：minicpm5_1b_heretic 中 1b 后跟 _（同为 \w）会失配，
  // 落入下方 fam 兜底把系列号 5 当参数量显示成 5B。改为仅排除数字/字母后续。
  const m = raw.match(/(\d+(?:\.\d+)?)\s*b(?![\da-z])/i);
  if (m) {
    const num = parseFloat(m[1]);
    // 去掉无意义的小数（2.0B → 2B），保留真实小数（2.6B）
    const label = Number.isInteger(num) ? String(num) : m[1];
    return `${label}B`;
  }
  // 家族后缀数字即参数量（MiniCPM4 → 4B；无显式 b 后缀）
  const fam = raw.match(/minicpm\s*[-_.]?(\d+)/i);
  if (fam) {
    return `${fam[1]}B`;
  }
  return '';
};

/** 量化档提取：Q4_K_M → Q4；F16 → F16；I1_XXS → I1 */
const extractQuant = (raw: string): string => {
  const q = raw.match(/[-_.](Q\d{1,2})/i);
  if (q) {
    return q[1].toUpperCase();
  }
  const f = raw.match(/[-_.](F\d{1,2})/i);
  if (f) {
    return f[1].toUpperCase();
  }
  const i = raw.match(/[-_.](I\d{1,2})/i);
  if (i) {
    return i[1].toUpperCase();
  }
  return '';
};

/**
 * 参数标签：从 name/filename 提取「（参数量_量化档）」，如「（4B_Q4）」。
 * 任一项缺失时降级为仅保留命中项；全无命中返回空串。
 */
export function getModelParamTag(
  model: Partial<Pick<Model, 'name' | 'filename'>>,
): string {
  const raw = model.name || model.filename || '';
  const size = extractParamSize(raw);
  const quant = extractQuant(raw);
  if (!size && !quant) {
    return '';
  }
  const tag = [size, quant].filter(Boolean).join('_');
  return `（${tag}）`;
}

/**
 * 模型条目完整显示：中文简称 + 参数标签，如「面壁 MiniCPM（4B_Q4）」。
 * 模型选择器条目显示单一事实源（不再展示原始文件名）。
 */
export function getModelDisplayNameWithParams(
  model: Partial<Pick<Model, 'name' | 'filename'>>,
): string {
  return `${getModelDisplayName(model)}${getModelParamTag(model)}`;
}

/**
 * 聊天可选性：仅 LLM。projection（多模态嵌入）/vision 等非 LLM 模型
 * 聊天引擎不加载，选择器/子菜单一律不显示（不兜底、不置灰）。
 * 生图模型（manifest 声明的 main/companions 文件）同样排除。
 */
export function isChatSelectable(
  model: Pick<Model, 'modelType' | 'filename'>,
): boolean {
  return (
    model.modelType === ModelType.LLM &&
    (model.filename ? !IMAGE_GEN_MODEL_FILES.has(model.filename) : true)
  );
}
