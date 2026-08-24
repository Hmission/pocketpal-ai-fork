# -*- coding: utf-8 -*-
"""Read-only: print the onboarding block of every enabled locale (brace-matched)."""
import io, os

LOCALES = ["en", "zh", "zh_Hant", "ja", "ko", "fa", "he", "id", "ms", "pl", "pt", "pt_BR", "ru", "uk"]
BASE = r"F:\pp\src\locales"


def extract(text):
    start = text.index('"onboarding"')
    i = text.index("{", start)
    depth = 0
    in_str = False
    esc = False
    j = i
    while j < len(text):
        c = text[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[i:j + 1]
        j += 1
    raise RuntimeError("unbalanced braces")


for loc in LOCALES:
    p = os.path.join(BASE, loc + ".json")
    with io.open(p, encoding="utf-8") as f:
        text = f.read()
    if '"onboarding"' not in text:
        print("=== %s === (NO onboarding section)" % loc)
        continue
    print("=== %s ===" % loc)
    print(extract(text))
    print()
