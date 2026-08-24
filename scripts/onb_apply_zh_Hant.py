# -*- coding: utf-8 -*-
"""zh_Hant.json onboarding -> new baseline. Exact-string replacement."""
import json, io

PATH = r"F:\pp\src\locales\zh_Hant.json"
raw = io.open(PATH, "r", encoding="utf-8").read()

PAIRS = [
    ('"body": "住在您手機裡的聰明小夥伴。\\n讓我們開始設定吧——只需花一點時間即可。",',
     '"body": "聰明的小夥伴，住在您的手機裡——聊天、畫畫、遊戲、故事、冒險。\\n我們來設定一下吧，很快就好。",'),
    ('"title": "隨時，\\n隨地。",', '"title": "不只是\\n一個聊天 App。",'),
    ('"titleAccent": "隨時，"', '"titleAccent": "一個聊天 App。"'),
    ('"body": "您的 pal 住在您的手機裡。\\n即使沒有網路或訊號，它們也能在飛機上、離線環境或偏遠村莊中運作。",',
     '"body": "聊天、畫畫、讀故事、玩冒險、與他們對話——全部在您的手機上直接生成。您拍的照片也能放大 4 倍更清晰。",'),
    ('"highlight": "無需網路，無需訊號",', '"highlight": "全部在您的手機上直接生成",'),
    ('"eyebrow": "概念",', '"eyebrow": "還有更多",'),
    ('"title": "更小，\\n但屬於你。",', '"title": "隨時，\\n隨地。",'),
    ('"titleAccent": "更小，"', '"titleAccent": "隨時，"'),
    ('"body": "手機上的 Pal 快速且具備隱私性——但比雲端 AI 更輕量。將它們想像成隨身伴侶，而非無所不知的神諭。",',
     '"body": "沒有網路、沒有訊號也沒關係——在飛機上、電梯裡、偏遠村莊中，您的 pal 都在那裡。\\n小巧又靈敏，比雲端的大腦輕一點——但快速、隱私，而且永遠屬於您。",'),
    ('"highlight": "快速且保有隱私",', '"highlight": "沒有網路、沒有訊號",'),
    ('"eyebrow": "事先告知"', '"eyebrow": "完全離線"'),
    ('"body": "無需帳號。無需雲端。無需追蹤。您的對話內容仍屬於您。",',
     '"body": "無需帳號。無需雲端。無需追蹤。您的聊天和照片都屬於您。\\n完全開源——任何人都可以檢查程式碼。",'),
    ('"smartchat": "智慧對話",', '"smartchat": "智慧聊天",'),
    ('"else": "正在尋找其他內容？"', '"else": "正在尋找其他東西？"'),
    ('"coding": "編寫、除錯、解釋"', '"coding": "程式、除錯、解釋"'),
    ('"roleplay": "角色、場景"', '"roleplay": "角色、情境"'),
    ('"creative_writing": "故事、創意、草稿"', '"creative_writing": "故事、靈感、草稿"'),
    ('"else": "稍後可在應用程式中瀏覽所有 Pal"', '"else": "稍後可在 App 中瀏覽所有 Pal"'),
    ('"subtitleTemplate": "{{name}} 透過手機上的小型 AI 模型進行推理——請選擇適合的選項。",',
     '"subtitleTemplate": "{{name}} 運行在小型 AI 模型上，您可以隨時切換。請選擇適合您手機的一款。",'),
    ('"body": "我們為您找到了完美的 Pal - 一位親切的日常伴侶。它足夠聰明以應對大多數需求，且運作輕巧，適合任何手機使用。"',
     '"body": "我們為您找到了一位完美的 pal——一位親切的日常伴侶。夠聰明以應對大多數事情，也夠輕便以運行在任何手機上。"'),
    ('"body": "認識 Codie — 您的本地配對程式設計師。它能讀取與編寫程式碼，並在不離開手機的情況下解釋各種棘手的細節。"',
     '"body": "認識 Codie——您的本地配對程式員。讀程式碼、寫程式碼、解釋難纏的地方，全程不離開您的手機。"'),
    ('"body": "Sage 很有耐心且充滿好奇心，會引導您逐步實踐想法。它是您隨身攜帶的學習夥伴。"',
     '"body": "Sage 很有耐心、充滿好奇心，會帶您一步步梳理想法。一位裝在口袋裡的學習夥伴。"'),
    ('"body": "Echo 是一位多才多藝的角色扮演夥伴 — 它能維持人設、描繪場景，並隨您的故事走向而變幻。"',
     '"body": "Echo 是一位多才多藝的扮演夥伴——保持人設、描繪場景，跟隨您故事的走向。"'),
    ('"body": "Muse 協助您進行創作。它能提供措辭建議、掌握節奏，並維持您的語調。"',
     '"body": "Muse 幫您寫東西。提供措辭建議、找到節奏，並保持您的語氣不變。"'),
]

for old, new in PAIRS:
    assert raw.count(old) == 1, f"not unique or missing: {old[:60]}"
    raw = raw.replace(old, new)

obj = json.loads(raw)
ob = obj["onboarding"]
assert ob["splash"]["brand"] == "小黃雞"
assert "4 倍更清晰" in ob["screen2"]["body"]
assert "電梯" in ob["screen3"]["body"]
assert "完全開源" in ob["screen4"]["body"]
assert "隨時切換" in ob["screen6"]["subtitleTemplate"]

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print(f"zh_Hant OK, {len(PAIRS)} pairs applied")
