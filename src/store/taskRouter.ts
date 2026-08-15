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
 */
export type TaskKind = 'chitchat' | 'image' | 'write' | 'code';

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
const WRITE_RE =
  /(?:写|帮我写|撰写)(?:一[篇首段个])?[^。！？!?\n]{0,30}?(?:诗|诗歌|文章|故事|作文|文案|总结|邮件|小说|简历)|\b(?:write|compose|draft)\b.{0,30}\b(?:poem|story|essay|article|email|summary)\b/i;

// 代码：明确的代码意图词（收紧，避免误伤日常 "error" 闲聊）
const CODE_RE =
  /(?:写|生成|帮我|修复).{0,8}(?:代码|程序|函数|脚本|正则|sql|接口)|\b(?:write|generate|fix|debug)\b.{0,15}\b(?:code|function|script|regex|sql|api)\b/i;

export function routeTask(text: string): TaskSignal {
  const t = text.trim();

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

  return {task: 'chitchat', payload: t};
}
