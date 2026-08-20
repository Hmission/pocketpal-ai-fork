/**
 * modelscope — ModelScope（魔搭）公开 API 适配层
 *
 * 2026-08-20 curl 实测确认：
 * - 详情：GET {MS}/api/v1/models/{repo} → 200，Data.ModelInfos.gguf 含
 *   architecture/chat_template（与 HF specs 同构）
 * - 文件列表：GET {MS}/api/v1/models/{repo}/repo/files?Revision=master&Recursive=true
 *   → 200，Data.Files[]（Name/Path/Size/IsLFS/Sha256）
 * - 下载：{MS}/models/{repo}/resolve/master/{file} → 200（与 HF resolve 同构）
 * - 全文搜索：无公开端点（dolphin/models、/api/v1/models?Name= 均 404）
 *   → 本层只做 repo id 直达（粘贴/输入），不做爬虫（锋利边界）。
 *
 * 响应直接映射 HuggingFaceModel/ModelFile 结构，复用现有下载链路
 * （downloadHFModel 的 modelFile.url 即 ModelScope resolve URL）。
 */

import axios from 'axios';

import {MODELSCOPE_DOMAIN} from '../utils/downloadSources';
import {GGUFSpecs, HuggingFaceModel, ModelFile} from '../utils/types';

const MS_API_BASE = `${MODELSCOPE_DOMAIN}/api/v1`;

const USER_AGENT = 'PocketChick/2.0';

/** 详情接口响应中的模型元数据（仅声明本层用到的字段） */
interface ModelScopeDetailData {
  ChineseName?: string;
  Downloads?: number;
  LastUpdatedTime?: number;
  CreatedTime?: number;
  Libraries?: string[];
  License?: string;
  ModelInfos?: {
    gguf?: {
      architecture?: string;
      chat_template?: string;
      total?: number;
      [key: string]: unknown;
    };
  };
}

/** 文件列表接口响应中的文件条目 */
interface ModelScopeRepoFile {
  Name: string;
  Path?: string;
  Size?: number;
  IsLFS?: boolean;
  Sha256?: string;
  Type?: string;
}

interface ModelScopeListResponse {
  Code: number;
  Data?: {
    Files?: ModelScopeRepoFile[];
  };
}

interface ModelScopeDetailResponse {
  Code: number;
  Data?: ModelScopeDetailData;
}

/** 校验 repo id 形如 author/repo（不合法直接拒绝，防路径注入） */
export function isValidModelScopeRepoId(repoId: string): boolean {
  const parts = repoId.trim().split('/');
  return (
    parts.length === 2 &&
    parts.every(p => p.length > 0 && !p.includes(' ') && !p.includes('..'))
  );
}

/** 拉取模型详情并映射为 HuggingFaceModel（siblings 由文件列表接口填充） */
export async function fetchModelDetail(
  repoId: string,
): Promise<HuggingFaceModel> {
  const repo = repoId.trim();
  if (!isValidModelScopeRepoId(repo)) {
    throw new Error(`Invalid ModelScope repo id: ${repoId}`);
  }
  const {data} = await axios.get<ModelScopeDetailResponse>(
    `${MS_API_BASE}/models/${repo}`,
    {headers: {'User-Agent': USER_AGENT}},
  );
  const d = data?.Data;
  const gguf = d?.ModelInfos?.gguf;
  const siblings = await fetchRepoFiles(repo);
  const specs: GGUFSpecs | undefined = gguf
    ? {
        _id: repo,
        id: repo,
        gguf: {
          total: gguf.total ?? 0,
          architecture: gguf.architecture ?? '',
          context_length: 0,
          chat_template: gguf.chat_template,
        },
      }
    : undefined;
  const hfModel: HuggingFaceModel = {
    _id: repo,
    id: repo,
    author: repo.split('/')[0],
    gated: false,
    inference: 'cold',
    lastModified: d?.LastUpdatedTime
      ? new Date(d.LastUpdatedTime * 1000).toISOString()
      : new Date().toISOString(),
    likes: 0,
    trendingScore: 0,
    private: false,
    sha: '',
    downloads: d?.Downloads ?? 0,
    tags: [],
    library_name: d?.Libraries?.[0] ?? '',
    createdAt: d?.CreatedTime
      ? new Date(d.CreatedTime * 1000).toISOString()
      : new Date().toISOString(),
    model_id: repo,
    url: `${MODELSCOPE_DOMAIN}/models/${repo}`,
    specs,
    siblings,
  };
  return hfModel;
}

/** 拉取 repo 文件列表并映射为 ModelFile[]（resolve URL 直通下载） */
export async function fetchRepoFiles(repoId: string): Promise<ModelFile[]> {
  const repo = repoId.trim();
  if (!isValidModelScopeRepoId(repo)) {
    throw new Error(`Invalid ModelScope repo id: ${repoId}`);
  }
  const {data} = await axios.get<ModelScopeListResponse>(
    `${MS_API_BASE}/models/${repo}/repo/files`,
    {
      params: {Revision: 'master', Recursive: true, Root: ''},
      headers: {'User-Agent': USER_AGENT},
    },
  );
  const files = data?.Data?.Files ?? [];
  return files.map(f => {
    const path = f.Path || f.Name;
    return {
      rfilename: path,
      size: f.Size ?? 0,
      url: `${MODELSCOPE_DOMAIN}/models/${repo}/resolve/master/${path}`,
      oid: f.Sha256,
      lfs: f.IsLFS
        ? {oid: f.Sha256 ?? '', size: f.Size ?? 0, pointerSize: 0}
        : undefined,
    };
  });
}
