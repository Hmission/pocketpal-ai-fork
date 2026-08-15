# -*- coding: utf-8 -*-
"""
check_icons.py — 图标规范校验（防回归）

规范（docs/POCKETPAL_ICON_SPEC.md）：
  - 所有 SVG 必须 24×24 viewBox
  - stroke 型图标 stroke-width 必须为 2
  - 禁止 fill+stroke 双描边（fill 层与 stroke 层同用固定色）

用法：python scripts/check_icons.py   （违规时 exit 1）
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, 'src', 'assets', 'icons')

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

if violations:
    print(f'[check_icons] {len(violations)} 处违规：')
    for v in violations:
        print('  ' + v)
    sys.exit(1)

print('[check_icons] 全部图标符合规范（24×24 / sw 2 / 无双描边）')
