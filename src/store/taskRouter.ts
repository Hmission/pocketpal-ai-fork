/**
 * TaskRouter — 任务路由（规则快筛，锋利不臃肿）
 *
 * 只"判断"不"执行"：把用户输入分类为任务信号，调度执行由调用方
 * （ChatScreen wrappedSendPress）受控完成——模型/路由不直接驱动 native。
 *
 * 任务→引擎映射：
 *   chitchat → prompter 常驻模型 / 现有 chat 模型
 *   image    → image 引擎（触发加载）
 *   write    → chat 大模型
 *   code     → chat 大模型
 *   play     → chat 大模型（玩具匠：代码模型 + render_html 出可玩成品，PLAY_SPEC v1）
 *   adventure → chat 大模型（城主：写作模型写剧情 + adventure_state 工具管状态，ADVENTURE_SPEC v1）
 */
export type TaskKind = 'chitchat' | 'image' | 'write' | 'code' | 'play' | 'adventure';

export interface TaskSignal {
  task: TaskKind;
  /** 提取的任务主题（生图主体 / 原始文本） */
  payload: string;
}

// 前置「画/绘」主导：动词在句首，主体=动词后内容（最明确的生图意图）。
// v2.1 修复（2026-08-16）：去 $ 锚定（允许后续内容）、放行逗号（句号/问号/感叹号/换行仍为主体边界，
// 避免「画一只猫。帮我写首诗」误吞后续句）、主体上限 40→80（长描述不再因长度失效）。
const LEADING_DRAW_RE =
  /^(?:帮我|请|给我)?\s*(?:画|绘)(?:一[张幅个]|张|幅)?\s*([^。！？!?\n]{1,80})/;

// 生图强关键词：图片类目标词（任意生图动词）｜照片/相片/写真（画/绘任意间隔，生成/做/来需紧跟张/幅量词，
// 防「生成一篇关于照片的文章」误伤写作）｜英文 image 词组
const IMAGE_KEYWORD_RE =
  /(?:画|生成|做|来|create|make|draw|paint|generate).{0,60}?(图片|插画|壁纸|海报|头像)|(?:画|绘).{0,60}?(照片|相片|写真)|(?:生成|做|来)(?:一[张幅个]|张|幅)\s*(照片|相片|写真)|\b(?:draw|paint|sketch|generate|create)\b.{0,60}?\b(?:image|picture|photo|art|wallpaper|illustration)\b/i;

// 写作：动词 + （可跨内容）+ 文体关键词
// 2026-08-17 补充高频文体词：游记/日记/周记/观后感/影评/散文（P1 真机验证发现缺口）
const WRITE_RE =
  /(?:写|帮我写|撰写)(?:一[篇首段个])?[^。！？!?\n]{0,30}?(?:诗|诗歌|文章|故事|作文|文案|总结|邮件|小说|简历|游记|日记|周记|观后感|影评|散文|散文诗)|\b(?:write|compose|draft)\b.{0,30}\b(?:poem|story|essay|article|email|summary)\b/i;

// 代码：明确的代码意图词（收紧，避免误伤日常 "error" 闲聊）
const CODE_RE =
  /(?:写|生成|帮我|修复).{0,8}(?:代码|程序|函数|脚本|正则|sql|接口)|\b(?:write|generate|fix|debug)\b.{0,15}\b(?:code|function|script|regex|sql|api)\b/i;

// 快捷前缀（P5 v2）：输入卡快捷按钮预填「图像生成：/图片编辑：」——显式意图引导。
// 图像生成→image（payload 剥离前缀）；图片编辑无源图无法编辑，不在此路由（显式链路走 scheduler）。
// 玩具工坊（P8 v1）：快捷按钮预填「做个玩具：」——玩法引导前后端对齐（PLAY_SPEC §2.5）。
// TRPG 城主（P12 v1.1）：快捷按钮预填「来场冒险：」——冒险玩法引导（ADVENTURE_SPEC §五）。
const QUICK_PREFIX_RE = /^(图像生成|图片编辑|做个玩具|来场冒险)[:：]\s*/;

