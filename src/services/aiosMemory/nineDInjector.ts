/**
 * nineDInjector — 端侧 9D 记忆维度按需注入（AIOS_CORE_SPEC Wave C+ · G3-2）
 *
 * 母仓协议：nine_d_context_injector.py（12 维记忆总线 + token 预算 + 无任务不注入硬门）。
 * 端侧形态：纯 TS，零 LLM 调用（注入已有记忆，不新抽取），对齐母仓「漏斗原则」。
 *
 * 锋利原则：
 * - 无 taskHint → 直接返回空串（对齐母仓 `if not task_hint: return ""`）
 * - token 预算用纯算术近似（cn/1.5 + en/4），不引入 tokenizer 依赖
 * - 每维最多 3 条，总预算耗尽截断尾部（对齐母仓 budget 行为）
 *
 * 注入优先级（母仓 dim_order 端侧化，大王锚定最优先）：
 * D7(大王锚定) > D4(伤疤) > D5(链路上文) > D8(演化) > D1(身份) >
 * D2(态势) > D3(领域) > D6(知识) > D9(任务) > D_CONT(连续性) > D_GOV(治理) > ''(通用)
 *
 * 消费方：contextAssembler.assembleContext()，拼在 memoryFragment 之后。
 */
import {listMemories} from './index';
import type {AiosMemory} from './index';

/** 维度优先级（越小越优先） */
const DIM_ORDER: string[] = [
  'D7',
  'D4',
  'D5',
  'D8',
  'D1',
  'D2',
  'D3',
  'D6',
  'D9',
  'D_CONT',
  'D_GOV',
  '',
];

const PER_DIM_MAX = 3;
const DEFAULT_TOKEN_BUDGET = 500;

/**
 * token 估算：对齐母仓 `_estimate_tokens` 口径（纯算术，无依赖）。
 * 中文/日文字符 ≈ 1.5 token/字，ASCII ≈ 4 字/token。
 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let ascii = 0;
  for (const ch of text) {
    if (/[一-鿿぀-ヿ가-힯]/.test(ch)) {
      cjk++;
    } else {
      ascii++;
    }
  }
  return Math.ceil(cjk / 1.5 + ascii / 4);
}

/**
 * 按维度优先级 + 每维限额 + token 预算从记忆中挑选注入候选。
 * 未标注 dimension 的记忆归入 '' （通用）类，最后注入。
 */
function selectByBudget(memories: AiosMemory[], budget: number): AiosMemory[] {
  // 按维度分桶
  const buckets = new Map<string, AiosMemory[]>();
  for (const m of memories) {
    const dim = m.dimension ?? '';
    if (!buckets.has(dim)) {
      buckets.set(dim, []);
    }
    buckets.get(dim)!.push(m);
  }

  const selected: AiosMemory[] = [];
  let usedTokens = 0;

  for (const dim of DIM_ORDER) {
    const items = buckets.get(dim);
    if (!items || items.length === 0) {
      continue;
    }
    // 同维度按时间倒序（最新的优先）
    const sorted = [...items].sort((a, b) => b.ts - a.ts);
    let dimCount = 0;
    for (const m of sorted) {
      if (dimCount >= PER_DIM_MAX) {
        break;
      }
      const tokens = estimateTokens(m.content);
      if (usedTokens + tokens > budget) {
        break; // 预算耗尽，截断尾部（对齐母仓行为）
      }
      selected.push(m);
      usedTokens += tokens;
      dimCount++;
    }
    if (usedTokens >= budget) {
      break;
    }
  }

  return selected;
}

/**
 * 9D 按需注入（纯函数，零 LLM 调用）。
 *
 * @param taskHint 当前用户输入（聊天文本）；空 → 不注入
 * @param budget   token 预算（默认 500）
 * @returns 格式化好的 system prompt 片段（可直接拼进 assembleContext）；
 *          无命中或无 taskHint → 空字符串
 */
export async function injectNineD(
  taskHint: string,
  budget = DEFAULT_TOKEN_BUDGET,
): Promise<string> {
  // 漏斗硬门：无任务不注入（对齐母仓 `if not task_hint: return ""`）
  if (!taskHint || !taskHint.trim()) {
    return '';
  }

  let allMemories: AiosMemory[];
  try {
    allMemories = await listMemories();
  } catch {
    return ''; // 记忆读失败静默（观测不为 SPOF）
  }

  // 只注入未被 supersede 的记忆
  const active = allMemories.filter(m => !m.supersededBy);
  if (active.length === 0) {
    return '';
  }

  const selected = selectByBudget(active, budget);
  if (selected.length === 0) {
    return '';
  }

  // 格式：每条一行，带维度标签
  const lines = selected.map(m => {
    const dim = m.dimension ?? '';
    const tag = dim ? `[${dim}] ` : '';
    return `- ${tag}${m.content}`;
  });

  return ['【9D 按需记忆注入】', ...lines].join('\n');
}
