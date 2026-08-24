# -*- coding: utf-8 -*-
import json, io

PATH = "src/locales/he.json"
raw = io.open(PATH, encoding="utf-8").read()
NL = chr(92) + "n"  # literal backslash-n as it appears in the JSON file

PAIRS = [
    ('"brand": "PocketPal"', '"brand": "Pocket Chick"'),
    ('"body": "חברים קטנים וחכמים שגרים בתוך הטלפון שלכם.' + NL + 'בואו נסדר לכם הכל - זה ייקח רק רגע."',
     '"body": "חברים קטנים וחכמים שגרים בתוך הטלפון שלכם — צ\u05f3אט, ציור, משחקים, סיפורים, הרפתקאות.' + NL + 'בואו נסדר לכם הכל — זה ייקח רק רגע."'),
    ('"eyebrow": "ברוכים הבאים ל-PocketPal"', '"eyebrow": "ברוכים הבאים ל-Pocket Chick"'),
    ('"title": "בכל זמן,' + NL + 'בכל מקום."', '"title": "יותר מ-' + NL + 'אפליקציית צ\u05f3אט."'),
    ('"titleAccent": "בכל זמן,"', '"titleAccent": "אפליקציית צ\u05f3אט."'),
    ('"body": "ה-pals שלכם גרים בתוך הטלפון.' + NL + 'בלי אינטרנט, בלי קליטה - הם עובדים במטוס, מחוץ לרשת, בכפרים מרוחקים."',
     '"body": "צ\u05f3אט, ציור תמונות, קריאת סיפורים, הרפתקאות, שיחות איתם — הכל נוצר ממש בתוך הטלפון. אפילו תמונות שאתם מצלמים אפשר להגדיל 4× בחדות."'),
    ('"highlight": "בלי אינטרנט, בלי קליטה"', '"highlight": "הכל נוצר ממש בתוך הטלפון"'),
    ('"eyebrow": "הרעיון"', '"eyebrow": "עוד לגלות"'),
    ('"title": "קטנים יותר,' + NL + 'אבל שלכם."', '"title": "בכל זמן,' + NL + 'בכל מקום."'),
    ('"titleAccent": "קטנים יותר,"', '"titleAccent": "בכל זמן,"'),
    ('"body": "ה-pals בטלפון שלכם מהירים ופרטיים - אבל קלים יותר מ-AI בענן. תחשבו עליהם כחבר בכיס, לא כאורקל יודע-כל."',
     '"body": "בלי אינטרנט, בלי קליטה, בלי בעיה — במטוס, במעלית, בכפר מרוחק, ה-pals שלכם עדיין שם איתכם.' + NL + 'קטנים וחריפים, טיפה קלים יותר ממוחות הענן הגדולים — אבל מהירים, פרטיים ותמיד שלכם."'),
    ('"highlight": "מהירים ופרטיים"', '"highlight": "בלי אינטרנט, בלי קליטה"'),
    ('"eyebrow": "שימו לב"', '"eyebrow": "לגמרי במצב לא מקוון"'),
    ('"body": "בלי חשבונות. בלי ענן. בלי מעקב. השיחות שלכם נשארות שלכם."',
     '"body": "בלי חשבונות. בלי ענן. בלי מעקב. השיחות והתמונות שלכם נשארות שלכם.' + NL + 'בקוד פתוח לגמרי — כל אחד יכול לבדוק את הקוד."'),
    ('"subtitleTemplate": "{{name}} חושב בעזרת מודל AI קטן בטלפון שלכם - בחרו אחד שמתאים."',
     '"subtitleTemplate": "{{name}} פועל על מודל AI קטן, ואפשר להחליף בכל עת. בחרו אחד שמתאים לטלפון שלכם."'),
]

for old, new in PAIRS:
    c = raw.count(old)
    assert c == 1, "not unique or missing: " + old[:60]
    raw = raw.replace(old, new)

ob = json.loads(raw)["onboarding"]
assert ob["splash"]["brand"] == "Pocket Chick"
assert "4" in ob["screen2"]["body"]
assert "לא מקוון" in ob["screen3"]["eyebrow"]
assert "קוד פתוח" in ob["screen4"]["body"]
assert "להחליף בכל עת" in ob["screen6"]["subtitleTemplate"]
assert ob["screen2"]["titleAccent"] == "אפליקציית צ\u05f3אט."

io.open(PATH, "w", encoding="utf-8", newline="\n").write(raw)
print("he.json onboarding updated OK")
