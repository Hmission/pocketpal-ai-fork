# -*- coding: utf-8 -*-
"""pt.json onboarding -> new baseline. Exact-string replacement."""
import json, io

PATH = r"F:\pp\src\locales\pt.json"
raw = io.open(PATH, "r", encoding="utf-8").read()

PAIRS = [
    ('"brand": "PocketPal"', '"brand": "Pocket Chick"'),
    ('"body": "Pequenos amigos inteligentes que vivem dentro do seu telemóvel.\\nVamos ajudá-lo a configurar - vai levar só um minuto.",', '"body": "Pequenos amigos inteligentes que vivem dentro do seu telemóvel — conversar, desenhar, brincar, histórias, aventuras.\\nVamos configurar — leva só um minuto.",'),
    ('"eyebrow": "Bem-vindo ao PocketPal"', '"eyebrow": "Bem-vindo ao Pocket Chick"'),
    ('"title": "A Qualquer Hora,\\nEm Qualquer Lugar.",', '"title": "Mais do que\\num app de chat.",'),
    ('"titleAccent": "A Qualquer Hora,"', '"titleAccent": "um app de chat."'),
    ('"body": "Os seus pals vivem dentro do seu telemóvel.\\nSem internet, sem sinal - eles funcionam em aviões, fora da rede, em vilarejos remotos.",', '"body": "Conversar, desenhar imagens, ler histórias, viver aventuras, falar com eles — tudo gerado diretamente no seu telemóvel. Até as fotos que tirar podem ser ampliadas 4× mais nítidas.",'),
    ('"highlight": "Sem internet, sem sinal",', '"highlight": "tudo gerado diretamente no seu telemóvel",'),
    ('"eyebrow": "A ideia",', '"eyebrow": "Mais para explorar",'),
    ('"title": "Menores,\\nmas os seus.",', '"title": "A Qualquer Hora,\\nEm Qualquer Lugar.",'),
    ('"titleAccent": "Menores,"', '"titleAccent": "A Qualquer Hora,"'),
    ('"body": "Os pals no seu telemóvel são rápidos e privados - mas mais leves que a IA na nuvem. Pense num companheiro de bolso, não num oráculo onisciente.",', '"body": "Sem internet, sem sinal, sem problema — num avião, num elevador, numa aldeia remota, os seus pals continuam lá.\\nPequenos e astutos, um pouco mais leves que os grandes cérebros da nuvem — mas rápidos, privados e sempre seus.",'),
    ('"highlight": "rápidos e privados",', '"highlight": "Sem internet, sem sinal",'),
    ('"eyebrow": "Um aviso"', '"eyebrow": "Totalmente offline"'),
    ('"body": "Sem contas. Sem nuvem. Sem rastreamento. As suas conversas continuam a serem as suas.",', '"body": "Sem contas. Sem nuvem. Sem rastreamento. As suas conversas e fotos continuam a ser suas.\\nTotalmente open source — qualquer um pode verificar o código.",'),
    ('"smartchat": "Chat Inteligente",', '"smartchat": "Chat do dia a dia",'),
    ('"roleplay": "Personagens, cenários",', '"roleplay": "Personagens, situações",'),
    ('"subtitleTemplate": "{{name}} pensa usando um pequeno modelo de IA no seu telemóvel - escolha um que se encaixe.",', '"subtitleTemplate": "{{name}} funciona com um pequeno modelo de IA e pode alternar quando quiser. Escolha um que se encaixe no seu telemóvel.",'),
]

for old, new in PAIRS:
    assert raw.count(old) == 1, f"not unique or missing: {old[:60]}"
    raw = raw.replace(old, new)

obj = json.loads(raw)
ob = obj["onboarding"]
assert ob["splash"]["brand"] == "Pocket Chick"
assert "4×" in ob["screen2"]["body"]
assert "elevador" in ob["screen3"]["body"]
assert "open source" in ob["screen4"]["body"]
assert "alternar" in ob["screen6"]["subtitleTemplate"]

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print(f"pt OK, {len(PAIRS)} pairs applied")
