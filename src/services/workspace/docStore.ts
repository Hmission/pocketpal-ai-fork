/**
 * 产物工作区——分段读取原语（WORKSPACE_SPEC v1，2026-08-21）
 *
 * 按需读取核心：文档以 `## 标题` 分节（markdown），模型经工具
 * readSection 只读目标节，正文/剧情永不预注入上下文——上下文只放
 * 框架指针，内容按需取。单文件 ≤20KB（与冒险 state.json 同上限），
 * 超限 appendSection 显式拒绝，模型据此开新章 = 天然分段。
 *
 * 写路径统一基于 parseDoc 重建（节标题行 + 正文规范化），无正则
 * 替换的边界缺陷；所有读接口失败返回 null，写接口失败返回
 * {error}——显式失败不静默。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

export const MAX_DOC_BYTES = 20 * 1024;

export interface DocSection {
  /** 节名（`## ` 后的标题文本，trim） */
  section: string;
  /** 节正文（不含标题行） */
  content: string;
}

export interface ParsedDoc {
  /** `## ` 之前的头部行（如 `# 项目名`），重建时原样保留 */
  preamble: string;
  sections: DocSection[];
}

export interface DocWriteResult {
  ok: boolean;
  /** 失败原因（errorMessage 语义，供 TalentResult 透传） */
  error?: string;
  /** 写后全文字节数 */
  bytes?: number;
}

async function readFileSafe(path: string): Promise<string | null> {
  try {
    if (!(await RNFS.exists(path))) {
      return null;
    }
    return await RNFS.readFile(path, 'utf8');
  } catch (e) {
    console.warn(`[workspace] read ${path} failed:`, e);
    return null;
  }
}

/** 行 → 结构：`## ` 前缀行为节标题；之前的行为 preamble。 */
export function parseDoc(raw: string): ParsedDoc {
  const lines = raw.split(/\r?\n/);
  const sections: DocSection[] = [];
  let preamble = '';
  let current: DocSection | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      current = {section: m[1].trim(), content: ''};
      sections.push(current);
    } else if (current) {
      current.content += (current.content ? '\n' : '') + line;
    } else if (line.trim()) {
      preamble += (preamble ? '\n' : '') + line;
    }
  }
  // 尾部空行属格式分隔（节标题前/文件尾），不进正文
  for (const s of sections) {
    s.content = s.content.replace(/\n+$/, '');
  }
  preamble = preamble.replace(/\n+$/, '');
  return {preamble, sections};
}

/** 结构化重建（块间空行分隔：preamble / 每节各一块）。 */
function rebuild(doc: ParsedDoc): string {
  const blocks: string[] = [];
  if (doc.preamble) {
    blocks.push(doc.preamble);
  }
  for (const s of doc.sections) {
    blocks.push(
      s.content ? `## ${s.section}\n${s.content}` : `## ${s.section}`,
    );
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}

/** 全文读取（短文档/框架文档用；>20KB 由写入侧保证不存在）。 */
export async function readWholeDoc(path: string): Promise<string | null> {
  return readFileSafe(path);
}

/** 节清单（模型据此决定读哪段）；文件不存在返回 null。 */
export async function listSections(path: string): Promise<DocSection[] | null> {
  const raw = await readFileSafe(path);
  if (raw === null) {
    return null;
  }
  return parseDoc(raw).sections;
}

/** 按节名读取（精确匹配）；节不存在返回 null（显式）。 */
export async function readSection(
  path: string,
  sectionName: string,
): Promise<DocSection | null> {
  const raw = await readFileSafe(path);
  if (raw === null) {
    return null;
  }
  const target = sectionName.trim();
  return parseDoc(raw).sections.find(s => s.section === target) ?? null;
}

/**
 * 追加内容到节尾：节存在 → 节正文末尾追加；节不存在 → 文件尾新建节。
 * 写后超 20KB 显式拒绝（不改文件）——模型应开新章/新文档。
 */
export async function appendSection(
  path: string,
  sectionName: string,
  content: string,
): Promise<DocWriteResult> {
  const clean = content.trim();
  if (!clean) {
    return {ok: false, error: 'EMPTY_CONTENT'};
  }
  const raw = (await readFileSafe(path)) ?? '';
  const doc = parseDoc(raw);
  const target = sectionName.trim();
  const existing = doc.sections.find(s => s.section === target);
  if (existing) {
    existing.content = existing.content
      ? `${existing.content}\n\n${clean}`
      : clean;
  } else {
    doc.sections.push({section: target, content: clean});
  }
  return writeChecked(path, rebuild(doc));
}

/**
 * 整节替换（标题保留）：框架文档修订（update_outline/update_persona）。
 * 节不存在 → 文件尾新建；空内容 → 删除该节。
 */
export async function updateSection(
  path: string,
  sectionName: string,
  content: string,
): Promise<DocWriteResult> {
  const raw = (await readFileSafe(path)) ?? '';
  const doc = parseDoc(raw);
  const target = sectionName.trim();
  const clean = content.trim();
  if (clean) {
    const existing = doc.sections.find(s => s.section === target);
    if (existing) {
      existing.content = clean;
    } else {
      doc.sections.push({section: target, content: clean});
    }
  } else {
    doc.sections = doc.sections.filter(s => s.section !== target);
  }
  return writeChecked(path, rebuild(doc));
}

async function writeChecked(
  path: string,
  next: string,
): Promise<DocWriteResult> {
  // Hermes 无 Node Buffer（真机实证 WRITE_FAILED: Property 'Buffer' doesn't exist）——
  // 用 TextEncoder 数 UTF-8 字节（RN 0.82 Hermes 内置，jest Node 亦可用）。
  const bytes = new TextEncoder().encode(next).length;
  if (bytes > MAX_DOC_BYTES) {
    return {ok: false, error: 'DOC_TOO_LARGE', bytes};
  }
  try {
    await RNFS.writeFile(path, next, 'utf8');
    return {ok: true, bytes};
  } catch (e) {
    return {
      ok: false,
      error: `WRITE_FAILED: ${(e as Error)?.message ?? 'unknown'}`,
    };
  }
}
