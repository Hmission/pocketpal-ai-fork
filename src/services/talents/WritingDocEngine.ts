import * as RNFS from '@dr.pogodin/react-native-fs';

import type {
  TalentEngine,
  TalentResult,
  ToolDefinition,
  SystemPromptContext,
} from './types';
import {
  ensureProject,
  projectDir,
  listProjects,
  touchProject,
  sanitizeProjectName,
} from '../workspace';
import {
  appendSection,
  updateSection,
  readSection,
  readWholeDoc,
  listSections,
  MAX_DOC_BYTES,
} from '../workspace/docStore';
import {addMemory} from '../aiosMemory';
import {emit} from '../../debug/eventStream';

/**
 * WritingDocEngine — 写作工作区工具（WORKSPACE_SPEC v1，2026-08-21）。
 *
 * 产物即文档：模型是作者，代码是纸笔——JS 层零业务逻辑，只把正文/大纲/
 * 人设落盘 workspace/writing/<project>/。正文按章分文件（单文件 ≤20KB，
 * 超限 append 显式拒绝 → 模型 new_chapter 开新章 = 天然分段），上下文
 * 永不预注入正文，模型经 read_section 按需读段。
 *
 * 跨会话续写：init 建项目并写记忆 fact「在写《X》」；新会话凭
 * 「继续写 X」→ workspace 索引 → 读框架文档 → 续写 append。
 */
export class WritingDocEngine implements TalentEngine {
  readonly name = 'writing_doc';

  /** 文档名 → 文件名（doc 参数如「大纲」「人设」「正文-第一章」）。 */
  private docFile(project: string, doc: string): string {
    return `${projectDir('writing', project)}/${sanitizeProjectName(doc) ?? '正文'}.md`;
  }

  private docFileSafe(project: string, doc: string): string | null {
    const cleanDoc = sanitizeProjectName(doc);
    const cleanProject = sanitizeProjectName(project);
    if (!cleanDoc || !cleanProject) {
      return null;
    }
    return `${projectDir('writing', cleanProject)}/${cleanDoc}.md`;
  }

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const action = (args.action as string) || '';
    const project = String(args.project ?? '').trim();

    const KNOWN = [
      'init',
      'list',
      'new_chapter',
      'read_section',
      'read_all',
      'list_sections',
      'append',
      'update_outline',
      'update_persona',
    ];
    if (!KNOWN.includes(action)) {
      return {
        type: 'error',
        summary:
          'writing_doc 仅支持 init / list / new_chapter / read_section / read_all / list_sections / append / update_outline / update_persona，未知动作「' +
          action +
          '」。',
        errorMessage: `Unknown action: ${action}`,
      };
    }

    try {
      if (action === 'init') {
        return await this.init(args);
      }
      if (action === 'list') {
        return this.list();
      }
      if (action === 'new_chapter') {
        return await this.newChapter(args);
      }
      // 框架修订固定写各自文档（不随 args.doc 漂移）
      if (action === 'update_outline') {
        const file = this.docFileSafe(project, '大纲');
        if (!file) {
          return this.err('INVALID_ARG', 'project 名称含非法字符。');
        }
        return await this.updateFrame(file, project, '大纲', String(args.content ?? ''));
      }
      if (action === 'update_persona') {
        const file = this.docFileSafe(project, '人设');
        if (!file) {
          return this.err('INVALID_ARG', 'project 名称含非法字符。');
        }
        return await this.updateFrame(file, project, '人设', String(args.content ?? ''));
      }
      // 其余动作需要项目上下文 + 文档名
      const file = this.docFileSafe(project, String(args.doc ?? '正文'));
      if (!file) {
        return this.err('INVALID_ARG', 'project/doc 名称含非法字符。');
      }
      if (action === 'read_section') {
        return await this.readSection(file, args);
      }
      if (action === 'read_all') {
        return await this.readAll(file);
      }
      if (action === 'list_sections') {
        return await this.listSections(file);
      }
      if (action === 'append') {
        return await this.append(file, project, args);
      }
    } catch (e) {
      return {
        type: 'error',
        summary: `写作工作区操作失败：${(e as Error)?.message ?? '未知错误'}`,
        errorMessage: 'WRITE_FAILED',
      };
    }

