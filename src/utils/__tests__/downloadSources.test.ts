import {
  DownloadSource,
  fileRemotePath,
  fileRepoForSource,
  getAvailableSources,
  repoForSource,
  resolveDownloadUrl,
  resolveFileDownloadUrl,
  resolveFileSource,
} from '../downloadSources';

describe('downloadSources — 双源 URL 构造', () => {
  it('HF resolve 模板（main 分支）', () => {
    expect(resolveDownloadUrl('a/b', 'm.gguf', 'hf')).toBe(
      'https://huggingface.co/a/b/resolve/main/m.gguf',
    );
  });

  it('ModelScope resolve 模板（master 分支）', () => {
    expect(resolveDownloadUrl('a/b', 'm.gguf', 'modelscope')).toBe(
      'https://modelscope.cn/models/a/b/resolve/master/m.gguf',
    );
  });

  it('文件名含子路径时保持原样拼接', () => {
    expect(resolveDownloadUrl('a/b', 'sub/m.gguf', 'hf')).toBe(
      'https://huggingface.co/a/b/resolve/main/sub/m.gguf',
    );
  });

  it('getAvailableSources：按显式声明 + repo 存在性过滤', () => {
    expect(getAvailableSources({sources: ['hf'], hfRepo: 'a/b'})).toEqual([
      'hf',
    ]);
    // 声明了 modelscope 但无 modelscopeRepo → 剔除（防死按钮）
    expect(
      getAvailableSources({sources: ['hf', 'modelscope'], hfRepo: 'a/b'}),
    ).toEqual(['hf']);
    expect(
      getAvailableSources({
        sources: ['hf', 'modelscope'],
        hfRepo: 'a/b',
        modelscopeRepo: 'a/b',
      }),
    ).toEqual(['hf', 'modelscope']);
    expect(getAvailableSources({sources: []})).toEqual([]);
  });

  it('repoForSource：按源返回对应 repo', () => {
    const entry = {hfRepo: 'x/y', modelscopeRepo: 'x/y-ms'};
    expect(repoForSource(entry, 'hf' as DownloadSource)).toBe('x/y');
    expect(repoForSource(entry, 'modelscope' as DownloadSource)).toBe('x/y-ms');
  });

  it('fileRemotePath：默认本地名；remotePath 与 per-source 覆盖', () => {
    const plain = {name: 'm.gguf'};
    expect(fileRemotePath(plain, 'hf' as DownloadSource)).toBe('m.gguf');
    const renamed = {
      name: 'local.gguf',
      remotePath: 'remote/rename.gguf',
    };
    expect(fileRemotePath(renamed, 'hf' as DownloadSource)).toBe(
      'remote/rename.gguf',
    );
    const perSource = {
      name: 'local.gguf',
      remotePath: 'remote/rename.gguf',
      remotePathBySource: {hf: 'hf-only.gguf'},
    };
    expect(fileRemotePath(perSource, 'hf' as DownloadSource)).toBe(
      'hf-only.gguf',
    );
    expect(fileRemotePath(perSource, 'modelscope' as DownloadSource)).toBe(
      'remote/rename.gguf',
    );
  });

  it('fileRepoForSource：per-file 覆盖 > 条目级', () => {
    const entry = {hfRepo: 'a/b', modelscopeRepo: 'a/b-ms'};
    const plain = {name: 'm.gguf'};
    expect(fileRepoForSource(plain, entry, 'hf' as DownloadSource)).toBe('a/b');
    expect(
      fileRepoForSource(plain, entry, 'modelscope' as DownloadSource),
    ).toBe('a/b-ms');
    const cross = {
      name: 'clip.safetensors',
      repoBySource: {hf: 'c/d-fp8'},
    };
    expect(fileRepoForSource(cross, entry, 'hf' as DownloadSource)).toBe(
      'c/d-fp8',
    );
    // 声明过 repoBySource 但未覆盖的源 = 该源无此文件（防跨仓错误回退）
    expect(
      fileRepoForSource(cross, entry, 'modelscope' as DownloadSource),
    ).toBeUndefined();
    // 单源文件在另一源无 repo
    const single = {name: 'z.gguf', repoBySource: {modelscope: 'u/v'}};
    expect(fileRepoForSource(single, entry, 'hf' as DownloadSource)).toBe(
      undefined,
    );
  });

  it('resolveFileSource：preferred 源缺失自动回退其余可用源', () => {
    const entry = {
      sources: ['hf', 'modelscope'] as DownloadSource[],
      hfRepo: 'a/b',
      modelscopeRepo: 'a/b-ms',
    };
    const plain = {name: 'm.gguf'};
    expect(resolveFileSource(plain, entry, 'hf' as DownloadSource)).toEqual({
      source: 'hf',
      repo: 'a/b',
    });
    // zimage_llm 场景：只有魔搭 repo，首选 HF → 回退魔搭
    const msOnly = {name: 'z.gguf', repoBySource: {modelscope: 'u/v'}};
    expect(resolveFileSource(msOnly, entry, 'hf' as DownloadSource)).toEqual({
      source: 'modelscope',
      repo: 'u/v',
    });
    // 全无 repo → null（不抛错）
    expect(
      resolveFileSource(plain, {sources: []}, 'hf' as DownloadSource),
    ).toBeNull();
  });

  it('resolveFileDownloadUrl：远程路径 + per-file repo 组合', () => {
    const entry = {hfRepo: 'a/b', modelscopeRepo: 'a/b-ms'};
    const file = {
      name: 'clip_l.safetensors',
      remotePath: 'text_encoders/clip_l.safetensors',
      repoBySource: {modelscope: 'AI-ModelScope/sd35-fp8'},
    };
    expect(
      resolveFileDownloadUrl(file, entry, 'modelscope' as DownloadSource),
    ).toBe(
      'https://modelscope.cn/models/AI-ModelScope/sd35-fp8/resolve/master/text_encoders/clip_l.safetensors',
    );
    // 该源无 repo → undefined
    expect(
      resolveFileDownloadUrl(
        {name: 'z.gguf', repoBySource: {modelscope: 'u/v'}},
        entry,
        'hf' as DownloadSource,
      ),
    ).toBeUndefined();
  });
});
