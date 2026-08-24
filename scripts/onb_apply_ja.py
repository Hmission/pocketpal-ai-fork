# -*- coding: utf-8 -*-
"""ja.json onboarding → new baseline (en-aligned). Exact-string replacement."""
import json, io

PATH = r"F:\pp\src\locales\ja.json"
raw = io.open(PATH, "r", encoding="utf-8").read()

PAIRS = [
    # splash / screen1
    ('"brand": "PocketPal"', '"brand": "Pocket Chick"'),
    ('"body": "あなたのスマホの中に住む、賢くて小さな友だち。\\nセットアップを始めましょう。すぐに終わります。",',
     '"body": "スマホの中に住む、賢くて小さな友だち——チャット、絵を描く、遊び、物語、冒険。\\nさあ、セットアップを始めましょう。ちょっとの時間です。",'),
    ('"eyebrow": "PocketPalへようこそ"', '"eyebrow": "Pocket Chickへようこそ"'),
    # screen2: new play-types content
    ('"title": "いつでも、\\nどこでも。",', '"title": "それ以上の、\\nチャットアプリ。",'),
    ('"titleAccent": "いつでも、"', '"titleAccent": "チャットアプリ。"'),
    ('"body": "パルはあなたのスマホの中にいます。\\nインターネットも電波もいりません。飛行機の中でも、電波の届かない場所でも、辺ぴな村でも使えます。",',
     '"body": "チャット、絵を描く、物語を読む、冒険する、話す——すべてがあなたのスマホの中で生成されます。自分で撮った写真も、4倍鮮明にアップスケールできます。",'),
    ('"highlight": "インターネットも電波もいらない"', '"highlight": "すべてがあなたのスマホの中で生成されます"'),
    ('"eyebrow": "コンセプト"', '"eyebrow": "もっといろいろ"'),
    # screen3: offline content (old S2 moved here)
    ('"body": "スマホの中のパルは、すばやくてプライベート。でもクラウドAIよりは軽量です。何でも知っている賢者ではなく、ポケットに入る相棒だと考えてください。",',
     '"body": "インターネットも電波もいらない——飛行機の中でも、エレベーターの中でも、辺ぴな村の中でも、パルはそこにいます。\\n小さくて、すばやくて、クラウドの大きな頭脳より少し軽い。でも、速く、プライベートで、いつもあなたのものです。",'),
    ('"highlight": "すばやくてプライベート"', '"highlight": "インターネットも電波もいらない"'),
    ('"eyebrow": "ちょっとひとこと"', '"eyebrow": "完全オフライン"'),
    # screen4: + open source
    ('"body": "アカウント不要。クラウドなし。トラッキングなし。あなたの会話はあなたのものです。",',
     '"body": "アカウント不要。クラウドなし。トラッキングなし。チャットも写真も、あなたのものです。\\n完全にオープンソース——誰でもコードを確認できます。",'),
    # screen5
    ('"smartchat": "スマートチャット",', '"smartchat": "日常チャット",'),
    ('"education": "学習",', '"education": "学び",'),
    ('"else": "ほかをお探しですか？"', '"else": "別のものを探していますか？"'),
    ('"coding": "コード作成、デバッグ、解説"', '"coding": "コード、デバッグ、解説"'),
    ('"education": "学ぶ、解説する、クイズ"', '"education": "学ぶ、解説、クイズ"'),
    ('"roleplay": "キャラクター、シナリオ"', '"roleplay": "キャラクター、状況"'),
    ('"creative_writing": "物語、アイデア、下書き"', '"creative_writing": "物語、アイデア、草稿"'),
    ('"else": "あとでアプリ内ですべてのパルを見る"', '"else": "アプリ内で全パルをあとで見られます"'),
    # screen6
    ('"subtitleTemplate": "{{name}}はスマホ上の小さなAIモデルを使って考えます。ぴったりのものを選んでください。",',
     '"subtitleTemplate": "{{name}}は小さなAIモデルで動いて、いつでも切り替えられます。スマホに合うものを選んでください。",'),
    ('"body": "あなたにぴったりのパルが見つかりました。毎日使えるフレンドリーな相棒です。たいていのことに対応できる賢さで、どんなスマホでも動く軽さです。"',
     '"body": "あなたにぴったりのパルが見つかりました——毎日使えるフレンドリーな相棒です。ほとんどのことに対応できる賢さで、どんなスマホでも動く軽さです。"'),
    ('"body": "Codieを紹介します。あなたのローカルなペアプログラマーです。コードを読み、コードを書き、難しい部分を解説します。すべてスマホの中だけで完結します。"',
     '"body": "Codie——あなたのローカルなペアプログラマー。コードを読み、書き、難しいところを解説。すべてスマホの中だけで完結します。"'),
    ('"body": "Sageは辛抱強く、好奇心旺盛で、アイデアを一歩ずつ一緒に考えてくれます。ポケットに入る学習の相棒です。"',
     '"body": "Sageは辛抱強く、好奇心旺盛で、アイデアを一歩ずつ一緒に考えてくれます。ポケットに忍ばせる、学びの相棒です。"'),
    ('"body": "Echoは多才なロールプレイの相棒です。キャラクターを保ち、情景を描き、物語の行く先までどこまでもついていきます。"',
     '"body": "Echoは多才なロールプレイの相棒。キャラクターを保ち、情景を描き、物語が向かう先までどこまでもついていきます。"'),
    ('"body": "Museは文章作成を手伝います。言い回しを提案し、リズムを見つけ、あなたのトーンをそのまま保ちます。"',
     '"body": "Museは文章を書くお手伝いをします。言い回しを提案し、リズムを見つけ、あなたのトーンをそのまま保ちます。"'),
]

for old, new in PAIRS:
    assert raw.count(old) == 1, f"not unique or missing: {old[:60]}"
    raw = raw.replace(old, new)

obj = json.loads(raw)
ob = obj["onboarding"]
assert ob["splash"]["brand"] == "Pocket Chick"
assert "4倍鮮明" in ob["screen2"]["body"]
assert "エレベーター" in ob["screen3"]["body"]
assert "完全にオープンソース" in ob["screen4"]["body"]
assert "いつでも切り替え" in ob["screen6"]["subtitleTemplate"]

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print(f"ja OK, {len(PAIRS)} pairs applied")