    return this.err('UNREACHABLE', '未知动作。');
  }

  /** 建项目：大纲/人设/正文首章骨架 + 索引 + 记忆「在写《X》」。 */
  private async init(args: Record<string, any>): Promise<TalentResult> {
    const title = String(args.title ?? '').trim();
    if (!title) {
      return this.err('EMPTY_TITLE', 'init 需要 title 参数。');
    }
    const genre = String(args.genre ?? '').trim();
    const dir = await ensureProject('writing', title, `刚开篇（${genre || '体裁未定'}）`);
    if (!dir) {
      return this.err('INVALID_TITLE', '项目名含非法字符。');
    }
    const outlinePath = this.docFileSafe(title, '大纲');
    const personaPath = this.docFileSafe(title, '人设');
    const firstChapter = this.docFileSafe(title, '正文-第一章');
    // 骨架占位（updateSection 空内容 = 删除节，故用占位文本）
    const placeholder = '（待写）';
    if (outlinePath) {
      await updateSection(outlinePath, '主线', placeholder);
      await updateSection(outlinePath, '分章计划', placeholder);
    }
    if (personaPath) {
      await updateSection(personaPath, '主要角色', placeholder);
      await updateSection(personaPath, '世界设定', placeholder);
    }
    if (firstChapter) {
      await updateSection(firstChapter, '第一章', placeholder);
    }
    // 记忆 fact（activity slot 自动命中「在写」）：跨会话「继续写」恢复凭据
    try {
      await addMemory('fact', `在写${genre ? `《${title}》（${genre}）` : `《${title}》`}`);
    } catch {
      // 记忆失败不阻断建项目（观测不为 SPOF）
    }
    emit('chat', 'workspace.writing_doc', {action: 'init', project: title});
    return {
      type: 'text',
      summary: `写作项目《${title}》已创建：大纲.md / 人设.md / 正文-第一章.md 就位。` +
        '先写大纲（update_outline）与主要角色（update_persona），再逐章 append 正文。',
    };
  }

  private async list(): Promise<TalentResult> {
    const projects = await listProjects('writing');
    if (projects.length === 0) {
      return {
        type: 'text',
        summary: '还没有写作项目。告诉大王可以用「新建写作项目」开一个。',
      };
    }
    const lines = projects.map(p =>
      `- 《${p.name}》${p.progress ? `：${p.progress}` : ''}（${new Date(p.updatedAt).toLocaleDateString()}）`,
    );
    return {type: 'text', summary: `现有写作项目：\n${lines.join('\n')}`};
  }

  /** 开新章：正文-<章节>.md（分章即分段，单文件 20KB 上限的出路）。 */
  private async newChapter(args: Record<string, any>): Promise<TalentResult> {
    const project = String(args.project ?? '').trim();
    const chapter = String(args.chapter ?? '').trim();
    if (!project || !chapter) {
      return this.err('INVALID_ARG', 'new_chapter 需要 project 与 chapter 参数。');
    }
    const file = this.docFileSafe(project, `正文-${chapter}`);
    if (!file) {
      return this.err('INVALID_ARG', '章节名含非法字符。');
    }
    if (await RNFS.exists(file)) {
      return this.err('CHAPTER_EXISTS', `章节「${chapter}」已存在，请换章节名或读回续写。`);
    }
    // 骨架占位（updateSection 空内容 = 删除节）
    await updateSection(file, chapter, '（待写）');
    await touchProject('writing', project);
    return {
      type: 'text',
      summary: `已开新章「${chapter}」（正文-${chapter}.md），可以用 append 写入内容。`,
    };
  }

  private async readSection(
    file: string,
    args: Record<string, any>,
  ): Promise<TalentResult> {
    const section = String(args.section ?? '').trim();
    if (!section) {
      return this.err('EMPTY_SECTION', 'read_section 需要 section 参数。');
    }
    const hit = await readSection(file, section);
    if (!hit) {
      return this.err('NO_SECTION', `「${section}」节不存在，先 list_sections 看有哪些节。`);
    }
    return {
      type: 'text',
      summary: `## ${hit.section}\n${hit.content || '（空节）'}`,
    };
  }

  private async readAll(file: string): Promise<TalentResult> {
    const raw = await readWholeDoc(file);
    if (raw === null) {
      return this.err('NO_DOC', '文档不存在（检查 doc 参数，如「大纲」「人设」「正文-第一章」）。');
    }
    return {type: 'text', summary: raw};
  }

  private async listSections(file: string): Promise<TalentResult> {
    const sections = await listSections(file);
    if (sections === null) {
      return this.err('NO_DOC', '文档不存在（检查 doc 参数，如「大纲」「人设」「正文-第一章」）。');
    }
    if (sections.length === 0) {
      return {type: 'text', summary: '（文档还没有分节，可 append 创建）'};
    }
    const lines = sections.map(s =>
      `- ${s.section}${s.content ? `（${s.content.length} 字）` : '（空）'}`,
    );
    return {type: 'text', summary: `文档分节：\n${lines.join('\n')}`};
  }

  /** 续写落盘：返回「已写入 N 字」回执进对话流；超限提示开新章。 */
  private async append(
    file: string,
    project: string,
    args: Record<string, any>,
  ): Promise<TalentResult> {
    const section = String(args.section ?? '').trim();
    const content = String(args.content ?? '').trim();
    if (!section || !content) {
      return this.err('EMPTY_CONTENT', 'append 需要 section 与 content 参数。');
    }
    const result = await appendSection(file, section, content);
    if (!result.ok) {
      if (result.error === 'DOC_TOO_LARGE') {
        return {
          type: 'error',
          summary:
            `「${section}」节已到 ${MAX_DOC_BYTES / 1024}KB 上限，本次未写入。` +
            '用 new_chapter 开新章继续写，别把长文塞进旧章。',
          errorMessage: 'DOC_TOO_LARGE',
        };
      }
      return this.err(result.error ?? 'WRITE_FAILED', '写入失败，内容未落盘。');
    }
    await touchProject('writing', project);
    emit('chat', 'workspace.writing_doc', {
      action: 'append',
      project,
      section,
      bytes: result.bytes,
    });
    return {
      type: 'text',
      summary: `已写入「${section}」节 ${content.length} 字（${(result.bytes ?? 0) / 1024 < 1 ? (result.bytes ?? 0) + 'B' : ((result.bytes ?? 0) / 1024).toFixed(1) + 'KB'}），正文已落盘。`,
    };
  }

  /** 框架修订：大纲/人设整节替换（模型自报进度进索引）。 */
  private async updateFrame(
    file: string,
    project: string,
    doc: string,
    content: string,
  ): Promise<TalentResult> {
    if (!content) {
      return this.err('EMPTY_CONTENT', `${doc} 内容为空。`);
    }
    const section = doc === '大纲' ? '主线' : '主要角色';
    const result = await updateSection(file, section, content);
    if (!result.ok) {
      return this.err(result.error ?? 'WRITE_FAILED', `${doc} 更新失败。`);
    }
    await touchProject('writing', project, `${doc}已更新`);
    return {
      type: 'text',
      summary: `${doc}已更新（${content.length} 字）。`,
    };
  }

  private err(errorMessage: string, summary: string): TalentResult {
    return {type: 'error', summary, errorMessage};
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          '写作工作区管理：init 新建项目（大纲/人设/正文骨架）；append 把正文续写落盘（每章一文件，单文件 20KB 上限，超限用 new_chapter 开新章）；read_section 按节读取（正文不预注入，需要时自取）；update_outline / update_persona 修订框架；list 项目清单（恢复入口）。长文必须落盘，不要只留在对话里。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: [
                'init',
                'list',
                'new_chapter',
                'read_section',
                'read_all',
                'list_sections',
                'append',
                'update_outline',
                'update_persona',
              ],
              description:
                'init 建项目 / list 清单 / new_chapter 开新章 / read_section 按节读 / read_all 读整篇 / list_sections 节清单 / append 续写落盘 / update_outline 大纲 / update_persona 人设',
            },
            project: {
              type: 'string',
              description: '项目名（init 用 title，其余动作用 project）',
            },
            title: {type: 'string', description: 'init 时的项目标题'},
            genre: {type: 'string', description: 'init 时的体裁（小说/散文/剧本…）'},
            doc: {
              type: 'string',
              description: '文档名：大纲 / 人设 / 正文-<章节>',
            },
            chapter: {type: 'string', description: 'new_chapter 的新章节名'},
            section: {type: 'string', description: '节名（如「第一章」「主线」）'},
            content: {type: 'string', description: '要落盘的内容'},
          },
          required: ['action'],
        },
      },
    };
  }

  systemPromptFragment(_ctx: SystemPromptContext): string | null {
    return (
      'You are the writer (女妖执笔) for long-form writing tasks. When the user asks to ' +
      'write a story/novel/essay, create a writing project with writing_doc init, draft the ' +
      'outline and characters first (update_outline/update_persona), then write chapter by ' +
      'chapter with append — the manuscript lives in the project files, never only in chat. ' +
      'Read prior sections with read_section before continuing; start a new chapter with ' +
      'new_chapter when one file approaches its limit. On "继续写/续写" requests, list() to ' +
      'find the project and resume. Never break the fiction to discuss tools.'
    );
  }
}
