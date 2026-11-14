# -*- coding: utf-8 -*-
"""Проверка 80 бизнесов на наличие собственного сайта через DuckDuckGo."""
import json, glob, os, re, time, urllib.parse, urllib.request, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SKIP = re.compile(r'(2gis|yandex|zoon|avito|vk\.com|vkvideo|ok\.ru|instagram|facebook|taplink|t\.me|telegram|youtube|wa\.me|whatsapp|wikipedia|pochta|irecommend|flamp|yell|blizko|pulsec|tipler|local?)', re.I)
# домены-агрегаторы, где бизнес может просто быть упомянут
DIR = re.compile(r'(2gis|zoon|avito|yandex\.ru/maps|flamp|yell|blizko|pulsec|tipler|продажа|catalog)', re.I)

def ddg(query):
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'})
    try:
        html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', 'ignore')
    except Exception as e:
        return None, str(e)
    # ссылки вида uddg=<url>
    links = re.findall(r'uddg=([^"&]+)', html)
    out = []
    for l in links:
        u = urllib.parse.unquote(l)
        m = re.search(r'https?://([^/]+)', u)
        if m:
            out.append((m.group(1).lower(), u))
    return out, None

results = {}
todo = []
for f in sorted(glob.glob('data/research/*.json')):
    d = json.load(open(f, encoding='utf-8'))
    todo.append((os.path.basename(f)[:-5], d['name'], d['niche']))

for i, (slug, name, niche) in enumerate(todo):
    q = f'"{name}" Уфа {niche}'
    links, err = ddg(q)
    if links is None:
        print(f'[{i+1}/80] {slug}: ОШИБКА {err}')
        results[slug] = {'name': name, 'error': err}
        time.sleep(3)
        continue
    sites = {}
    for dom, url in links[:10]:
        sites.setdefault(dom, url)
    interesting = {d: u for d, u in sites.items() if not SKIP.search(d)}
    results[slug] = {'name': name, 'all_domains': list(sites), 'candidate': interesting}
    flag = ' <== САЙТ?' if interesting else ''
    print(f'[{i+1}/80] {slug} ({name}): {list(interesting) if interesting else "чисто"}{flag}')
    time.sleep(1.2)

json.dump(results, open('site_check.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('Сохранено: site_check.json')
