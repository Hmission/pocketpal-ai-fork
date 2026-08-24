#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Apply v1.1 onboarding copy to src/locales/zh.json (exact replacements, count==1 assert).
zh.json stores literal UTF-8 (no \uXXXX escapes); \\n below = literal backslash-n in file.
"""
import json
import sys

PATH = r"F:\pp\src\locales\zh.json"

PAIRS = [
    # S1 欢迎页
    ('"title": "认识您的 Pal。"',
     '"title": "认识一下你的小伙伴。"'),
    ('"titleAccent": "Pal。"',
     '"titleAccent": "小伙伴。"'),
    ('"body": "住在您手机里的聪明小伙伴。\\n来花一分钟把它们设置好吧。"',
     '"body": "住进你手机的 AI 伙伴——聊天、生图、玩乐、绘本、冒险。\\n花一分钟把它们设置好吧。"'),
    ('"cta": "带我去看看"',
     '"cta": "带我看看"'),
    # S2 多种玩法页（原 S2 离线内容整体下移给 S3）
    ('"eyebrow": "理念"',
     '"eyebrow": "多种玩法"'),
    ('"title": "随时，\\n随地。"',
     '"title": "不止\\n聊天。"'),
    ('"titleAccent": "随时，"',
     '"titleAccent": "聊天。"'),
    ('"body": "您的 Pal 就住在您的手机里。\\n不用联网、没有信号也能用——在飞机上、断网时、偏远村庄里都能正常工作。"',
     '"body": "聊天、生图、讲故事、玩冒险、直接开口说——全部在你的手机上完成。拍的照片还能放大 4 倍更清晰。"'),
    ('"highlight": "不用联网、没有信号"',
     '"highlight": "全部在你的手机上完成"'),
    # S3 完全离线 + 小而精（原 S3「更小巧」内容并入此处）
    ('"title": "更小巧，\\n但完全属于您。"',
     '"title": "随时，\\n随地。"'),
    ('"titleAccent": "更小巧，"',
     '"titleAccent": "随时，"'),
    ('"body": "手机上的Pal快速又私密——但比云端AI更轻量。把它当成口袋里的小伙伴，而不是无所不知的神谕。"',
     '"body": "不用联网、没有信号也没关系——在飞机上、在电梯里、在偏远村庄，你的小伙伴都还在。\\n小而精，比云端大模型轻一点——但快、私密，永远属于你。"'),
    ('"highlight": "快速又私密"',
     '"highlight": "不用联网、没有信号"'),
    ('"eyebrow": "温馨提示"',
     '"eyebrow": "完全离线"'),
    # S4 隐私承诺
    ('"title": "任何内容都不会离开您的手机。"',
     '"title": "一切\\n留在你的手机里。"'),
    ('"titleAccent": "离开"',
     '"titleAccent": "留在你的手机里。"'),
    ('"body": "无需账户。没有云端。不做追踪。您的对话始终属于您自己。"',
     '"body": "无需账户。没有云端。不做追踪。你的对话和图像，只属于你。\\n完全开源——任何人都能查看代码。"'),
    ('"storageNote": "首次启动会请您授予「所有文件访问」权限，仅用于读取模型目录与备份聊天记录，可随时在系统设置中更改。"',
     '"storageNote": "首次启动时会请求「所有文件访问权限」——仅用于读取模型文件夹与备份聊天记录。你可随时在系统设置中更改。"'),
    # S5 用途选择
    ('"title": "您想让 Pal 帮您做什么？"',
     '"title": "你的小伙伴用来做什么？"'),
    ('"body": "选一个您想聊的话题 — 我们会为您匹配适合您手机的 Pal。"',
     '"body": "选一个你想聊的方向——我们会为你匹配一款适合你手机的小伙伴。"'),
    ('"smartchat": "智能聊天"',
     '"smartchat": "日常聊天"'),
    ('"education": "教育"',
     '"education": "学习成长"'),
    ('"else": "想找点别的？"',
     '"else": "都想试试"'),
    ('"smartchat": "贴心的日常小伙伴"',
     '"smartchat": "聊天、问答、日常陪伴"'),
    ('"coding": "写代码、调试、讲解"',
     '"coding": "写代码、调 bug、讲原理"'),
    ('"roleplay": "角色、情景"',
     '"roleplay": "角色、情景、故事"'),
    ('"creative_writing": "故事、灵感、草稿"',
     '"creative_writing": "故事、灵感、初稿"'),
    ('"else": "稍后在应用内浏览所有 Pal"',
     '"else": "进入 App 后可浏览全部小伙伴"'),
    # S6 下载模型
    ('"subtitleTemplate": "{{name}} 靠手机上的小型 AI 模型来思考——挑一个适合的吧。"',
     '"subtitleTemplate": "你的小伙伴靠小型 AI 模型思考，之后随时可以更换。挑一个适合你手机的吧。"'),
    ('"body": "我们为您找到了一个完美的 Pal — 贴心的日常小伙伴。够聪明，能应付大多数事情；够轻量，适配任何手机。"',
     '"body": "我们为你找到了最对味的小伙伴——友好的日常陪伴。大部分事情都够用，任何手机都带得动。"'),
    ('"body": "认识一下 Codie — 您本地的结对编程伙伴。读代码、写代码、讲解难点，全程都不会离开您的手机。"',
     '"body": "认识一下 Codie——你的本地结对编程伙伴。读代码、写代码、讲清难点，全程不出你的手机。"'),
    ('"body": "Sage 耐心又好奇，会一步步带您理清思路。一个揣在口袋里的学习搭档。"',
     '"body": "Sage 耐心、好奇，会一步步带你理解想法。一个装进口袋的学习搭子。"'),
    ('"body": "Echo 是个多才多艺的角色扮演伙伴 — 始终入戏、描绘场景，无论您的故事走向何方都紧紧跟随。"',
     '"body": "Echo 是全能角色扮演伙伴——不脱离人设、会描绘场景，跟着你的故事走到哪算哪。"'),
    ('"body": "Muse 帮您写作。提供措辞建议、找准节奏，并保持您独有的语气。"',
     '"body": "Muse 帮你写作。给措辞建议、找节奏，同时保住你的语气。"'),
]

def main():
    with open(PATH, encoding="utf-8") as f:
        raw = f.read()
    for old, new in PAIRS:
        c = raw.count(old)
        assert c == 1, f"count={c} (expected 1) for: {old[:60]!r}"
        raw = raw.replace(old, new)
    data = json.loads(raw)  # JSON 回验
    onb = data["onboarding"]
    assert onb["screen1"]["title"] == "认识一下你的小伙伴。"
    assert onb["screen2"]["title"] == "不止\n聊天。"
    assert onb["screen3"]["title"] == "随时，\n随地。"
    assert onb["screen4"]["titleAccent"] == "留在你的手机里。"
    assert onb["screen5"]["topic"]["smartchat"] == "日常聊天"
    assert onb["screen6"]["pal"]["pip"]["body"].startswith("我们为你找到了最对味的小伙伴")
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(raw)
    print("zh.json: %d replacements applied OK" % len(PAIRS))

if __name__ == "__main__":
    main()
