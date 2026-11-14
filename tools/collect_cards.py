"""
collect_cards.py - дособирает данные карточек 2ГИС в data/research/{slug}.json.

Зачем: FetchURL в 2ГИС отдаёт антибот-заглушку, поэтому данные (адрес, район,
услуги, цены, отзывы, фото "от владельца") добираются этим скриптом.

Механика (по HUB-GUIDE: "обычные запросы 2ГИС заворачивает на антибот,
а браузер пускает" + "чистый путь - API 2ГИС"):
- карточка открывается в headed Chrome (проходит антибот), адрес и район
  извлекаются из встроенного в страницу JSON;
- цены, отзывы и фотоальбом "От владельца" - через открытые API,
  которые использует сам сайт (проверены, ключи публичные).

Правила кита сохранены:
- ничего не выдумывается: нет данных - поле пустое и попадает в missing;
- фото только из альбома "От владельца" (без превью организации -> без баннеров 2ГИС);
- отзывы - только текст и оценка, без имён авторов;
- пересказ (review_points) и претензии (complaints) скрипт НЕ пишет:
  сырые тексты кладутся в reviews_raw, а пересказ делает агент следующим шагом.

Запуск:
  python tools/collect_cards.py             # все slug с незаполненным address
  python tools/collect_cards.py --force     # все, даже заполненные
  python tools/collect_cards.py --slugs jobnjoy,iris
  python tools/collect_cards.py --limit 10  # первые N
Прерванный прогон можно просто запустить заново: заполненные пропускаются.
"""
import argparse
import csv
import json
import random
import re
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
RESEARCH = BASE / "data" / "research"
PHOTOS = BASE / "data" / "photos"
CSV_PATH = BASE / "data" / "businesses.csv"

KEY_REVIEWS = "6e7e1929-4ea9-4a5d-8c05-d601860389bd"
KEY_PHOTO = "gYu1s9N1wP"

SOCIAL_RE = re.compile(
    r"(vk\.com|vk\.ru|taplink|2gis\.|instagram\.|t\.me|wa\.me|whatsapp|ok\.ru|"
    r"youtube\.|yandex\.ru/maps|yandex\.ru/profile|dikidi|yclients|avito\.ru)",
    re.I,
)
RE_ADDRESS = re.compile(r'"address_name":"((?:[^"\\]|\\.)+)"')
RE_DISTRICT = re.compile(r'"name":"([^"]*(?:ский район|ский р-н|микрорайон| м-н)[^"]*)"')
RE_COMPONENTS = re.compile(r'"components":\[([^\]]+)\]')


def clean_json_str(s):
    return s.encode().decode("unicode_escape", errors="ignore") if "\\" in s else s


def extract_address(html, name):
    """address_name есть у большинства карточек; у части - только components."""
    m = RE_ADDRESS.search(html)
    if m:
        return clean_json_str(m.group(1))
    anchor = html.find(f'"primary":"{name[:20]}')
    seg = html[anchor:] if anchor >= 0 else html
    cm = RE_COMPONENTS.search(seg)
    if not cm:
        return None
    parts = []
    for entry in re.findall(r"\{([^{}]+)\}", cm.group(1)):
        try:
            d = json.loads("{" + entry + "}")
        except ValueError:
            continue
        t = d.get("type", "")
        if t == "street_number":
            parts.append(f"{d.get('street', '')} {d.get('number', '')}".strip().strip(","))
        elif t in ("settlement", "village", "city", "living_area") and (d.get("name") or d.get("settlement_name")):
            parts.append(d.get("name") or d.get("settlement_name"))
    addr = ", ".join(p for p in parts if p)
    return addr or None


def firm_id(url):
    m = re.search(r"/firm/(\d+)", url or "")
    return m.group(1) if m else None


def card_url(url, fid):
    return f"https://2gis.ru/ufa/firm/{fid}"


def jfetch(page, url):
    """GET в контексте страницы 2gis.ru: origin и cookies как у сайта."""
    res = page.evaluate(
        """async (u) => {
            const r = await fetch(u, {credentials: 'include'});
            return {status: r.status, body: await r.text()};
        }""",
        url,
    )
    if res["status"] != 200:
        return None
    try:
        return json.loads(res["body"])
    except ValueError:
        return None


def download_photo(url, dest):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(req, timeout=30) as r:
            data = r.read()
    except Exception:
        return False
    if len(data) < 20 * 1024:  # правило кита: файл меньше 20 КБ - не берём
        return False
    dest.write_bytes(data)
    return True


