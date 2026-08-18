# -*- coding: utf-8 -*-
"""
download_sd3_2b.py — 下载 SD3 Medium 2B diffusers 底座
引擎兼容架构（joint_blocks），训练产物可直接部署。
"""
import os
import sys

TARGET = r"E:\sd35_lora\base2\stable-diffusion-3-medium"
MODELSCOPE_ID = "AI-ModelScope/stable-diffusion-3-medium-diffusers"


def main():
    print(f"== ModelScope 下载 {MODELSCOPE_ID} ==")
    try:
        from modelscope import snapshot_download
    except ImportError:
        print("[FAIL] 未安装 modelscope: pip install modelscope")
        sys.exit(1)
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    print(f"  下载 -> {TARGET}")
    path = snapshot_download(MODELSCOPE_ID, local_dir=TARGET)
    print(f"[OK] 下载完成: {path}")


if __name__ == "__main__":
    main()
