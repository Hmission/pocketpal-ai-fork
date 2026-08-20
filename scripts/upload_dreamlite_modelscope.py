"""
DreamLite ONNX 套件上传 ModelScope（§56.5/§57.5 遗留项 · 魔搭通道）

用途：将本地导出的 DreamLite ONNX 套件（6 文件）上传到魔搭模型仓库，
      上传成功后把脚本末尾打印的 catalog 补行写入 src/utils/modelCatalog.ts，
      DreamLite 条目即从「请本地导入」转为在线可下载。

前置：
  - 魔搭 SDK Token：登录 modelscope.cn → 头像 → 个人中心 → 访问令牌 →
    创建/复制 SDK token；填入 .env 的 MODELSCOPE_TOKEN（或 --token 参数）。
  - repo 命名空间 = 魔搭用户名（登录后可见），用 --repo 指定完整 model_id。

用法：
  python scripts/upload_dreamlite_modelscope.py --repo <user>/DreamLite-mobile-onnx
  python scripts/upload_dreamlite_modelscope.py --repo <user>/DreamLite-mobile-onnx --token hf_xxx
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / '.env'

# 套件文件清单（本地路径 → catalog 落盘名 → 字节数，与 modelCatalog.ts 一致）
FILES = [
    (ROOT / '.tmp/dreamlite/onnx/unet_masked.onnx', 'unet_masked.onnx', 1561735173),
    (ROOT / '.tmp/dreamlite/onnx/vae_decoder.onnx', 'vae_decoder.onnx', 4912510),
    (ROOT / '.tmp/dreamlite/onnx/vae_encoder.onnx', 'vae_encoder.onnx', 4910603),
    (ROOT / '.tmp/dreamlite/te/te_q8.gguf', 'te_q8.gguf', 1834427328),
    (ROOT / '.tmp/dreamlite/onnx/te_fp16.onnx', 'te_fp16.onnx', 5069907),
    (ROOT / '.tmp/dreamlite/onnx/te_fp16.onnx.data', 'te_fp16.onnx.data', 3441164288),
]

README = (
    '# DreamLite Mobile ONNX（Pocket Chick 端侧生图引擎套件）\n\n'
    '自制 ONNX 导出套件（DMD2 蒸馏 4 步，无 CFG），供 Pocket Chick（小黄鸡）端侧 '
    'ONNX Runtime 引擎加载。原始权重（safetensors）来自 carlofkl/DreamLite-mobile。\n\n'
    '## 文件用途\n'
    '- `unet_masked.onnx`：UNet 主网络（masked 条件，输入 `cat([latents, cond], dim=3)`）\n'
    '- `te_fp16.onnx` + `te_fp16.onnx.data`：文本编码器（ONNX external data）\n'
    '- `te_q8.gguf`：文本编码器 GGUF 量化版（llama.rn tokenizer + 嵌入）\n'
    '- `vae_decoder.onnx` / `vae_encoder.onnx`：VAE 解码/编码（NCHW 输出）\n\n'
    '## 采样契约\n'
    '- 步数：4（DMD2 蒸馏点）；Guidance Scale 无效（蒸馏进模型）\n'
    '- 任务前缀：`[Generate]: ` / `[Edit]: `；模板前缀 drop 34 token；max_sequence_length=200\n'
    '- scaling_factor=1.0；mu-shifted flow matching（`sigma = linspace(1, 1/steps, steps)`）\n'
)


def load_env() -> dict:
    vals: dict = {}
    for line in ENV.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            vals[key.strip()] = value.strip()
    return vals


def verify_files() -> None:
    """上传前逐文件校验存在性与字节数（与 catalog 精确匹配，防传错版本）"""
    for path, name, size in FILES:
        if not path.exists():
            sys.exit(f'缺文件: {path}')
        actual = path.stat().st_size
        if actual != size:
            sys.exit(f'字节数不符 {name}: 期望 {size} 实际 {actual}——先核对版本再传')


def print_catalog_snippet(repo: str) -> None:
    print('\n===== 上传成功，catalog 补行（写入 modelCatalog.ts dreamlite 条目）=====')
    print(f"sources: ['hf', 'modelscope'],")
    print(f"modelscopeRepo: '{repo}',")
    for _, name, size in FILES:
        print(f"# {name}  {size} 字节")
    print('注释同步：删除「保持请本地导入」表述，更新 MASTER_LOG §56.5/§57.5')


def main() -> None:
    args = sys.argv[1:]
    repo = None
    token = None
    i = 0
    while i < len(args):
        if args[i] == '--repo' and i + 1 < len(args):
            repo = args[i + 1]
            i += 2
        elif args[i] == '--token' and i + 1 < len(args):
            token = args[i + 1]
            i += 2
        else:
            sys.exit(f'未知参数: {args[i]}（用法见文件头）')
    if not repo:
        sys.exit('必须指定 --repo <user>/<repo>（魔搭用户名 + 仓库名）')

    env = load_env()
    token = token or os.environ.get('MODELSCOPE_TOKEN') or env.get('MODELSCOPE_TOKEN')
    if not token:
        sys.exit('缺少魔搭 SDK Token：网页登录后「个人中心 → 访问令牌」创建，填入 .env 的 MODELSCOPE_TOKEN 或 --token')

    verify_files()
    print('[i] 6 文件校验通过')

    from modelscope.hub.api import HubApi

    api = HubApi(token=token)
    print(f'[i] 创建/确认仓库: {repo} ...')
    api.create_repo(repo, token=token, visibility='public', repo_type='model', exist_ok=True, create_default_config=False)
    print(f'[i] 仓库就绪: https://www.modelscope.cn/models/{repo}')

    # 逐文件上传（大文件走 OSS 分片）
    for path, name, _ in FILES:
        print(f'[i] 上传 {name} ({path.stat().st_size / 1e9:.2f} GB) ...', flush=True)
        api.upload_file(
            path_or_fileobj=str(path),
            path_in_repo=name,
            repo_id=repo,
            token=token,
            repo_type='model',
        )
        print(f'[+] {name} 完成', flush=True)

    # README 说明
    print('[i] 上传 README.md ...', flush=True)
    api.upload_file(
        path_or_fileobj=README.encode('utf-8'),
        path_in_repo='README.md',
        repo_id=repo,
        token=token,
        repo_type='model',
    )

    print_catalog_snippet(repo)
    print(f'\n完成: https://www.modelscope.cn/models/{repo}')


if __name__ == '__main__':
    main()
