# -*- coding: utf-8 -*-
"""Дочистка через Bing: цветы — site:flowwow.com/shop + общий; авто — общий."""
import json, glob, os, re, time, urllib.parse, urllib.request, io, sys, random
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

AGGR = re.compile(r'(2gis|yandex|zoon|avito|vk\.com|vkvideo|ok\.ru|instagram|facebook|taplink|t\.me|telegram|youtube|wa\.me|whatsapp|wikipedia|pochta|irecommend|flamp|yell|blizko|pulsec|tipler|orgs\.biz|drive2|topdvr|find-org|spark-interfax)', re.I)
UA = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36']

def bing(query):
    url = 'https://www.bing.com/search?q=' + urllib.parse.quote(query) + '&count=15&setlang=ru'
    req = urllib.request.Request(url, headers={'User-Agent': random.choice(UA), 'Accept-Language': 'ru-RU,ru;q=0.9'})
    try:
        h = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
    except Exception as e:
        return None, str(e)
    links = []
    for m in re.finditer(r'<h2[^>]*><a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', h, re.S):
        u, t = m.group(1), re.sub(r'<[^>]+>', '', m.group(2))
        d = re.search(r'https?://([^/]+)', u)
        if d:
            links.append((d.group(1).lower(), u, t))
    return {'links': links[:15]}, None

rc = json.load(open('recheck.json', encoding='utf-8')) if os.path.exists('recheck.json') else {}
todo = []
for f in sorted(glob.glob('data/research/*.json')):
    slug = os.path.basename(f)[:-5]
    d = json.load(open(f, encoding='utf-8'))
    e = rc.get(slug, {'name': d['name'], 'niche': d['niche'], 'checks': []})
    bad = any('error' in c or 'candidate' not in c for c in e['checks'])
    # цветам с чистым flowwow-чеком общий чек не нужен
    if slug not in rc or bad:
        todo.append((slug, d['name'], d['niche'], e))

print(f'дочистка: {len(todo)} бизнесов')
for i, (slug, name, niche, entry) in enumerate(todo):
    is_flowers = 'цвет' in (niche or '')
    queries = []
    if is_flowers:
        queries.append(f'site:flowwow.com/shop "{name}" Уфа')
    queries.append(f'"{name}" Уфа {niche}')
    for q in queries:
        r, err = bing(q)
        if r is None:
            entry['checks'] = [c for c in entry['checks'] if c.get('q') != q]
            entry['checks'].append({'q': q, 'error': err})
            print(f'[{i+1}/{len(todo)}] {slug}: ОШИБКА {err}')
        else:
            fw = [(d, u) for d, u, _ in r['links'] if 'flowwow' in d]
            cand = [(d, u) for d, u, _ in r['links'] if not AGGR.search(d) and 'flowwow' not in d]
            entry['checks'] = [c for c in entry['checks'] if c.get('q') != q]
            entry['checks'].append({'q': q, 'candidate': cand, 'flowwow': fw})
            mark = ' <== FLOWWOW' if fw else (' <== САЙТ?' if cand else '')
            print(f'[{i+1}/{len(todo)}] {slug} [{q[:40]}]: fw={len(fw)} свои={[d for d,_ in cand]}{mark}')
        rc[slug] = entry
        json.dump(rc, open('recheck.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        time.sleep(2.2)
print('Готово')
