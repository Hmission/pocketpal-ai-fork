/**
 * cjk — 汉字码位范围的唯一定义点（2026-09-07 W5 双份正则收口）。
 *
 * 旧状态：同一件事（「什么算汉字」）在仓内写了四份、三种范围，且两份同名不同义：
 *  - `utils/speakable.ts`      `CJK_RE = [\u4e00-\u9fff\u3400-\u4dbf]`（BMP + Ext-A）
 *  - `services/aiosCore/kg.ts` `CJK_RE = [\u4e00-\u9fff]`（仅 BMP）——同名、不同范围
 *  - `services/ttsEngine.ts`   `CHINESE_RE = BMP + Ext-A + 兼容表意`
 *  - `services/ttsEngine.ts`   `NON_LATIN_RE` 内又内联了一遍 BMP + Ext-A + 兼容
 * 读代码时无人能判断哪份是本仓口径，改一处只影响一条链。现区间只在此列一次，
 * 口径按**用途**命名导出；kg 的 BMP-only 是有意差异（见该处注释），不是漏改。
 *
 * 收口时唯一的语义变化（已裁定）：朗读判定 `HANZI_PRESENT_RE` 现含兼容表意区
 * （U+F900–U+FAFF）。旧口径下「整句只由兼容表意字构成」会被判成空白语言 →
 * 按词数算 1 词 → 朗读按钮不出现；这些字符本身就是汉字的兼容编码，属误判。
 */

/** 汉字码位区间（字符串形式，供正则组合）。 */
export const HANZI_RANGES = {
  /** 基本汉字（BMP，U+4E00–U+9FFF） */
  bmp: '\\u4e00-\\u9fff',
  /** 扩展 A 区（U+3400–U+4DBF，生僻字/古字） */
  extA: '\\u3400-\\u4dbf',
  /** 兼容表意文字（U+F900–U+FAFF，常见汉字的兼容编码） */
  compat: '\\uf900-\\ufaff',
} as const;

/** 全部汉字区（BMP + Ext-A + 兼容表意）的字符类内容，供更大字符类拼接。 */
export const HANZI_ALL_CLASS = `${HANZI_RANGES.bmp}${HANZI_RANGES.extA}${HANZI_RANGES.compat}`;

/**
 * 「这段文本里有汉字吗」——整体存在性判定的唯一口径。
 * 用途：朗读长度口径（`utils/speakable`）、音色语种匹配（`services/ttsEngine`）。
 */
export const HANZI_PRESENT_RE = new RegExp(`[${HANZI_ALL_CLASS}]`);

/**
 * 逐字判定，仅认 BMP 常用区。
 * 用途：知识图谱的中文二元组切分——只有常用字的两两组合才是有效关键词，
 * 生僻区/兼容区参与切分会造出重复的关键词身份（图谱宁小勿滥）。
 */
export const HANZI_BMP_CHAR_RE = new RegExp(`[${HANZI_RANGES.bmp}]`);
