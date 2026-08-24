# -*- coding: utf-8 -*-
"""ko.json onboarding -> new baseline (en-aligned). Exact-string replacement."""
import json, io

PATH = r"F:\pp\src\locales\ko.json"
raw = io.open(PATH, "r", encoding="utf-8").read()

PAIRS = [
    ('"brand": "PocketPal"', '"brand": "Pocket Chick"'),
    ('"body": "당신의 휴대폰 안에 사는 똑똑한 작은 친구들.\\n설정을 시작해 보세요 - 시간이 잠시 걸립니다.",',
     '"body": "휴대폰 속에 사는 똑똑한 작은 친구들 — 채팅, 그림, 놀이, 이야기, 모험.\\n설정을 시작해 볼게요. 잠시만 걸려요.",'),
    ('"eyebrow": "PocketPal에 오신 걸 환영해요"', '"eyebrow": "Pocket Chick에 오신 걸 환영해요"'),
    # screen2: new play-types content (title changed)
    ('"title": "언제나,\\n어디서나.",', '"title": "채팅 앱\\n이상의.",'),
    ('"titleAccent": "언제나,"', '"titleAccent": "이상의."'),
    ('"body": "Pal은 여러분의 휴대폰 안에 살아요.\\n인터넷도, 신호도 필요 없어요 - 비행기 안에서도, 오지에서도, 외딴 마을에서도 작동해요.",',
     '"body": "채팅, 그림 그리기, 이야기 읽기, 모험하기, 대화 — 모두 휴대폰 안에서 직접 생성됩니다. 직접 찍은 사진도 4배 선명하게 업스케일할 수 있어요.",'),
    ('"highlight": "인터넷도, 신호도 필요 없어요"', '"highlight": "모두 휴대폰 안에서 직접 생성됩니다"'),
    ('"eyebrow": "기본 아이디어"', '"eyebrow": "더 볼 게 있어요"'),
    # screen3: offline content (old S2 moved here)
    ('"title": "작지만,\\n온전히 내 것.",', '"title": "언제나,\\n어디서나.",'),
    ('"titleAccent": "작지만,"', '"titleAccent": "언제나,"'),
    ('"body": "휴대폰 속 Pal은 빠르고 프라이버시를 지켜줘요 - 다만 클라우드 AI보다는 가벼워요. 모든 걸 아는 신탁이 아니라, 주머니 속 동반자라고 생각하면 돼요.",',
     '"body": "인터넷도, 신호도 필요 없어요 — 비행기 안에서든, 엘리베이터에서든, 외딴 마을에서든, Pal은 늘 곁에 있어요.\\n작고 또 빠르며, 클라우드의 큰 뇌보다는 조금 가벼워요. 하지만 빠르고, 사생활을 지켜 주며, 언제나 여러분의 것이에요.",'),
    ('"highlight": "빠르고 프라이버시를 지켜줘요"', '"highlight": "인터넷도, 신호도 필요 없어요"'),
    ('"eyebrow": "참고하세요"', '"eyebrow": "완전 오프라인"'),
    # screen4: + open source
    ('"body": "계정도, 클라우드도, 추적도 없어요. 대화는 온전히 여러분의 것으로 남아요.",',
     '"body": "계정도, 클라우드도, 추적도 없어요. 채팅과 사진은 온전히 여러분의 것이에요.\\n완전 오픈소스 — 누구나 코드를 확인할 수 있어요.",'),
    # screen5: topic smartchat + td.roleplay
    ('"smartchat": "스마트 채팅",', '"smartchat": "일상 채팅",'),
    ('"roleplay": "캐릭터, 시나리오"', '"roleplay": "캐릭터, 상황"'),
    # screen6
    ('"subtitleTemplate": "{{name}}은(는) 휴대폰에서 작은 AI 모델로 생각해요 - 잘 맞는 모델을 골라 주세요.",',
     '"subtitleTemplate": "{{name}}은(는) 작은 AI 모델로 동작하고, 언제든 전환할 수 있어요. 휴대폰에 맞는 모델을 골라 주세요.",'),
    ('"body": "여러분에게 딱 맞는 Pal을 찾았어요 - 친근한 일상 동반자예요. 대부분의 일을 똑똑하게 처리하면서도, 어떤 휴대폰에서나 가볍게 돌아가요."',
     '"body": "여러분에게 딱 맞는 Pal을 찾았어요 — 친근한 일상 동반자예요. 대부분의 일을 해낼 만큼 똑똑하고, 어떤 휴대폰에서든 돌아갈 만큼 가벼워요."'),
    ('"body": "Codie를 소개할게요 — 휴대폰 안의 페어 프로그래머예요. 코드를 읽고, 코드를 쓰고, 까다로운 부분을 설명해 줘요. 그 모든 일이 휴대폰을 벗어나지 않아요."',
     '"body": "Codie — 휴대폰 안의 페어 프로그래머예요. 코드를 읽고, 쓰고, 까다로운 부분을 설명해 줘요. 그 모든 일이 휴대폰 안에서 끝나요."'),
    ('"body": "Sage는 인내심 있고 호기심 많아서, 개념을 하나씩 차근차근 안내해 줘요. 주머니 속에 두는 학습 친구예요."',
     '"body": "Sage는 인내심 있고 호기심 많아서, 개념을 하나씩 차근차근 안내해 줘요. 주머니 속에 넣어 둘 학습 친구예요."'),
    ('"body": "Echo는 다재다능한 역할극 동반자예요 — 캐릭터를 끝까지 유지하고, 장면을 생생하게 그려내며, 이야기가 어디로 흘러가든 함께해요."',
     '"body": "Echo는 다재다능한 역할극 동반자예요 — 캐릭터를 끝까지 유지하고, 장면을 그려 내며, 이야기가 흘러가는 곳 어디까지나 함께해요."'),
    ('"body": "Muse는 글쓰기를 도와줘요. 표현을 제안하고, 리듬을 찾아주며, 여러분의 어조를 그대로 살려줘요."',
     '"body": "Muse는 글쓰기를 도와줘요. 표현을 제안하고, 리듬을 찾아 주며, 여러분의 어조를 그대로 살려 줘요."'),
]

for old, new in PAIRS:
    assert raw.count(old) == 1, f"not unique or missing: {old[:60]}"
    raw = raw.replace(old, new)

obj = json.loads(raw)
ob = obj["onboarding"]
assert ob["splash"]["brand"] == "Pocket Chick"
assert "4배 선명" in ob["screen2"]["body"]
assert "엘리베이터" in ob["screen3"]["body"]
assert "완전 오픈소스" in ob["screen4"]["body"]
assert "언제든 전환" in ob["screen6"]["subtitleTemplate"]

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print(f"ko OK, {len(PAIRS)} pairs applied")
