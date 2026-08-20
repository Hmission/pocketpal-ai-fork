"""
上传自制模型到 Hugging Face（2026-08-20 · QDD110 账号，WRITE token）

覆盖自制件 HF 分发：
  1. QDD110/SD35-HumanPose-LoRA：lora_humanpose.safetensors（83MB，魔搭已传同仓）
  2. QDD110/DreamLite-mobile-ONNX：6 文件 8.4GB（魔搭已传同仓）

文件名 = catalog 本地落盘名（HF 侧 remotePath 默认 name，无需映射）；
README 注明自制配方与魔搭镜像仓。

用法：
  python scripts/upload_hf_batch.py            # token 从 .env HF_TOKEN
"""
import sys
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / '.env'

# 字节数与 catalog modelCatalog.ts 精确一致
REPOS = [
    {
        'repo': 'QDD110/SD35-HumanPose-LoRA',
        'files': [
            (ROOT / '.tmp/lora_humanpose.safetensors',
             'lora_humanpose.safetensors', 83138888),
        ],
        'readme': (
            '# SD3.5 Medium HumanPose LoRA（自制）\n\n'
            '自制 LoRA 权重（人体姿态增强，multiplier=2.0），供 Pocket Chick（小黄鸡）端侧 SD3.5 '
            '独立 LoRA 运行时挂载使用（生图页开关控制，默认关=纯 base）。\n\n'
            '## 文件\n'
            '- `lora_humanpose.safetensors`：LoRA 权重（83,138,888 字节）\n\n'
            '## 镜像\n'
            '魔搭镜像：https://www.modelscope.cn/models/zensignGG/SD35-HumanPose-LoRA\n\n'
            '## License\n'
            '自制训练产物（训练基座 SD3.5 以原仓 license 为准）。\n'
        ),
    },
    {
        'repo': 'QDD110/DreamLite-mobile-ONNX',
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
            '## 镜像\n'
            '魔搭镜像：https://www.modelscope.cn/models/zensignGG/DreamLite-mobile-ONNX\n\n'
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
    token = env.get('HF_TOKEN')
    if not token:
        sys.exit('缺少 HF_TOKEN（.env）')

    api = HfApi(token=token)
    who = api.whoami()
    print(f'[i] token 验证通过: {who["name"]} (write)', flush=True)

    for spec in REPOS:
        repo = spec['repo']
        print(f'\n===== {repo} =====', flush=True)
        api.create_repo(repo_id=repo, token=token, repo_type='model',
                        exist_ok=True, private=False)
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
        print(f'[+] README 完成: https://huggingface.co/{repo}', flush=True)

    print('\n全部完成')


if __name__ == '__main__':
    main()
