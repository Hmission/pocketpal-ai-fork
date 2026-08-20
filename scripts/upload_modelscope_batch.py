"""
批量上传模型到 ModelScope（2026-08-20 · zensignGG 账号）

覆盖 catalog 中魔搭无镜像的全部模型：
  1. Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-GGUF（Q8_0 + mmproj）
  2. Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-GGUF（Q4_K_M + mmproj）
  3. MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF（管家）
  4. DreamLite-mobile-ONNX（端侧生图引擎套件 6 文件）

文件命名 = catalog 本地落盘名（modelscope 源 remotePath 走默认 name，无需映射）；
README 注明原始出处与 license（第三方模型以原仓为准）。

用法：
  python scripts/upload_modelscope_batch.py            # token 从 .env MODELSCOPE_TOKEN
"""
import sys
from pathlib import Path

from modelscope.hub.api import HubApi

ROOT = Path(__file__).resolve().parent.parent

ENV = ROOT / '.env'

# 字节数与 catalog modelCatalog.ts 精确一致
REPOS = [
    {
        'repo': 'zensignGG/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-GGUF',
        'files': [
            (Path('F:/Cursor/OneTakeMVP/models/pocketpal_hf/HauhauCS__Qwen3.5-2B-Uncensored-HauhauCS-Aggressive/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf'),
             'Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf', 2012012000),
            (Path('F:/Cursor/OneTakeMVP/models/pocketpal_hf/HauhauCS__Qwen3.5-2B-Uncensored-HauhauCS-Aggressive/mmproj-Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-f16.gguf'),
             'mmproj-Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-f16.gguf', 668226688),
        ],
        'readme': (
            '# Qwen3.5-2B-Uncensored-HauhauCS-Aggressive（GGUF）\n\n'
            '镜像自 Hugging Face `HauhauCS/Qwen3.5-2B-Uncensored-HauhauCS-Aggressive`，'
            '供 Pocket Chick（小黄鸡）端侧离线推理使用。文件与 HF 原仓逐字节一致。\n\n'
            '## 文件\n'
            '- `Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf`：主模型（Q8_0）\n'
            '- `mmproj-Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-f16.gguf`：视觉投影器（mmproj）\n\n'
            '## License\n'
            '以 HF 原仓声明为准（第三方模型，本仓库仅镜像分发）。\n'
        ),
    },
    {
        'repo': 'zensignGG/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-GGUF',
        'files': [
            (Path('F:/Cursor/OneTakeMVP/models/pocketpal_hf/HauhauCS__Qwen3.5-4B-Uncensored-HauhauCS-Aggressive/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf'),
             'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf', 2707513696),
            (Path('F:/Cursor/OneTakeMVP/models/pocketpal_hf/HauhauCS__Qwen3.5-4B-Uncensored-HauhauCS-Aggressive/mmproj-Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-BF16.gguf'),
             'mmproj-Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-BF16.gguf', 675568768),
        ],
        'readme': (
            '# Qwen3.5-4B-Uncensored-HauhauCS-Aggressive（GGUF）\n\n'
            '镜像自 Hugging Face `HauhauCS/Qwen3.5-4B-Uncensored-HauhauCS-Aggressive`，'
            '供 Pocket Chick（小黄鸡）端侧离线推理使用。文件与 HF 原仓逐字节一致。\n\n'
            '## 文件\n'
            '- `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf`：主模型（Q4_K_M）\n'
            '- `mmproj-Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-BF16.gguf`：视觉投影器（mmproj）\n\n'
            '## License\n'
            '以 HF 原仓声明为准（第三方模型，本仓库仅镜像分发）。\n'
        ),
    },
    {
        'repo': 'zensignGG/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF',
        'files': [
            (ROOT / '.tmp/models_sd/minicpm5_1b_heretic_q4km.gguf',
             'minicpm5_1b_heretic_q4km.gguf', 688066528),
        ],
        'readme': (
            '# MiniCPM5-1B Claude Opus Fable5 V2 Thinking heretic（GGUF）\n\n'
            '镜像自 Hugging Face `mradermacher/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF`，'
            '供 Pocket Chick（小黄鸡）常驻管家角色使用。文件与本地部署版同源（Q4_K_M）。\n\n'
            '## 文件\n'
            '- `minicpm5_1b_heretic_q4km.gguf`：主模型（Q4_K_M，本地落盘名）\n\n'
            '## License\n'
            'Apache-2.0（原仓 mradermacher 声明，2026-08-20 GGUF 头部元数据核实）。\n'
        ),
    },
    {
        'repo': 'zensignGG/DreamLite-mobile-ONNX',
        'files': [
            (ROOT / '.tmp/dreamlite/onnx/unet_masked.onnx', 'unet_masked.onnx', 1561735173),
            (ROOT / '.tmp/dreamlite/onnx/vae_decoder.onnx', 'vae_decoder.onnx', 4912510),
            (ROOT / '.tmp/dreamlite/onnx/vae_encoder.onnx', 'vae_encoder.onnx', 4910603),
            (ROOT / '.tmp/dreamlite/te/te_q8.gguf', 'te_q8.gguf', 1834427328),
            (ROOT / '.tmp/dreamlite/onnx/te_fp16.onnx', 'te_fp16.onnx', 5069907),
            (ROOT / '.tmp/dreamlite/onnx/te_fp16.onnx.data', 'te_fp16.onnx.data', 3441164288),
        ],
        'readme': (
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
        ),
    },
]


def load_env() -> dict:
    vals: dict = {}
    for line in ENV.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            vals[key.strip()] = value.strip()
    return vals


def main() -> None:
    env = load_env()
    token = env.get('MODELSCOPE_TOKEN')
    if not token:
        sys.exit('缺少 MODELSCOPE_TOKEN（.env）')

    api = HubApi(token=token)
    try:
        api.login()
    except Exception as e:
        sys.exit(f'token 无效: {str(e)[:200]}')
    print('[i] token 验证通过')

    for spec in REPOS:
        repo = spec['repo']
        print(f'\n===== {repo} =====', flush=True)
        api.create_repo(repo, token=token, visibility='public', repo_type='model',
                        exist_ok=True, create_default_config=False)
        for path, name, size in spec['files']:
            actual = path.stat().st_size if path.exists() else -1
            if actual != size:
                sys.exit(f'字节数不符 {name}: 期望 {size} 实际 {actual}——终止')
            print(f'[i] 上传 {name} ({actual / 1e9:.2f} GB) ...', flush=True)
            api.upload_file(path_or_fileobj=str(path), path_in_repo=name,
                            repo_id=repo, token=token, repo_type='model')
            print(f'[+] {name} 完成', flush=True)
        api.upload_file(path_or_fileobj=spec['readme'].encode('utf-8'),
                        path_in_repo='README.md', repo_id=repo, token=token,
                        repo_type='model')
        print(f'[+] README 完成: https://www.modelscope.cn/models/{repo}', flush=True)

    print('\n全部完成')


if __name__ == '__main__':
    main()
