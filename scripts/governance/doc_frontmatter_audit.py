# -*- coding: utf-8 -*-
"""doc_frontmatter_audit.py — frontmatter 合规审计（必填字段 + D-FORMAT 标记）。

用法: python scripts/governance/doc_frontmatter_audit.py [--root docs]
规则见 docs/DOC_MANAGEMENT.md §二（必填 doc_id/module/type/status；建议 relates/version/created/updated）。
退出码: 0=全绿, 1=存在不合规文档。
"""
import argparse
import re
import sys
from pathlib import Path

REQUIRED = ("doc_id", "module", "type", "status")
VALID_TYPES = {
    "ssot", "spec", "design", "planning", "implementation", "summary",
    "fix", "index", "howto", "operations", "positioning", "adr", "sop",
    "doc", "copy",
}
VALID_STATUS = {"draft", "active", "superseded", "archived", "deprecated", "accepted", "proposed", "authoritative"}

# 允许无 frontmatter 的例外文件（模板占位符等，需在 _templates 内）
TEMPLATE_DIRS = {"_templates", "internal"}


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


def audit(root: Path):
    problems = []
    total = 0
    for f in sorted(root.rglob("*.md")):
        if any(part in TEMPLATE_DIRS for part in f.parts):
            continue
        total += 1
        text = f.read_text(encoding="utf-8", errors="ignore")
        fm = parse_frontmatter(text)
        rel = str(f.relative_to(root)).replace("\\", "/")
        if fm is None:
            problems.append(f"[{rel}] 缺 frontmatter（必须 --- doc_id/module/type/status ---）")
            continue
        for k in REQUIRED:
            if k not in fm or not fm[k]:
                problems.append(f"[{rel}] 缺必填字段: {k}")
        if fm.get("type") not in VALID_TYPES:
            problems.append(f"[{rel}] type 非法: {fm.get('type')!r}")
        if fm.get("status") not in VALID_STATUS:
            problems.append(f"[{rel}] status 非法: {fm.get('status')!r}")
        if "D-FORMAT:v3" not in text:
            problems.append(f"[{rel}] 缺 D-FORMAT:v3 标记")
        if fm.get("doc_id") and fm["doc_id"] != f.stem:
            problems.append(f"[{rel}] doc_id 与文件名不一致: {fm['doc_id']} != {f.stem}")
    print(f"[doc_frontmatter_audit] 扫描 {total} 个文档, 问题 {len(problems)} 个")
    for p in problems:
        print("  -", p)
    return 0 if not problems else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="docs")
    args = ap.parse_args()
    sys.exit(audit(Path(args.root)))