// 玩具（P8 v1，PLAY_SPEC）：动词 + 玩具/游戏/小玩意类目标词。
// 收紧避免误伤：目标词仅限可玩品类，不含「代码/程序」（那是 code 域）。
// 倒装子句（2026-08-19 K90 血证）：「把贪吃蛇做出来」类自然话术动词在后，
// 漏路由 chitchat 后引擎卸载即落管家直答（管家无工具→贴代码断链）。
const PLAY_RE =
  /(?:做个|来一个|来个|来款|造个|整个|弄个|搞个|给我做个|帮我做|想玩)[^。！？!?\n]{0,20}?(?:游戏|玩具|贪吃蛇|俄罗斯方块|扫雷|抽签|转盘|摇奖|小游戏|小玩意|生成艺术|canvas)|(?:贪吃蛇|俄罗斯方块|扫雷|小游戏|玩具|转盘|抽签)[^。！？!?\n]{0,10}?(?:做出来|做好|弄出来|搞出来)/i;

// 冒险（P12 v1，ADVENTURE_SPEC）：城主/副本/冒险显式意图。
// 收紧避免误伤：需含冒险类关键词，日常「冒险尝试」不命中。
const ADVENTURE_RE =
  /(?:来场|开个|当|开启|进入|继续)(?:冒险|副本|地牢|dungeon)|冒险模式|一起冒险|城主/i;

export function routeTask(text: string): TaskSignal {
  const t = text.trim();

  // 0) 快捷前缀「图像生成：」：主体=前缀后内容（剥离后为空则不路由）
  const quick = t.match(QUICK_PREFIX_RE);
  if (quick && quick[1] === '图像生成') {
    const payload = t.slice(quick[0].length).trim();
    if (payload) {
      return {task: 'image', payload};
    }
  }
  // 0.1) 快捷前缀「做个玩具：」：显式玩法意图（PLAY_SPEC v1）。
  //     剥离后为空直接短路回 chitchat——否则「做个玩具：」会被下方 PLAY_RE 命中（做个+玩具）。
  if (quick && quick[1] === '做个玩具') {
    const payload = t.slice(quick[0].length).trim();
    if (payload) {
      return {task: 'play', payload};
    }
    return {task: 'chitchat', payload: t};
  }
  // 0.2) 快捷前缀「来场冒险：」：显式玩法意图（ADVENTURE_SPEC v1.1，D-4）。
  //     剥离后为空直接短路回 chitchat——与「做个玩具」同构防误伤。
  if (quick && quick[1] === '来场冒险') {
    const payload = t.slice(quick[0].length).trim();
    if (payload) {
      return {task: 'adventure', payload};
    }
    return {task: 'chitchat', payload: t};
  }

  // 1) 前置画/绘：主体=动词后内容
  const lead = t.match(LEADING_DRAW_RE);
  if (lead) {
    return {task: 'image', payload: lead[1].trim()};
  }

  // 2) 生图关键词（命中则以整句为提示词，交由 prompter 增强）
  if (IMAGE_KEYWORD_RE.test(t)) {
    return {task: 'image', payload: t};
  }

  // 3) 写作
  if (WRITE_RE.test(t)) {
    return {task: 'write', payload: t};
  }

  // 4) 代码
  if (CODE_RE.test(t)) {
    return {task: 'code', payload: t};
  }

  // 5) 玩具（P8 v1，PLAY_SPEC）
  if (PLAY_RE.test(t)) {
    return {task: 'play', payload: t};
  }

  // 6) 冒险（P12 v1，ADVENTURE_SPEC）
  if (ADVENTURE_RE.test(t)) {
    return {task: 'adventure', payload: t};
  }

  return {task: 'chitchat', payload: t};
}
