#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply v1.1 onboarding copy to src/locales/en.json (exact replacements, count==1 assert)."""
import json
import sys

PATH = r"F:\pp\src\locales\en.json"

# (old, new) pairs — must match file content EXACTLY (incl. literal \n escapes, curly apostrophes)
PAIRS = [
    # S1 body: five play modes + comma per baseline
    (
        r'"body": "Smart little friends that live inside your phone.\nLet’s get you set up - it’ll take a minute."',
        r'"body": "Smart little friends that live inside your phone — chat, draw, play, stories, adventure.\nLet’s get you set up, it’ll take a minute."',
    ),
    # S2 -> "More than a chat app" screen
    (
        r'"title": "Anytime,\nAnywhere."',
        r'"title": "More than\na chat app."',
    ),
    (
        r'"body": "Your pals live inside your phone.\nNo internet, no signal - they work on planes, off-grid, in remote villages."',
        r'"body": "Chat, draw pictures, read stories, play adventures, talk to them — all generated right on your phone. Even photos you take can be upscaled 4× sharper."',
    ),
    (
        r'"highlight": "No internet, no signal"',
        r'"highlight": "all generated right on your phone"',
    ),
    (
        r'"eyebrow": "The idea"',
        r'"eyebrow": "More to explore"',
    ),
    (
        r'"titleAccent": "Anytime,"',
        r'"titleAccent": "a chat app."',
    ),
    # S3 -> fully-offline + smaller-but-sharp screen
    (
        r'"title": "Smaller,\nbut yours."',
        r'"title": "Anytime,\nAnywhere."',
    ),
    (
        r'"titleAccent": "Smaller,"',
        r'"titleAccent": "Anytime,"',
    ),
    (
        r'"body": "Pals on your phone are quick and private - but lighter than Cloud AI. Think pocket companion, not all-knowing oracle."',
        r'"body": "No internet, no signal, no problem — on a plane, in an elevator, in a remote village, your pals are still right there.\nSmall and sharp, a touch lighter than the cloud’s big brains — but fast, private, and always yours."',
    ),
    (
        r'"highlight": "quick and private"',
        r'"highlight": "No internet, no signal"',
    ),
    (
        r'"eyebrow": "A heads-up"',
        r'"eyebrow": "Fully offline"',
    ),
    # S4 body: add pictures + open source
    (
        r'"body": "No accounts. No cloud. No tracking. Your conversations stay yours."',
        r'"body": "No accounts. No cloud. No tracking. Your chats and pictures stay yours.\nFully open source — anyone can check the code."',
    ),
    # S5 body: hyphen -> em dash
    (
        r'"body": "Pick what you’d like to discuss - we’ll match a pal that fits your phone."',
        r'"body": "Pick what you’d like to discuss — we’ll match a pal that fits your phone."',
    ),
    # S6 subtitleTemplate: switch-anytime wording
    (
        r'"subtitleTemplate": "{{name}} thinks using a small AI model on your phone - pick one that fits."',
        r'"subtitleTemplate": "Your pal runs on a small AI model, and you can switch anytime. Pick one that fits your phone."',
    ),
    # S6 pal.pip: hyphen -> em dash
    (
        r'"body": "We found a perfect pal for you - a friendly everyday companion. Smart enough for most things, light enough for any phone."',
        r'"body": "We found a perfect pal for you — a friendly everyday companion. Smart enough for most things, light enough for any phone."',
    ),
]


def main():
    with open(PATH, "r", encoding="utf-8", newline="") as f:
        text = f.read()

    for i, (old, new) in enumerate(PAIRS, 1):
        cnt = text.count(old)
        if cnt != 1:
            print(f"FAIL pair {i}: expected 1 occurrence, found {cnt}")
            print(f"  old: {old[:90]!r}")
            sys.exit(1)
        text = text.replace(old, new)
        print(f"ok pair {i}: {old[:60]!r}...")

    # validate JSON
    data = json.loads(text)
    onb = data["onboarding"]
    assert onb["screen2"]["eyebrow"] == "More to explore"
    assert onb["screen3"]["eyebrow"] == "Fully offline"
    assert "\u2014" in onb["screen1"]["body"]
    print("JSON valid; assertions passed.")

    with open(PATH, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("WROTE", PATH)


if __name__ == "__main__":
    main()
