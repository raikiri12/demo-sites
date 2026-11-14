"""
no_site_leads.py - превращает выгрузку parser-2gis-new (CSV) в готовый "local businesses.md".

Оставляет только бизнесы БЕЗ своего сайта (ссылки на ВК, Taplink, 2ГИС и т.п. сайтом не считаются),
с рейтингом и отзывами не ниже порога. Часы работы берёт из выгрузки.

Запуск:
  python no_site_leads.py export.csv --niche "автосервис" --min-rating 4.5 --min-reviews 30 --limit 40 -o "local businesses.md"
"""
import argparse
import csv
import re
import sys

NOT_A_SITE = re.compile(
    r"(vk\.com|vk\.ru|taplink|2gis\.|instagram\.|t\.me|wa\.me|whatsapp|ok\.ru|youtube\.|"
    r"yandex\.ru/maps|yandex\.ru/profile|dikidi|yclients|avito\.ru|drom\.ru|tilda\.ws)",
    re.I,
)


def to_float(v):
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--niche", required=True, help="как подписать нишу в строке, например 'автосервис'")
    ap.add_argument("--min-rating", type=float, default=4.5)
    ap.add_argument("--min-reviews", type=int, default=20)
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("-o", "--out", default="local businesses.md")
    a = ap.parse_args()

    with open(a.csv_path, encoding="utf-8-sig", newline="") as f:
        if f.readline().lower().startswith("sep="):
            data_start = f.tell()
        else:
            data_start = 0
        sample = f.read(4096)
        f.seek(data_start)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        rows = list(csv.DictReader(f, dialect=dialect))

    if not rows:
        sys.exit("CSV пустой")

    site_cols = [c for c in rows[0] if c.lower().startswith("веб-сайт")]
    phone_cols = [c for c in rows[0] if c.lower().startswith("телефон")]

    leads = []
    seen = set()
    for r in rows:
        url = (r.get("2GIS URL") or "").strip()
        name = (r.get("Наименование") or "").strip()
        if not url or name.lower() in seen:
            continue
        sites = [r[c].strip() for c in site_cols if r.get(c, "").strip()]
        real_sites = [s for s in sites if not NOT_A_SITE.search(s)]
        if real_sites:
            continue
        rating = to_float(r.get("Рейтинг"))
        reviews = int(to_float(r.get("Количество отзывов")))
        if rating < a.min_rating or reviews < a.min_reviews:
            continue
        phone = next((r[c].strip() for c in phone_cols if r.get(c, "").strip()), "")
        hours = (r.get("Часы работы") or "").strip()
        seen.add(name.lower())
        leads.append((rating, reviews, url, name, phone, hours, bool(sites)))

    leads.sort(key=lambda x: (x[0], x[1]), reverse=True)
    leads = leads[: a.limit]

    with open(a.out, "a", encoding="utf-8") as f:
        for rating, reviews, url, name, phone, hours, has_social in leads:
            note = "без сайта, есть только соцсети/карточки" if has_social else "без сайта"
            line = f"{url} - {a.niche} \"{name}\", {note}. Рейтинг {rating} ({reviews} оценок)."
            if phone:
                line += f" Тел: {phone}."
            if hours:
                line += f" Часы: {hours}"
            f.write(line + "\n")

    print(f"Готово: {len(leads)} бизнесов -> {a.out}")


if __name__ == "__main__":
    main()
