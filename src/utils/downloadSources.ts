/**
 * downloadSources — 下载源 URL 构造与可用性判定（HF / ModelScope 双源）
 *
 * - HF：        https://huggingface.co/{repo}/resolve/main/{filename}
 * - ModelScope：https://modelscope.cn/models/{repo}/resolve/master/{filename}
 *   （2026-08-20 实测：resolve 直通 200，与 HF 同构；ModelScope 下载恒不带
 *   token——私有模型不在支持范围，DownloadManager 的 HF token 守卫天然覆盖）
 *
 * 源声明策略：模型条目显式声明 sources（modelCatalog），未声明 = 无在线源。
 */

export type DownloadSource = 'hf' | 'modelscope';

export const HF_DOMAIN = 'https://huggingface.co';
export const MODELSCOPE_DOMAIN = 'https://modelscope.cn';

/** 按源构造确定性下载 URL（repo id 不含源域名） */
export function resolveDownloadUrl(
  repo: string,
  filename: string,
  source: DownloadSource,
): string {
  switch (source) {
    case 'hf':
      return `${HF_DOMAIN}/${repo}/resolve/main/${filename}`;
    case 'modelscope':
      return `${MODELSCOPE_DOMAIN}/models/${repo}/resolve/master/${filename}`;
  }
}

/** 条目可用源列表（按条目显式声明；无 repo 的源自动剔除，防止死按钮） */
export function getAvailableSources(entry: {
  sources: DownloadSource[];
  hfRepo?: string;
  modelscopeRepo?: string;
}): DownloadSource[] {
  return entry.sources.filter(source => {
    if (source === 'hf') {
      return !!entry.hfRepo;
    }
    if (source === 'modelscope') {
      return !!entry.modelscopeRepo;
    }
    return false;
  });
}

/** 条目在某源下的 repo id（无则返回 undefined） */
export function repoForSource(
  entry: {hfRepo?: string; modelscopeRepo?: string},
  source: DownloadSource,
): string | undefined {
  return source === 'hf' ? entry.hfRepo : entry.modelscopeRepo;
}

/** 文件级源信息（结构化类型，避免与 modelCatalog 循环依赖） */
export interface CatalogFileSourceInfo {
  name: string;
  remotePath?: string;
  remotePathBySource?: Partial<Record<DownloadSource, string>>;
  repoBySource?: Partial<Record<DownloadSource, string>>;
}

/** 文件在某源下的远程相对路径（默认 = 本地名；跨仓子目录/改名用） */
export function fileRemotePath(
  file: CatalogFileSourceInfo,
  source: DownloadSource,
): string {
  return (
    file.remotePathBySource?.[source] ??
    file.remotePath ??
    file.name
  );
}

/**
 * 文件在某源下的 repo：per-file 显式声明优先。声明过 repoBySource 的文件
 * 只认声明内的源（未声明 = 该源无此文件，防跨仓错误回退——如 zimage_llm
 * 声明仅魔搭，HF 源必须返回 undefined 以触发 resolveFileSource 回退，而
 * 不是错误回退条目级 leejet repo）；未声明过则回退条目级 repo。
 */
export function fileRepoForSource(
  file: CatalogFileSourceInfo,
  entry: {hfRepo?: string; modelscopeRepo?: string},
  source: DownloadSource,
): string | undefined {
  if (file.repoBySource) {
    return file.repoBySource[source];
  }
  return repoForSource(entry, source);
}

/**
 * 文件实际下载源与 repo 解析：优先 preferred 源；该文件在 preferred 源无
 * repo 时回退到条目其余可用源（跨仓套件单源缺失自动兜底，不抛错不静默
 * 跳过——Z-Image 选 HF 时 zimage_llm 自动走魔搭）。
 */
export function resolveFileSource(
  file: CatalogFileSourceInfo,
  entry: {
    sources: DownloadSource[];
    hfRepo?: string;
    modelscopeRepo?: string;
  },
  preferred: DownloadSource,
): {source: DownloadSource; repo: string} | null {
  const ordered = [
    preferred,
    ...getAvailableSources(entry).filter(s => s !== preferred),
  ];
  for (const source of ordered) {
    const repo = fileRepoForSource(file, entry, source);
    if (repo) {
      return {source, repo};
    }
  }
  return null;
}

/** 文件在某源下的完整下载 URL（无 repo 返回 undefined） */
export function resolveFileDownloadUrl(
  file: CatalogFileSourceInfo,
  entry: {hfRepo?: string; modelscopeRepo?: string},
  source: DownloadSource,
): string | undefined {
  const repo = fileRepoForSource(file, entry, source);
  if (!repo) {
    return undefined;
  }
  return resolveDownloadUrl(repo, fileRemotePath(file, source), source);
}
