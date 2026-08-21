/**
 * 产物工作区——跨会话恢复协议（WORKSPACE_SPEC v1，2026-08-21）
 *
 * 「继续写 X」链路：useChatScheduler 解析项目名 → findProject 命中 →
 * 读框架文档（大纲/人设全文，小文件内联）→ setPendingWorkspaceContext →
 * useChatSession 组装时 consume 注入 system（一次消费，不跨轮残留）。
 * 正文/剧情永不预注入——模型经 writing_doc.read_section 按需取。
 */
import {readWholeDoc} from './docStore';
import {findProject, projectDir, ProjectDomain} from './index';

export interface WorkspaceRecovery {
  domain: ProjectDomain;
  project: string;
  /** 框架文档组装文本（大纲 + 人设 + 进度），供 system 注入 */
  frameworkText: string;
}

/** 待注入工作区上下文（单次消费：useChatScheduler 写入，useChatSession 取走）。 */
let pending: WorkspaceRecovery | null = null;

export function setPendingWorkspaceContext(
  ctx: WorkspaceRecovery | null,
): void {
  pending = ctx;
}

/** 取走并清空（消费即清，防跨轮残留）。 */
export function consumePendingWorkspaceContext(): WorkspaceRecovery | null {
  const ctx = pending;
  pending = null;
  return ctx;
}

/** 续写/写作意图词（剥离后剩余 = 项目名）。 */
const RESUME_PREFIX_RE =
  /^(?:继续写|继续创作|续写|接着写|接着写下去|写下去|继续把|新建写作项目|写作项目|新写作项目)[:：]?\s*/;

/** 从用户输入解析项目名：《X》优先；无书名号且以续写/建项前缀开头 → 剥前缀取剩余。 */
export function parseProjectName(text: string): string | null {
  const book = text.match(/《([^《》]{1,30})》/);
  if (book) {
    return book[1].trim();
  }
  if (!RESUME_PREFIX_RE.test(text)) {
    return null;
  }
  const rest = text.replace(RESUME_PREFIX_RE, '').trim();
  return rest ? rest : null;
}

/** 是否续写/新建写作意图（路由后仍可判定；纯判定不读盘）。 */
export function isWritingResumeIntent(text: string): boolean {
  return /(?:继续写|续写|接着写|写下去|继续创作|新建写作项目|写作项目)/.test(
    text,
  );
}

/**
 * 恢复解析：项目命中 → 读框架文档组装注入文本；未命中返回 null
 * （调用方静默放行，模型可自主 init——不新增兜底）。
 */
export async function resolveWritingRecovery(
  text: string,
): Promise<WorkspaceRecovery | null> {
  const project = parseProjectName(text);
  if (!project) {
    return null;
  }
  const entry = await findProject('writing', project);
  if (!entry) {
    return null;
  }
  const dir = projectDir('writing', entry.name);
  const [outline, persona] = await Promise.all([
    readWholeDoc(`${dir}/大纲.md`),
    readWholeDoc(`${dir}/人设.md`),
  ]);
  const parts: string[] = [];
  if (outline) {
    parts.push(`【《${entry.name}》大纲】\n${outline}`);
  }
  if (persona) {
    parts.push(`【《${entry.name}》人设】\n${persona}`);
  }
  if (!parts.length) {
    return null;
  }
  const progress = entry.progress ? `（进度：${entry.progress}）` : '';
  return {
    domain: 'writing',
    project: entry.name,
    frameworkText: `【写作项目恢复】\n${parts.join('\n\n')}${progress}\n` +
      '正文在分章文档里，需要时用 writing_doc.read_section 按需读取，续写用 append 落盘。',
  };
}
