# -*- coding: utf-8 -*-
"""pl.json onboarding -> new baseline. Exact-string replacement."""
import json, io

PATH = r"F:\pp\src\locales\pl.json"
raw = io.open(PATH, "r", encoding="utf-8").read()

PAIRS = [
    ('"brand": "PocketPal"', '"brand": "Pocket Chick"'),
    ('"body": "Sprytni mali przyjaciele, którzy mieszkają w Twoim telefonie.\\nZacznijmy konfigurację – to zajmie tylko chwilę.",', '"body": "Sprytni mali przyjaciele, którzy mieszkają w Twoim telefonie — czat, rysowanie, zabawa, opowieści, przygody.\\nZacznijmy konfigurację — to zajmie tylko chwilę.",'),
    ('"eyebrow": "Witaj w PocketPal"', '"eyebrow": "Witaj w Pocket Chick"'),
    ('"title": "Kiedy chcesz,\\nGdzie chcesz.",', '"title": "Więcej niż\\naplikacja czatu.",'),
    ('"titleAccent": "Kiedy tylko zechcesz,"', '"titleAccent": "aplikacja czatu."'),
    ('"body": "Twoi Kumple żyją w Twoim telefonie.\\nBez internetu, bez zasięgu – działają w samolotach, poza siecią, w odległych wioskach.",', '"body": "Czat, rysowanie obrazków, czytanie opowieści, przygody, rozmowy z nimi — wszystko generowane bezpośrednio na Twoim telefonie. Nawet zdjęcia, które zrobisz, można powiększyć 4× wyraźniej.",'),
    ('"highlight": "Bez internetu, bez sieci",', '"highlight": "wszystko generowane bezpośrednio na Twoim telefonie",'),
    ('"eyebrow": "Pomysł",', '"eyebrow": "Więcej do odkrycia",'),
    ('"title": "Mniejszy,\\nale za to Twój.",', '"title": "Kiedy chcesz,\\nGdzie chcesz.",'),
    ('"titleAccent": "Mniejszy,"', '"titleAccent": "Kiedy chcesz,"'),
    ('"body": "Kumple na Twoim telefonie działają szybko i zapewniają prywatność – ale są mniej rozbudowani niż sztuczna inteligencja w chmurze. Pomyśl o nich raczej jak o kieszonkowych towarzyszach, a nie wszechwiedzących wyroczniach.",', '"body": "Bez internetu, bez zasięgu, bez problemu — w samolocie, w windzie, w odległej wiosce Twoi kumple są wciąż przy Tobie.\\nMali i sprytni, odrobinę lżejsi niż wielkie mózgi chmury — ale szybcy, prywatni i zawsze Twoi.",'),
    ('"highlight": "szybko i dyskretnie"', '"highlight": "Bez internetu, bez zasięgu"'),
    ('"eyebrow": "Uwaga",', '"eyebrow": "W pełni offline",'),
    ('"body": "Żadnych kont. Żadnej chmury. Żadnego śledzenia. Twoje rozmowy pozostają wyłącznie Twoje.",', '"body": "Żadnych kont. Żadnej chmury. Żadnego śledzenia. Twoje czaty i zdjęcia pozostają Twoje.\\nW pełni open source — każdy może sprawdzić kod.",'),
    ('"smartchat": "Inteligentny Czat",', '"smartchat": "Czat na co dzień",'),
    ('"roleplay": "Postacie, scenariusze",', '"roleplay": "Postacie, sytuacje",'),
    ('"subtitleTemplate": "{{name}} myśli za pomocą niewielkiego modelu sztucznej inteligencji na telefonie – wybierz taki, który Ci odpowiada.",', '"subtitleTemplate": "{{name}} działa na niewielkim modelu AI i możesz przełączać w każdej chwili. Wybierz taki, który pasuje do Twojego telefonu.",'),
    ('"body": "Znaleźliśmy dla Ciebie idealnego kumpla - przyjaznego towarzysza na co dzień. Wystarczająco inteligentny, by poradzić sobie z większością zadań, i wystarczająco lekki, by pasować do każdego telefonu."', '"body": "Znaleźliśmy dla Ciebie idealnego kumpla — przyjaznego towarzysza na co dzień. Wystarczająco sprytny, by poradzić sobie z większością rzeczy, i wystarczająco lekki, by działać na każdym telefonie."'),
    ('"body": "Poznaj Codie — Twojego lokalnego partnera do programowania. Czyta kod, pisze kod i wyjaśnia skomplikowane fragmenty, nie opuszczając przy tym nigdy Twojego telefonu."', '"body": "Poznaj Codie — Twojego lokalnego partnera programowania. Czyta kod, pisze kod i wyjaśnia trudne fragmenty, nie opuszczając nigdy Twojego telefonu."'),
    ('"body": "Sage jest cierpliwy, ciekawy świata i krok po kroku wyjaśnia różne pomysły. To taki kolega do nauki, którego zawsze masz pod ręką."', '"body": "Sage jest cierpliwy, ciekawy świata i krok po kroku prowadzi przez pomysły. Kolega do nauki, którego trzymasz w kieszeni."'),
    ('"body": "Echo to wszechstronny towarzysz w grach fabularnych — pozostaje w charakterze swojej postaci, maluje sceny i podąża za Tobą, dokądkolwiek zaprowadzi cię Twoja historia."', '"body": "Echo to wszechstronny towarzysz w grach fabularnych — pozostaje w charakterze, maluje sceny i podąża za Twoją historią, dokądkolwiek zmierza."'),
    ('"body": "Muse pomaga w pisaniu. Sugeruje sformułowania, nadaje tekstowi rytm i pozwala zachować odpowiedni ton."', '"body": "Muse pomaga w pisaniu. Sugeruje sformułowania, znajduje rytm i pozwala zachować Twój ton."'),
]

for old, new in PAIRS:
    assert raw.count(old) == 1, f"not unique or missing: {old[:60]}"
    raw = raw.replace(old, new)

obj = json.loads(raw)
ob = obj["onboarding"]
assert ob["splash"]["brand"] == "Pocket Chick"
assert "4×" in ob["screen2"]["body"]
assert "windzie" in ob["screen3"]["body"]
assert "open source" in ob["screen4"]["body"]
assert "przełączać" in ob["screen6"]["subtitleTemplate"]

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print(f"pl OK, {len(PAIRS)} pairs applied")
