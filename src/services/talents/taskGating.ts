import {routeTask} from '../../store/taskRouter';

/**
 * A2 任务驱动工具裁剪（2026-09-03 K90 真机取证落地）：
 *
 * 背景：女妖 pact 11 工具全量注入每次聊天推理的 tools + grounding 系统提示，
 * 固定数千 token 的 prefill 开销，且模型拿到工具后倾向先调工具 → 每轮 2+ 次推理。
 * 真机：2B 模型 TTFT 73s（例），其中之一大权重即工具 schema/grounding 常驻。
 *
 * 原则（与 useChatScheduler 任务路由设计对齐）：
 * - 任务会话（write/code/play/adventure）→ 全量工具（任务需要完整工具链）；
 * - chitchat → 仅常驻轻量工具（schema + grounding 体量小、闲聊高频），
 *   重量工具（web_search/device_control/writing_doc 等）按用户显式唤起词补注入；
 * - 裁剪只发生在聊天主链注入面，pact.talents（PalStore 对账基准）保持不动——
 *   女妖能力声明仍是完整 11 工具，本模块是「发送面」的按需路由。
 */

/** chitchat 常驻轻量工具：datetime/calculate 无 systemPromptFragment，note_save
 * 与 search_memory 仅极简片段；日期/计算/记事/记忆检索均为闲聊高频能力。 */
export const CHITCHAT_LIGHT_TOOLS = [
  'datetime',
  'calculate',
  'note_save',
  'search_memory',
] as const;

/**
 * 显式唤起规则：chitchat 文本命中 → 将对应重量工具补注入。
 * 顺序敏感：先命中的规则先生效（无副作用，Set 去重），保持声明顺序。
 */
const EXPLICIT_EVOKE_RULES: ReadonlyArray<{
  tools: readonly string[];
  re: RegExp;
}> = [
  {
    // 信息检索类强唤起词：搜/查/资料/资讯/新闻/网页/股价/汇率/百度/谷歌/上网。
    // 注意不放「天气/比赛」等日常名词——闲聊「今天天气不错」不触发搜索工具。
    tools: ['web_search', 'read_url'],
    re: /搜|查|资料|资讯|新闻|网页|股价|汇率|百度|谷歌|上网/,
  },
  {
    // 设备控制类：开/关/调节/音量/亮度/蓝牙/电源等
    tools: ['device_control'],
    re: /打开|关闭|调节|音量|亮度|蓝牙|wifi|电源|开关|控制/,
  },
  {
    // 写作唤起类：写/文章/文档/邮件/小说/续写（命中则补 writing_doc）
    tools: ['writing_doc'],
    re: /写|文章|文档|邮件|小说|作文|续写|创作/,
  },
  {
    // HTML 卡片类：出卡可视化（render_html + 迭代读回）
    tools: ['render_html', 'read_html'],
    re: /卡片|可视化|html|页面|海报|图表|制作.*(图|卡)|生成.*(图|卡)/,
  },
];

/**
 * 按任务路由 + 显式唤起裁剪工具名集合。
 * - 任务会话（write/code/play/adventure）→ 原样返回（任务需要完整工具链）；
 * - chitchat → 轻量常驻 + 文本命中显式唤起规则的重量工具。
 * 保持输入顺序。纯函数、幂等——useChatSession tools 注入面与
 * allowedTalentNames 面共用本函数，保证上下一致。
 */
export function resolveGatedTalentNames(
  text: string,
  allTalentNames: string[],
): string[] {
  const signal = routeTask(text);
  if (signal.task !== 'chitchat') {
    return allTalentNames;
  }

  const gated = new Set<string>(
    CHITCHAT_LIGHT_TOOLS.filter(name => allTalentNames.includes(name)),
  );
  for (const rule of EXPLICIT_EVOKE_RULES) {
    if (rule.re.test(text)) {
      for (const name of rule.tools) {
        if (allTalentNames.includes(name)) {
          gated.add(name);
        }
      }
    }
  }
  // 保序输出：以 allTalentNames 为基准过滤，避免顺序突变影响 trigger marker 缓存。
  return allTalentNames.filter(name => gated.has(name));
}
