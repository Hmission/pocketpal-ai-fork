"""
DreamLite ONNX 套件上传 Hugging Face（§56.5/§57.5 遗留项执行脚本）

用途：将本地导出的 DreamLite ONNX 套件（6 文件）上传到 HF 仓库，
      上传成功后把脚本末尾打印的 catalog 补行写入 src/utils/modelCatalog.ts，
      DreamLite 条目即从「请本地导入」转为在线可下载。

前置：
  - HF token：环境变量 HF_TOKEN 优先；否则自动读本机 HF 缓存 token
    （C:/Users/<user>/.cache/huggingface/token）。
    HF 已废弃账号密码 API 登录（POST /api/login 404），.env 的 HF_PASSWORD
    仅作登记留档，不作为认证通道。
  - 网络可达 huggingface.co（本机实测 curl 000 但 python requests 200，
    双栈差异——本脚本走 python，上传通道已验证）。

用法：
  python scripts/upload_dreamlite_onnx.py
  python scripts/upload_dreamlite_onnx.py --repo i1010111/DreamLite-mobile-onnx
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

DEFAULT_REPO = 'i1010111/DreamLite-mobile-onnx'


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
    print(f"sources: ['hf'],")
    print(f"hfRepo: '{repo}',")
    for _, name, size in FILES:
        print(f"# {name}  {size} 字节")
    print('注释同步：删除「保持请本地导入」表述，更新 MASTER_LOG §56.5/§57.5')


def main() -> None:
    repo = DEFAULT_REPO
    args = sys.argv[1:]
    if args and args[0] == '--repo' and len(args) > 1:
        repo = args[1]

    verify_files()
    print('[i] 6 文件校验通过')

    from huggingface_hub import HfApi

    token = os.environ.get('HF_TOKEN')
    api = HfApi(token=token) if token else HfApi()  # 无 HF_TOKEN 时自动读本机缓存 token
    try:
        user = api.whoami().get('name')
    except Exception as e:
        sys.exit(f'HF 认证失败（需 HF_TOKEN 或有效本机缓存 token）: {str(e)[:200]}')
    print(f'[i] 认证用户: {user}')

    api.create_repo(repo_id=repo, repo_type='model', exist_ok=True)
    print(f'[i] 仓库就绪: https://huggingface.co/{repo}')

    # 逐文件上传（大文件自动走 LFS 分片，含 .onnx.data external data）
    for path, name, _ in FILES:
        print(f'[i] 上传 {name} ({path.stat().st_size / 1e9:.2f} GB) ...', flush=True)
        api.upload_file(
            path_or_fileobj=str(path),
            path_in_repo=name,
            repo_id=repo,
            repo_type='model',
        )
        print(f'[+] {name} 完成', flush=True)

    # README 说明（模型来源 + 引擎契约 + 文件用途）
    readme = (
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
    api.upload_file(
        path_or_fileobj=readme.encode('utf-8'),
        path_in_repo='README.md',
        repo_id=repo,
        repo_type='model',
    )

    print_catalog_snippet(repo)
    print(f'\n完成: https://huggingface.co/{repo}')


if __name__ == '__main__':
    main()
