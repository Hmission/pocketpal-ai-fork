/**
 * 产物工作区——目录 + 索引协议（WORKSPACE_SPEC v1，2026-08-21）
 *
 * 三模式同构底座：写作/冒险/玩具的产物都遵循「文件即存档」——
 * JS 层零业务逻辑，模型经 TalentEngine 工具维护文档，本服务只提供
 * 目录协议与索引协议两个原语。
 *
 * 目录协议：workspace/<domain>/<project>/ 下分文档文件（大纲.md、
 * 人设.md、正文-<章节>.md / 世界设定.md、角色卡.md、剧情.md），
 * 单文件 ≤20KB（docStore），超限开新文件 = 天然分段。
 * 索引协议：每域 index.json = [{name, path, updatedAt, progress}]，
 * 写后 touchProject 置顶（与 toyChest upsert 同语义）。
 *
 * 域清单：writing（AIOS_WRITING_DIR）/ adventure（AIOS_ADVENTURE_DIR）；
 * toys 为既有单层索引（toyChest），不走本协议（消费端 read_html/玩具箱直读）。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_WRITING_DIR, AIOS_ADVENTURE_DIR} from '../../utils/paths';

export type ProjectDomain = 'writing' | 'adventure';

export interface WorkspaceProject {
  /** 项目名（目录名，已 sanitize） */
  name: string;
  /** 相对域根的路径（name 即目录名） */
  path: string;
  /** 最近一次写入时间（touchProject 刷新） */
  updatedAt: number;
  /** 进度一句话（模型自报，如「已完成 3 章 / 2.1 万字」） */
  progress?: string;
}

const DOMAIN_ROOTS: Record<ProjectDomain, string> = {
  writing: AIOS_WRITING_DIR,
  adventure: AIOS_ADVENTURE_DIR,
};

/** 项目名 sanitize：去路径分隔符与危险字符，空白折叠；空名返回 null。 */
export function sanitizeProjectName(raw: string): string | null {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned : null;
}

export function domainRoot(domain: ProjectDomain): string {
  return DOMAIN_ROOTS[domain];
}

function indexFile(domain: ProjectDomain): string {
  return `${domainRoot(domain)}/index.json`;
}

async function readIndex(
  domain: ProjectDomain,
): Promise<WorkspaceProject[]> {
  try {
    if (!(await RNFS.exists(indexFile(domain)))) {
      return [];
    }
    const raw = await RNFS.readFile(indexFile(domain), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(
  domain: ProjectDomain,
  entries: WorkspaceProject[],
): Promise<void> {
  await RNFS.writeFile(indexFile(domain), JSON.stringify(entries, null, 2), 'utf8');
}

/** 项目目录绝对路径（入参须已 sanitize）。 */
export function projectDir(domain: ProjectDomain, name: string): string {
  return `${domainRoot(domain)}/${name}`;
}

/**
 * 项目索引读取（恢复入口）：新会话「继续写 X」凭 name 查目录。
 * 索引存储即最新在前（touchProject 置顶），直接返回；
 * 文件缺失/损坏返回 []（不静默抛错）。
 */
export async function listProjects(
  domain: ProjectDomain,
): Promise<WorkspaceProject[]> {
  return readIndex(domain);
}

/**
 * 写后置顶：项目存在则刷新 updatedAt（可选更新 progress），
 * 不存在则新建条目。与 toyChest「title 即身份」同语义。
 */
export async function touchProject(
  domain: ProjectDomain,
  name: string,
  progress?: string,
): Promise<WorkspaceProject | null> {
  const clean = sanitizeProjectName(name);
  if (!clean) {
    return null;
  }
  const entries = await readIndex(domain);
  const existing = entries.find(e => e.name === clean);
  const entry: WorkspaceProject = {
    name: clean,
    path: clean,
    updatedAt: Date.now(),
    progress: progress ?? existing?.progress,
  };
  const rest = entries.filter(e => e.name !== clean);
  await writeIndex(domain, [entry, ...rest]);
  return entry;
}

/**
 * 建项目：目录 + 索引条目一次到位（幂等：已存在只 touch）。
 * 返回项目目录绝对路径；名非法返回 null（显式失败不静默）。
 */
export async function ensureProject(
  domain: ProjectDomain,
  name: string,
  progress?: string,
): Promise<string | null> {
  const clean = sanitizeProjectName(name);
  if (!clean) {
    return null;
  }
  const dir = projectDir(domain, clean);
  if (!(await RNFS.exists(dir))) {
    await RNFS.mkdir(dir);
  }
  await touchProject(domain, clean, progress);
  return dir;
}

/** 按名查项目（恢复判定）；未命中返回 null。 */
export async function findProject(
  domain: ProjectDomain,
  name: string,
): Promise<WorkspaceProject | null> {
  const clean = sanitizeProjectName(name);
  if (!clean) {
    return null;
  }
  const entries = await readIndex(domain);
  return entries.find(e => e.name === clean) ?? null;
}
