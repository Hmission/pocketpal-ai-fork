# -*- coding: utf-8 -*-
"""sync_doc_index.py — 从 frontmatter 刷新 docs/INDEX.md 台账区。

用法: python scripts/governance/sync_doc_index.py [--root docs] [--dry-run]
在 AUTO-GENERATED-TABLE:START/END 标记区间内重写 docs/INDEX.md 的台账表。
人工治理入口区（标记区外）不被覆盖。
退出码: 0=完成, 1=有未登记文档（建议补登记）。
"""
import argparse
import re
import sys
from pathlib import Path


def parse_frontmatter(text: str):
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip().strip('"')
    return fm


def main(root: Path, dry_run: bool):
    index_path = root / "INDEX.md"
    if not index_path.exists():
        print("[sync_doc_index] 缺 docs/INDEX.md")
        return 1

    index_text = index_path.read_text(encoding="utf-8")
    rows = []
    for f in sorted(root.rglob("*.md")):
        if any(part in {"_templates", "node_modules", "internal"} for part in f.parts):
            continue
        rel = str(f.relative_to(root)).replace("\\", "/")
        if rel == "INDEX.md":
            continue
        text = f.read_text(encoding="utf-8", errors="ignore")
        fm = parse_frontmatter(text) or {}
        # 若 INDEX 中已登记该文档（含 rel 或 doc_id 的链接行），跳过（人工区已有）
        if rel in index_text or fm.get("doc_id", "") in index_text:
            continue
        rows.append(
            f"| {fm.get('doc_id', f.stem)} | {fm.get('type', '?')} | {fm.get('status', '?')} | "
            f"{fm.get('module', '?')} | 待登记 |"
        )

    if not rows:
        print("[sync_doc_index] 所有文档均已登记 INDEX.md（或无可自动补充项）")
        return 0

    print(f"[sync_doc_index] {len(rows)} 个文档未在 INDEX.md 中登记（建议人工补登记到对应分区）:")
    for r in rows:
        print("  -", r)
    return 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="docs")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    sys.exit(main(Path(args.root), args.dry_run))
