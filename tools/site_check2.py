# -*- coding: utf-8 -*-
"""Допроверка оставшихся 28 бизнесов с большими паузами."""
import json, urllib.parse, urllib.request, re, time, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SKIP = re.compile(r'(2gis|yandex|zoon|avito|vk\.com|vkvideo|ok\.ru|instagram|facebook|taplink|t\.me|telegram|youtube|wa\.me|whatsapp|wikipedia|find-org|spark-interfax|list-org|sbis|rusprofile)', re.I)

def ddg(query):
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', 'Accept-Language': 'ru-RU,ru;q=0.9'})
    html = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
    links = re.findall(r'uddg=([^"&]+)', html)
    out = []
    for l in links:
        u = urllib.parse.unquote(l)
        m = re.search(r'https?://([^/]+)', u)
        if m:
            out.append((m.group(1).lower(), u))
    return out

todo = json.load(open('site_check.json', encoding='utf-8'))
pending = [s for s, v in todo.items() if v.get('error')]
print(f'допроверяю: {len(pending)}')
import glob, os
names = {}
for f in glob.glob('data/research/*.json'):
    d = json.load(open(f, encoding='utf-8'))
    names[os.path.basename(f)[:-5]] = (d['name'], d['niche'])

for i, slug in enumerate(pending):
    name, niche = names[slug]
    for attempt in range(3):
        try:
            links = ddg(f'"{name}" Уфа {niche}')
            break
        except Exception as e:
            err = str(e)
            time.sleep(10)
    else:
        print(f'{slug}: НЕ УДАЛОСЬ ({err})')
        continue
    sites = {}
    for dom, url in links[:10]:
        sites.setdefault(dom, url)
    interesting = {d: u for d, u in sites.items() if not SKIP.search(d)}
    todo[slug] = {'name': name, 'all_domains': list(sites), 'candidate': interesting}
    print(f'[{i+1}/{len(pending)}] {slug} ({name}): {list(interesting) if interesting else "чисто"}')
    time.sleep(7)

json.dump(todo, open('site_check.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('Сохранено')
