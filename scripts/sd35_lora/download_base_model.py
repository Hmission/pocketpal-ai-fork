# -*- coding: utf-8 -*-
"""
download_base_model.py — 下载 SD3.5 Medium 底座（diffusers 完整目录）
优先 ModelScope（国内稳定），失败回退 HuggingFace。
"""
import os
import sys

TARGET = r"E:\sd35_lora\base\stable-diffusion-3.5-medium"
MODELSCOPE_ID = "AI-ModelScope/stable-diffusion-3.5-medium"
HF_ID = "stabilityai/stable-diffusion-3.5-medium"


def from_modelscope():
    print("== ModelScope 下载底座 ==")
    try:
        from modelscope import snapshot_download
    except ImportError:
        print("[FAIL] 未安装 modelscope: pip install modelscope")
        return None
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    print(f"  下载 {MODELSCOPE_ID} -> {TARGET}")
    path = snapshot_download(MODELSCOPE_ID, local_dir=TARGET)
    print(f"  [OK] ModelScope 下载完成: {path}")
    return TARGET


def from_hf():
    print("== HuggingFace 下载底座 ==")
    from huggingface_hub import snapshot_download as hf_download
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    path = hf_download(HF_ID, local_dir=TARGET)
    print(f"  [OK] HF 下载完成: {path}")
    return TARGET


def verify(base_dir):
    """验证 diffusers 目录完整性"""
    import json
    idx = os.path.join(base_dir, "model_index.json")
    if not os.path.exists(idx):
        print(f"[FAIL] 缺 model_index.json: {base_dir}")
        return False
    with open(idx, encoding="utf-8") as f:
        cfg = json.load(f)
    print(f"  model_index.json: pipeline={cfg.get('_class_name')}")
    # 检查关键子目录
    for sub in ["transformer", "text_encoder", "text_encoder_2", "text_encoder_3", "vae"]:
        d = os.path.join(base_dir, sub)
        if os.path.isdir(d):
            files = [f for f in os.listdir(d) if f.endswith((".safetensors", ".bin"))]
            print(f"  {sub}/: {len(files)} 权重文件")
        else:
            print(f"  [WARN] 缺 {sub}/ 目录")
    return True


if __name__ == "__main__":
    # 已存在则跳过
    if os.path.exists(os.path.join(TARGET, "model_index.json")):
        print(f"[SKIP] 底座已存在: {TARGET}")
        ok = verify(TARGET)
        sys.exit(0 if ok else 1)

    base = from_modelscope()
    if not base or not os.path.exists(os.path.join(base, "model_index.json")):
        print("[WARN] ModelScope 失败，回退 HuggingFace...")
        base = from_hf()

    if not base or not os.path.exists(os.path.join(base, "model_index.json")):
        print("[FAIL] 底座下载失败")
        sys.exit(1)
    ok = verify(base)
    sys.exit(0 if ok else 1)
