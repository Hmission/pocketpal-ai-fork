# -*- coding: utf-8 -*-
import json, io

PATH = "src/locales/id.json"
raw = io.open(PATH, encoding="utf-8").read()
NL = chr(92) + "n"  # literal backslash-n as it appears in the JSON file

PAIRS = [
    ('"brand": "PocketPal"', '"brand": "Pocket Chick"'),
    ('"body": "Teman-teman kecil pintar yang tinggal di dalam ponsel Anda.' + NL + 'Mari kita siapkan - akan memakan waktu sebentar."',
     '"body": "Teman-teman kecil pintar yang tinggal di dalam ponsel Anda — mengobrol, menggambar, bermain, cerita, petualangan.' + NL + 'Mari kita siapkan — ini akan memakan waktu sebentar."'),
    ('"eyebrow": "Selamat Datang di PocketPal"', '"eyebrow": "Selamat Datang di Pocket Chick"'),
    ('"title": "Kapan Saja,' + NL + 'Di Mana Saja."', '"title": "Lebih dari' + NL + 'Aplikasi Obrolan."'),
    ('"titleAccent": "Kapan Saja,"', '"titleAccent": "Aplikasi Obrolan."'),
    ('"body": "Pal Anda tinggal di dalam ponsel Anda.' + NL + 'Tanpa internet, tanpa sinyal - mereka bekerja di pesawat, di luar jaringan, di desa terpencil."',
     '"body": "Mengobrol, menggambar gambar, membaca cerita, petualangan, berbicara dengan mereka — semuanya dihasilkan langsung di ponsel Anda. Bahkan foto yang Anda ambil dapat diperbesar 4× lebih tajam."'),
    ('"highlight": "Tanpa internet, tanpa sinyal"', '"highlight": "semuanya dihasilkan langsung di ponsel Anda"'),
    ('"eyebrow": "Konsepnya"', '"eyebrow": "Lebih Banyak Lagi"'),
    ('"title": "Lebih Kecil,' + NL + 'tapi Milik Anda."', '"title": "Kapan Saja,' + NL + 'Di Mana Saja."'),
    ('"titleAccent": "Lebih Kecil,"', '"titleAccent": "Kapan Saja,"'),
    ('"body": "Pal di ponsel Anda cepat dan pribadi - namun lebih ringan dari AI Cloud. Anggap saja teman saku, bukan oracle yang tahu segalanya."',
     '"body": "Tanpa internet, tanpa sinyal, tanpa masalah — di pesawat, di lift, di desa terpencil, pal Anda tetap di sana bersama Anda.' + NL + 'Kecil dan tajam, sedikit lebih ringan dari otak besar cloud — tapi cepat, pribadi, dan selalu milik Anda."'),
    ('"highlight": "cepat dan pribadi"', '"highlight": "Tanpa internet, tanpa sinyal"'),
    ('"eyebrow": "Peringatan"', '"eyebrow": "Sepenuhnya Offline"'),
    ('"body": "Tanpa akun. Tanpa cloud. Tanpa pelacakan. Percakapan Anda tetap milik Anda."',
     '"body": "Tanpa akun. Tanpa cloud. Tanpa pelacakan. Percakapan dan foto Anda tetap milik Anda.' + NL + 'Sepenuhnya sumber terbuka — siapa saja dapat memeriksa kode."'),
    ('"subtitleTemplate": "{{name}} berpikir menggunakan model AI kecil di ponsel Anda — pilih yang cocok."',
     '"subtitleTemplate": "{{name}} berjalan pada model AI kecil, dan Anda dapat beralih kapan saja. Pilih yang cocok untuk ponsel Anda."'),
]

for old, new in PAIRS:
    c = raw.count(old)
    assert c == 1, "not unique or missing: " + old[:60]
    raw = raw.replace(old, new)

ob = json.loads(raw)["onboarding"]
assert ob["splash"]["brand"] == "Pocket Chick"
assert "4" in ob["screen2"]["body"]
assert "Sepenuhnya Offline" in ob["screen3"]["eyebrow"]
assert "sumber terbuka" in ob["screen4"]["body"]
assert "beralih kapan saja" in ob["screen6"]["subtitleTemplate"]
assert ob["screen2"]["titleAccent"] == "Aplikasi Obrolan."

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print("id.json onboarding updated OK")
