# -*- coding: utf-8 -*-
import json, io

PATH = "src/locales/ms.json"
raw = io.open(PATH, encoding="utf-8").read()
NL = chr(92) + "n"  # literal backslash-n as it appears in the JSON file

PAIRS = [
    ('"brand": "PocketPal"', '"brand": "Pocket Chick"'),
    ('"body": "Kawan kecil yang bijak, hidup di dalam telefon anda.' + NL + 'Jom siapkan persediaan - hanya ambil seminit."',
     '"body": "Kawan kecil yang bijak, hidup di dalam telefon anda — bersembang, melukis, bermain, cerita, pengembaraan.' + NL + 'Jom siapkan persediaan — hanya ambil seminit."'),
    ('"eyebrow": "Selamat datang ke PocketPal"', '"eyebrow": "Selamat datang ke Pocket Chick"'),
    ('"title": "Bila-bila,' + NL + 'Di mana-mana."', '"title": "Lebih daripada' + NL + 'Aplikasi Sembang."'),
    ('"titleAccent": "Bila-bila,"', '"titleAccent": "Aplikasi Sembang."'),
    ('"body": "Pal anda hidup di dalam telefon anda.' + NL + 'Tanpa internet, tanpa isyarat - mereka berfungsi dalam kapal terbang, jauh dari grid, di kampung terpencil."',
     '"body": "Bersembang, melukis gambar, membaca cerita, pengembaraan, bercakap dengan mereka — semuanya dijana terus pada telefon anda. Malah foto yang anda ambil boleh ditambah ketajamannya 4×."'),
    ('"highlight": "Tanpa internet, tanpa isyarat"', '"highlight": "semuanya dijana terus pada telefon anda"'),
    ('"eyebrow": "Ideanya"', '"eyebrow": "Lagi untuk diterokai"'),
    ('"title": "Lebih kecil,' + NL + 'tapi milik anda."', '"title": "Bila-bila,' + NL + 'Di mana-mana."'),
    ('"titleAccent": "Lebih kecil,"', '"titleAccent": "Bila-bila,"'),
    ('"body": "Pal pada telefon anda pantas dan peribadi - tetapi lebih ringan daripada AI Awan. Anggap ia teman saku, bukan pakar serba tahu."',
     '"body": "Tanpa internet, tanpa isyarat, tanpa masalah — di dalam kapal terbang, di dalam lif, di kampung terpencil, pal anda masih berada di sana bersama anda.' + NL + 'Kecil dan tajam, sedikit lebih ringan daripada otak awan yang besar — tetapi pantas, peribadi, dan sentiasa milik anda."'),
    ('"highlight": "pantas dan peribadi"', '"highlight": "Tanpa internet, tanpa isyarat"'),
    ('"eyebrow": "Sekadar makluman"', '"eyebrow": "Sepenuhnya Luar Talian"'),
    ('"body": "Tiada akaun. Tiada awan. Tiada penjejakan. Perbualan anda kekal milik anda."',
     '"body": "Tiada akaun. Tiada awan. Tiada penjejakan. Perbualan dan foto anda kekal milik anda.' + NL + 'Sepenuhnya sumber terbuka — sesiapa sahaja boleh menyemak kod."'),
    ('"subtitleTemplate": "{{name}} berfikir menggunakan model AI kecil pada telefon anda - pilih satu yang sesuai."',
     '"subtitleTemplate": "{{name}} berjalan pada model AI kecil, dan anda boleh bertukar bila-bila masa. Pilih satu yang sesuai dengan telefon anda."'),
]

for old, new in PAIRS:
    c = raw.count(old)
    assert c == 1, "not unique or missing: " + old[:60]
    raw = raw.replace(old, new)

ob = json.loads(raw)["onboarding"]
assert ob["splash"]["brand"] == "Pocket Chick"
assert "4" in ob["screen2"]["body"]
assert "Luar Talian" in ob["screen3"]["eyebrow"]
assert "sumber terbuka" in ob["screen4"]["body"]
assert "bertukar bila-bila masa" in ob["screen6"]["subtitleTemplate"]
assert ob["screen2"]["titleAccent"] == "Aplikasi Sembang."

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print("ms.json onboarding updated OK")
