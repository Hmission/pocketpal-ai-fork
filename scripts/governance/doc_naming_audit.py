# -*- coding: utf-8 -*-
"""doc_naming_audit.py — 命名规范审计（UPPER_SNAKE_CASE + doc_id 重名检测）。

用法: python scripts/governance/doc_naming_audit.py [--root docs]
规则见 docs/DOC_MANAGEMENT.md §三（命名 {SUBJECT}_{TYPE}.md，UPPER_SNAKE_CASE；doc_id=文件名去 .md）。
例外: 治理元文档与既有 POCKETPAL_* 系列沿用原名（小写/驼峰豁免列表）。
退出码: 0=全绿, 1=存在不合规文档。
"""
import argparse
import re
import sys
from pathlib import Path

# 豁免: 既有多词小写/短横线命名（过渡期），新文档必须 UPPER_SNAKE_CASE
EXEMPT = {"getting_started"}


def audit(root: Path):
    problems = []
    total = 0
    seen = {}
    for f in sorted(root.rglob("*.md")):
        if any(part in {"_templates", "_governance", "_cursor_session", "node_modules", "internal"} for part in f.parts):
            continue
        total += 1
        stem = f.stem
        if stem in EXEMPT:
            continue
        # UPPER_SNAKE_CASE: 大写字母/数字/下划线（允许 ADR-0001-xxx 短横线模式在 adr/ 目录）
        rel = str(f.relative_to(root)).replace("\\", "/")
        is_adr = rel.startswith("adr/")
        if is_adr:
            ok = re.match(r"^ADR-\d{4}-[a-z0-9-]+$", stem) is not None
        else:
            ok = re.match(r"^[A-Z][A-Z0-9_]*$", stem) is not None
        if not ok:
            problems.append(f"[{rel}] 命名不合规: {stem!r}（期望 UPPER_SNAKE_CASE；ADR 期望 ADR-NNNN-slug）")
        if stem in seen:
            problems.append(f"[{rel}] doc_id 重名: {stem!r} 与 {seen[stem]} 冲突")
        seen[stem] = rel
    print(f"[doc_naming_audit] 扫描 {total} 个文档, 问题 {len(problems)} 个")
    for p in problems:
        print("  -", p)
    return 0 if not problems else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="docs")
    args = ap.parse_args()
    sys.exit(audit(Path(args.root)))
