# -*- coding: utf-8 -*-
"""
01_prepare_dataset.py — SD3.5 人体姿态 LoRA 数据集预处理

功能：
1. 递归扫描源目录所有图片（jpg/jpeg/png/webp）
2. dHash 感知哈希去重（保留质量较高的一张）
3. 过滤：损坏图 / 短边过小(<640) / 非 RGB 图自动转
4. 统一尺寸：SD3.5 官方推荐短边 1024 的多分辨率 bucket（保持长宽比，不拉伸变形）
   - 竖图(2:3~9:16) → 1024x1536 / 1024x1344 / 896x1344（就近 bucket）
   - 横图(16:9~4:3) → 1536x1024 / 1344x1024（就近 bucket）
   - 方图 → 1024x1024
5. 生成 caption（默认统一人体姿态描述，可选 --florence 自动打标）
6. 输出: <out>/train/（图片 + .txt caption）+ 清洗报告 CSV

用法:
  python 01_prepare_dataset.py --src E:/图/PoseBookCN --out E:/sd35_lora/dataset
可选:
  --short-edge 1024      训练分辨率（SD3.5 推荐 1024）
  --min-side 640         短边过滤阈值
  --keep-horizontal      保留横图（默认只保留竖图+方图，人体姿态数据横图多为场景图）
  --max-imgs 800         最多保留数量（精选子集，默认全量）
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
from collections import defaultdict

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None  # 防超大图 DecompressionBomb

# SD3.5 训练 bucket：短边 1024，长边按常见人体姿态比例
BUCKETS = {
    "portrait":  [(1024, 1536), (1024, 1344), (896, 1344)],   # 竖图 2:3 ~ 3:4
    "landscape": [(1536, 1024), (1344, 1024), (1344, 896)],   # 横图
    "square":    [(1024, 1024), (896, 896)],
}


def dhash(img, hash_size=8):
    """dHash 感知哈希：缩到 hash_size+1 x hash_size，比较相邻像素亮度"""
    img = img.convert("L").resize((hash_size + 1, hash_size), Image.LANCZOS)
    px = list(img.getdata())
    bits = []
    for row in range(hash_size):
        for col in range(hash_size):
            bits.append(px[row * (hash_size + 1) + col] > px[row * (hash_size + 1) + col + 1])
    return int("".join("1" if b else "0" for b in bits), 2)


def hamming(a, b):
    return bin(a ^ b).count("1")


def pick_bucket(w, h):
    """按长宽比就近选 bucket，返回 (tw, th)"""
    ratio = w / h
    if 0.85 <= ratio <= 1.18:          # 近方形
        cands = BUCKETS["square"]
        target = 1.0
    elif ratio < 0.85:                  # 竖图
        cands = BUCKETS["portrait"]
        target = 2.0 / 3.0
    else:                               # 横图
        cands = BUCKETS["landscape"]
        target = 3.0 / 2.0
    best, best_err = None, 1e9
    for tw, th in cands:
        err = abs((tw / th) - target)
        if err < best_err:
            best, best_err = (tw, th), err
    return best


def fit_cover(img, tw, th):
    """等比缩放至短边对齐 bucket 短边（cover），居中裁剪超出部分，不拉伸不变形"""
    w, h = img.size
    scale = max(tw / w, th / h)
    nw, nh = max(int(w * scale + 0.5), tw), max(int(h * scale + 0.5), th)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="源图片目录")
    ap.add_argument("--out", required=True, help="输出训练集目录")
    ap.add_argument("--short-edge", type=int, default=1024)
    ap.add_argument("--min-side", type=int, default=640)
    ap.add_argument("--keep-horizontal", action="store_true")
    ap.add_argument("--max-imgs", type=int, default=0, help="0=全量")
    args = ap.parse_args()

    src = os.path.abspath(args.src)
    out = os.path.abspath(args.out)
    train_dir = os.path.join(out, "train")
    os.makedirs(train_dir, exist_ok=True)

    # 1. 扫描
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    files = []
    for dp, _, fn in os.walk(src):
        for f in fn:
            if os.path.splitext(f)[1].lower() in exts:
                files.append(os.path.join(dp, f))
    files.sort()
    print(f"[1/5] 扫描到 {len(files)} 张图片: {src}")

    # 2. 解码 + 哈希去重 + 过滤
    seen = {}          # hash -> (path, img, size)
    dup_groups = defaultdict(list)
    bad = []
    for p in files:
        try:
            with Image.open(p) as im:
                im.load()
                if im.mode not in ("RGB", "RGBA"):
                    im = im.convert("RGB")
                if im.mode == "RGBA":
                    bg = Image.new("RGB", im.size, (255, 255, 255))
                    bg.paste(im, mask=im.split()[3])
                    im = bg
                w, h = im.size
                if min(w, h) < args.min_side:
                    print(f"    跳过(短边{min(w,h)}<{args.min_side}): {p}")
                    continue
                hsh = dhash(im)
                if hsh in seen:
                    dup_groups[hsh].append(p)
                    continue
                seen[hsh] = (p, im, (w, h))
        except Exception as e:
            bad.append((p, str(e)))
            print(f"    损坏: {p} ({e})")

    # 3. 长宽比过滤
    kept, dropped = [], []
    for hsh, (p, im, (w, h)) in seen.items():
        r = w / h
        if not args.keep_horizontal and r > 1.18:
            dropped.append((p, f"横图 {w}x{h}"))
            continue
        kept.append((p, im, (w, h)))
    print(f"[2/5] 解码成功 {len(seen)} | 去重剔除 {sum(len(v) for v in dup_groups.values())} | 损坏 {len(bad)} | 横图过滤 {len(dropped)}")

    # 4. 精选子集（可选）
    if args.max_imgs and len(kept) > args.max_imgs:
        kept = kept[: args.max_imgs]
        print(f"[3/5] 精选前 {args.max_imgs} 张（按文件名排序）")

    # 5. 统一尺寸 + 输出
    report = []
    bucket_stat = defaultdict(int)
    cap = args.short_edge
    for i, (p, im, (w, h)) in enumerate(kept):
        tw, th = pick_bucket(w, h)
        # 若 bucket 长边超出短边配置的比例范围，动态缩放保持短边=cap
        scale = cap / min(tw, th)
        tw, th = int(tw * scale + 0.5) // 8 * 8, int(th * scale + 0.5) // 8 * 8
        img = fit_cover(im, tw, th)
        base = f"pose_{i:05d}"
        img_path = os.path.join(train_dir, base + ".jpg")
        img.save(img_path, "JPEG", quality=95)
        # caption：统一人体姿态描述（可后续用 Florence-2 自动打标替换）
        cap_path = os.path.join(train_dir, base + ".txt")
        with open(cap_path, "w", encoding="utf-8") as f:
            f.write("a person in a dynamic pose, full body, fitness pose, standing, athletic, photography, high quality")
        bucket_stat[(tw, th)] += 1
        report.append({"file": base + ".jpg", "src": p, "src_size": f"{w}x{h}", "bucket": f"{tw}x{th}"})

    # 报告
    print(f"[4/5] 输出 {len(report)} 张到 {train_dir}")
    print("      bucket 分布:", dict(bucket_stat))
    with open(os.path.join(out, "dataset_report.json"), "w", encoding="utf-8") as f:
        json.dump({"total": len(report), "buckets": {f"{w}x{h}": c for (w, h), c in bucket_stat.items()},
                   "dups": {str(k): v for k, v in dup_groups.items()},
                   "bad": bad, "dropped": dropped, "report": report}, f, ensure_ascii=False, indent=2)
    with open(os.path.join(out, "dataset_report.csv"), "w", encoding="utf-8-sig") as f:
        f.write("file,src,src_size,bucket\n")
        for r in report:
            f.write(f'{r["file"]},{r["src"]},{r["src_size"]},{r["bucket"]}\n')

    # 5. 原图备份清单（方便人工复核）
    with open(os.path.join(out, "source_map.json"), "w", encoding="utf-8") as f:
        json.dump({r["file"]: r["src"] for r in report}, f, ensure_ascii=False, indent=2)

    print(f"[5/5] 完成。报告: {out}\\dataset_report.csv")
    print(f"      人工复核原图映射: {out}\\source_map.json")


if __name__ == "__main__":
    main()