def collect_one(page, slug, rec):
    fid = firm_id(rec.get("source_url", ""))
    if not fid:
        return "нет source_url"

    # --- карточка: адрес и район из встроенного в страницу JSON ---
    page.goto(card_url(rec.get("source_url", ""), fid), wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(6000)
    if "captcha" in page.url:
        return "капча"
    html = page.content()
    if "2GIS Captcha" in html or "подтвердите, что вы не робот" in html:
        return "капча"

    addr = extract_address(html, rec.get("name", ""))
    if not addr:
        return "адрес не найден в HTML"
    rec["address"] = addr
    if not rec.get("district"):
        d = RE_DISTRICT.search(html)
        if d:
            rec["district"] = d.group(1)

    # --- цены (market-backend, открытый API) ---
    prices = []
    pj = jfetch(
        page,
        f"https://market-backend.api.2gis.ru/5.0/product/items_by_branch"
        f"?branch_id={fid}&locale=ru_RU&page=1&page_size=50",
    )
    for it in (pj or {}).get("result", {}).get("items") or []:
        prod = it.get("product") or {}
        name = (prod.get("name") or "").strip()
        price = (it.get("offer") or {}).get("price")
        if name and price:
            prices.append({"name": name[:80], "price": int(price)})
    rec["prices"] = prices[:15]

    # услуги: имена ценников, без повторов
    services = []
    for s in [p["name"] for p in prices]:
        if s and s not in services:
            services.append(s)
    rec["services"] = services[:12]

    # --- отзывы (только текст + оценка, без имён) ---
    rv = jfetch(
        page,
        f"https://public-api.reviews.2gis.com/3.0/branches/{fid}/reviews"
        f"?key={KEY_REVIEWS}&locale=ru_RU&page=1&page_size=12",
    )
    raw = []
    for r in (rv or {}).get("reviews") or []:
        text = (r.get("text") or "").strip()
        if text:
            raw.append({"rating": r.get("rating"), "text": text[:500]})
    if raw:
        rec["reviews_raw"] = raw

    # --- фото: ТОЛЬКО альбом "От владельца" ---
    ph = jfetch(
        page,
        f"https://api.photo.2gis.com/3.0/objects/{fid}/albums/owner/media"
        f"?key={KEY_PHOTO}&page_size=20&locale=ru_RU",
    )
    folder = PHOTOS / slug
    folder.mkdir(parents=True, exist_ok=True)
    got = 0
    for itm in (ph or {}).get("items") or []:
        if got >= 3:
            break
        url = ((itm.get("photo") or {}).get("url") or "")
        if not url:
            continue
        if download_photo(url, folder / f"{got + 1}.jpg"):
            got += 1
    if got:
        (folder / "source.txt").write_text(
            f"{rec.get('source_url', '')}\nисточник: от владельца (album owner, api.photo.2gis.com)\n",
            encoding="utf-8",
        )
    rec["photos_count"] = got

    # --- missing: пересчитываем честно ---
    missing = []
    for f in ("address", "district", "email", "services", "prices", "payment",
              "amenities", "review_points", "complaints"):
        if not rec.get(f):
            missing.append(f)
    if not got:
        missing.append("photos")
    if not rec.get("reviews_raw"):
        missing.append("reviews_raw")
    rec["missing"] = missing
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--slugs", default="")
    args = ap.parse_args()

    recs = {}
    for p in sorted(RESEARCH.glob("*.json")):
        try:
            recs[p.stem] = json.loads(p.read_text(encoding="utf-8"))
        except ValueError:
            print(f"пропуск {p.name}: битый JSON", file=sys.stderr)

    if args.slugs:
        wanted = [s.strip() for s in args.slugs.split(",") if s.strip()]
        recs = {k: v for k, v in recs.items() if k in wanted}
    if not args.force:
        recs = {k: v for k, v in recs.items() if not v.get("address")}
    if args.limit:
        recs = dict(list(recs.items())[: args.limit])
    if not recs:
        print("нечего собирать")
        return

    print(f"к собору: {len(recs)} карточек", flush=True)
    profile = tempfile.mkdtemp(prefix="collect_2gis_")
    p = sync_playwright().start()
    ctx = p.chromium.launch_persistent_context(
        profile, channel="chrome", headless=False,
        args=["--disable-blink-features=AutomationControlled"],
    )
    page = ctx.pages[0]
    page.goto("https://2gis.ru/ufa", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(5000)

    fails_row = 0
    done = failed = 0
    for slug, rec in recs.items():
        err = None
        try:
            err = collect_one(page, slug, rec)
        except Exception as e:
            err = f"ошибка: {e}"
        if err:
            failed += 1
            fails_row += 1
            print(f"[{done + failed}/{len(recs)}] {slug}: ПРОПУСК - {err}", flush=True)
            if fails_row >= 5:
                print("пять неудач подряд - стоп, похоже на капчу. Подожди и запусти снова.")
                break
        else:
            fails_row = 0
            done += 1
            (RESEARCH / f"{slug}.json").write_text(
                json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"[{done + failed}/{len(recs)}] {slug}: ок "
                  f"(цены {len(rec.get('prices', []))}, фото {rec.get('photos_count', 0)}, "
                  f"missing {len(rec.get('missing', []))})", flush=True)
        time.sleep(random.uniform(3.0, 6.0))

    ctx.close()
    p.stop()

    # photos_count -> businesses.csv
    if CSV_PATH.exists():
        with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
            fields = list(rows[0].keys()) if rows else []
        changed = False
        for row in rows:
            pj = RESEARCH / f"{row.get('slug', '')}.json"
            if pj.exists():
                try:
                    cnt = json.loads(pj.read_text(encoding="utf-8")).get("photos_count", 0)
                except ValueError:
                    continue
                if row.get("photos_count") != str(cnt):
                    row["photos_count"] = str(cnt)
                    changed = True
        if changed and fields:
            with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(f, fieldnames=fields)
                w.writeheader()
                w.writerows(rows)
            print("photos_count обновлён в data/businesses.csv")

    print(f"готово: собрано {done}, пропущено {failed}")


if __name__ == "__main__":
    main()
