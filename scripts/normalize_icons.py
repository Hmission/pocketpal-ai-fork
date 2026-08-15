# -*- coding: utf-8 -*-
"""
normalize_icons.py — 图标全库归一化（24×24 viewBox + stroke-width 2 + 纯 stroke 单色）

规范（docs/POCKETPAL_ICON_SPEC.md）：
  - 所有 SVG 统一 24×24 viewBox + width/height 24
  - stroke 型图标统一 stroke-width 2
  - fill 型图标（-sm/-md/-lg 变体、彩色 logo）仅归一 viewBox，不改填充风格
  - edit-box 特判：删除 fill 层，只留 stroke 层（消除 fill+stroke 双描边粗重感）

用法：python scripts/normalize_icons.py [--dry-run]
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, 'src', 'assets', 'icons')

DRY_RUN = '--dry-run' in sys.argv

# 纯填充图标（无 stroke-width 定义）→ 仅 viewBox 归一
FILL_ONLY = re.compile(r'fill="(#[0-9A-Fa-f]{6}|[a-zA-Z]+)"')


def parse_root(svg: str):
    m = re.search(
        r'<svg([^>]*)>', svg, re.S)
    if not m:
        return None, None, None, None
    attrs = m.group(1)
    w = re.search(r'width="([\d.]+)"', attrs)
    h = re.search(r'height="([\d.]+)"', attrs)
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', attrs)
    return (
        float(w.group(1)) if w else None,
        float(h.group(1)) if h else None,
        float(vb.group(1)) if vb else None,
        m.group(0),
    )


def normalize(svg: str, stem: str):
    """返回 (new_svg, changed_reasons)"""
    reasons = []
    w, h, vb, root_tag = parse_root(svg)
    if vb is None:
        return svg, ['skip:no-viewbox']

    has_stroke = 'stroke-width' in svg
    stroke_widths = set(re.findall(r'stroke-width="([\d.]+)"', svg))
    has_double = (
        re.search(r'fill="(#[0-9A-Fa-f]{6})"', svg) is not None
        and has_stroke
    )

    # --- edit-box 特判：删 fill 层（纯 stroke 化） ---
    if stem == 'edit-box':
        if has_double:
            # 删除无 stroke 属性的 fill path
            fill_path = re.search(
                r'<path[^>]*fill="[^"]+"[^>]*/>', svg)
            if fill_path:
                svg = svg.replace(fill_path.group(0), '', 1)
                reasons.append('edit-box:drop-fill-layer')
                has_double = False
                # 重解析根（内容变化可能影响）
                w, h, vb, root_tag = parse_root(svg)

    # --- viewBox 归一 ---
    if vb != 24 or w != 24:
        k = 24.0 / vb
        # 取出根内内容
        m = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S)
        if m:
            inner = m.group(1)
            new_root = re.sub(r'width="[^"]*"', 'width="24"', root_tag)
            new_root = re.sub(r'height="[^"]*"', 'height="24"', new_root)
            new_root = re.sub(r'viewBox="[^"]*"', 'viewBox="0 0 24 24"', new_root)
            if 'viewBox=' not in new_root:
                new_root = new_root.replace('<svg', '<svg viewBox="0 0 24 24"', 1)
            svg = new_root + (
                f'<g transform="scale({k:.6f} {k:.6f})">'
                + inner
                + '</g>'
            ) + '</svg>'
            reasons.append(f'viewBox:{vb}->24 (scale {k:.4f})')

    # --- stroke-width 统一 2 ---
    if has_stroke and stroke_widths and stroke_widths != {'2'}:
        svg = re.sub(r'stroke-width="[\d.]+"', 'stroke-width="2"', svg)
        reasons.append(f'stroke-width:{sorted(stroke_widths)}->2')

    return svg, reasons or ['ok']


def main():
    changed, skipped = [], []
    for fn in sorted(os.listdir(ICON_DIR)):
        if not fn.endswith('.svg'):
            continue
        stem = fn[:-4]
        path = os.path.join(ICON_DIR, fn)
        with open(path, encoding='utf-8') as f:
            src = f.read()
        new_svg, reasons = normalize(src, stem)
        if new_svg != src:
            changed.append((fn, reasons))
            if not DRY_RUN:
                with open(path, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(new_svg)
        else:
            if reasons == ['ok']:
                skipped.append(fn)

    print(f'== normalize_icons {"(dry-run)" if DRY_RUN else ""} ==')
    print(f'total: {len([f for f in os.listdir(ICON_DIR) if f.endswith(".svg")])}')
    print(f'changed: {len(changed)}')
    for fn, reasons in changed:
        print(f'  {fn}: {" | ".join(reasons)}')
    print(f'unchanged-ok: {len(skipped)}')
    if DRY_RUN:
        print('DRY RUN — no files written')


if __name__ == '__main__':
    main()
