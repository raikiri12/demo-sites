# -*- coding: utf-8 -*-
"""Перепроверка лидов: цветы — витрины на flowwow.com + общий поиск; авто — общий поиск."""
import json, glob, os, re, time, urllib.parse, urllib.request, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

AGGR = re.compile(r'(2gis|yandex|zoon|avito|vk\.com|vkvideo|ok\.ru|instagram|facebook|taplink|t\.me|telegram|youtube|wa\.me|whatsapp|wikipedia|pochta|irecommend|flamp|yell|blizko|pulsec|tipler|orgs\.biz|drive2|topdvr)', re.I)

def ddg(query):
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'})
    try:
        h = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
    except Exception as e:
        return None, str(e)
    links = []
    for l in re.findall(r'uddg=([^"&]+)', h):
        u = urllib.parse.unquote(l)
        m = re.search(r'https?://([^/]+)(/\S*)?', u)
        if m:
            links.append((m.group(1).lower(), u))
    # также подхватываем заголовки результатов рядом со ссылками
    titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', h, re.S)
    return {'links': links[:12], 'titles': [re.sub(r'<[^>]+>', '', t) for t in titles[:12]]}, None

results = {}
todo = []
for f in sorted(glob.glob('data/research/*.json')):
    d = json.load(open(f, encoding='utf-8'))
    todo.append((os.path.basename(f)[:-5], d['name'], d['niche']))

total = len(todo)
for i, (slug, name, niche) in enumerate(todo):
    is_flowers = 'цвет' in (niche or '')
    queries = [f'"{name}" Уфа {niche}']
    if is_flowers:
        queries.insert(0, f'site:flowwow.com/shop "{name}"')
    entry = {'name': name, 'niche': niche, 'checks': []}
    for q in queries:
        r, err = ddg(q)
        if r is None:
            entry['checks'].append({'q': q, 'error': err})
            print(f'[{i+1}/{total}] {slug}: ОШИБКА {err}')
        else:
            cand = [(d, u) for d, u in r['links'] if not AGGR.search(d)]
            fw = [(d, u) for d, u in r['links'] if 'flowwow' in d]
            entry['checks'].append({'q': q, 'candidate': cand, 'flowwow': fw, 'titles': r['titles']})
            mark = ' <== ВИТРИНА FLOWWOW' if (fw and is_flowers) else (' <== САЙТ?' if cand else '')
            print(f'[{i+1}/{total}] {slug} [{q[:45]}]: flowwow={len(fw)} свои={ [d for d,_ in cand] }{mark}')
        time.sleep(1.6)
    results[slug] = entry
    json.dump(results, open('recheck.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

print('Сохранено: recheck.json')
