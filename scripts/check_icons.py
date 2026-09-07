# -*- coding: utf-8 -*-
"""
check_icons.py — 图标规范校验（防回归）

规范（docs/POCKETPAL_ICON_SPEC.md）：
  - 所有 SVG 必须 24×24 viewBox
  - stroke 型图标 stroke-width 必须为 2
  - 禁止 fill+stroke 双描边（fill 层与 stroke 层同用固定色）
  - **上色口径（v1.1 加）**：描边元素必须自带 fill="none"（否则调用侧传 fill 会被填实）；
    禁止 stroke="currentColor"（那是第二套上色机制）；描边型资产在调用侧禁单独传 fill

用法：python scripts/check_icons.py   （违规时 exit 1；已挂 pre-commit 第 7 闸）
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, 'src', 'assets', 'icons')

# dual-use 资产（ICON_SPEC §4.3）：实心靠调用侧 fill 实现，两侧校验均豁免
DUAL_USE = {'star.svg'}

ELEM_RE = re.compile(
    r'<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*?)/?>'
)

violations = []

for fn in sorted(os.listdir(ICON_DIR)):
    if not fn.endswith('.svg'):
        continue
    path = os.path.join(ICON_DIR, fn)
    svg = open(path, encoding='utf-8').read()

    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    if not vb or float(vb.group(1)) != 24 or float(vb.group(2)) != 24:
        violations.append(f'{fn}: viewBox 非 24×24')

    stroke_widths = set(re.findall(r'stroke-width="([\d.]+)"', svg))
    if stroke_widths and stroke_widths != {'2'}:
        violations.append(f'{fn}: stroke-width={sorted(stroke_widths)} 非 2')

    # 双描边：固定色 fill 与 stroke-width 同时出现
    if 'stroke-width' in svg and re.search(r'fill="(#[0-9A-Fa-f]{6})"', svg):
        violations.append(f'{fn}: fill+stroke 双描边')

    # --- 上色口径·资产侧（ICON_SPEC §一第 5 条 / §4.2）---
    if 'currentColor' in svg and re.search(r'stroke="currentColor"', svg):
        violations.append(
            f'{fn}: 描边色写了 currentColor（不吃 .svgrrc 映射，属第二套上色机制）'
        )
    if fn not in DUAL_USE:
        bare = [
            m.group(1)
            for m in ELEM_RE.finditer(svg)
            if 'stroke=' in m.group(2) and not re.search(r'\bfill=', m.group(2))
        ]
        if bare:
            violations.append(
                f'{fn}: {len(bare)} 个描边元素缺显式 fill="none"（会被 props.fill 继承填实）'
            )

# --- 上色口径·调用侧（ICON_SPEC §四：描边型只传 stroke）---
INDEX = os.path.join(ICON_DIR, 'index.ts')
alias2file = {}
if os.path.exists(INDEX):
    with open(INDEX, encoding='utf-8') as f:
        for m in re.finditer(
            r'export \{default as (\w+)\} from \'\./([\w.-]+)\.svg\'', f.read()
        ):
            alias2file[m.group(1)] = m.group(2) + '.svg'

# 资产是否需要 stroke 上色（含任一描边元素）
needs_stroke = {}
for fn in sorted(os.listdir(ICON_DIR)):
    if not fn.endswith('.svg'):
        continue
    with open(os.path.join(ICON_DIR, fn), encoding='utf-8') as f:
        needs_stroke[fn] = bool(
            [m for m in ELEM_RE.finditer(f.read()) if 'stroke=' in m.group(2)]
        )

JSX_RE = re.compile(r'<(\w*Icon)\b([^<]*?)/>', re.S)
for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, 'src')):
    dirnames[:] = [d for d in dirnames if d != 'icons']
    for name in filenames:
        if not name.endswith(('.tsx', '.ts')):
            continue
        p = os.path.join(dirpath, name)
        with open(p, encoding='utf-8') as f:
            body = f.read()
        for m in JSX_RE.finditer(body):
            tag, attrs = m.group(1), m.group(2)
            asset = alias2file.get(tag)
            if not asset or not needs_stroke.get(asset):
                continue
            if asset in DUAL_USE:
                continue
            if re.search(r'\bfill=', attrs) and not re.search(r'\bstroke=', attrs):
                line = body.count('\n', 0, m.start()) + 1
                violations.append(
                    f'{os.path.relpath(p, ROOT)}:{line}: {tag} 是描边型资产却只传 fill'
                    f'（{asset}）——会被填成实心，改传 stroke='
                )

if violations:
    print(f'[check_icons] {len(violations)} 处违规：')
    for v in violations:
        print('  ' + v)
    sys.exit(1)

print('[check_icons] 全部图标符合规范（24×24 / sw 2 / 无双描边 / 上色口径单一）')
