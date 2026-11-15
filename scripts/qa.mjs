import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doFix = process.argv.includes('--fix');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const [headers, ...records] = rows.filter((cells) => cells.some(Boolean));
  return records.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function decodeHtml(value) {
  return String(value).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'");
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function phoneHref(phone) {
  const digits = normalizePhone(phone);
  return digits.startsWith('8') ? `+7${digits.slice(1)}` : `+${digits}`;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const p of candidates) { if (existsSync(p)) return p; }
  return null;
}

function fileUrl(filePath) {
  const parts = path.resolve(filePath).split(path.sep);
  return 'file:///' + parts.join('/');
}

async function checkScroll(slugs) {
  const chrome = findChrome();
  if (!chrome) return { skipped: true, reason: 'Chrome not found' };
  const userData = path.join(root, 'tools', 'chrome-qa-profile');
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--window-size=360,800', '--remote-debugging-port=0',
    `--user-data-dir=${userData}`,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let wsUrl = '';
  proc.stderr.on('data', (d) => {
    const m = d.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) wsUrl = m[1];
  });
  await new Promise((r) => { const i = setInterval(() => { if (wsUrl) { clearInterval(i); r(); } }, 50); });
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', () => r()));
  const pending = new Map();
  let id = 1;
  let sessionId = null;
  let loaded = false;
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Target.attachedToTarget') sessionId = msg.params.sessionId;
    if (msg.method === 'Page.loadEventFired') loaded = true;
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  function call(method, params = {}, useSession = false) {
    const o = { id: id++, method, params };
    if (useSession && sessionId) o.sessionId = sessionId;
    ws.send(JSON.stringify(o));
    return new Promise((r) => pending.set(o.id, r));
  }
  const overflows = [];
  const timeouts = [];
  const PAGE_TIMEOUT = 15000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const slug of slugs) {
    process.stderr.write(`scroll ${slug}... `);
    sessionId = null;
    loaded = false;
    const create = await call('Target.createTarget', { url: 'about:blank' });
    const targetId = create.result.targetId;
    await call('Target.attachToTarget', { targetId, flatten: true });
    await call('Page.enable', {}, true);
    await call('Runtime.enable', {}, true);
    await call('Page.navigate', { url: fileUrl(path.join(root, 'dist', slug, 'index.html')) }, true);
    const loadPromise = new Promise((r) => { const i = setInterval(() => { if (loaded) { clearInterval(i); r(true); } }, 50); });
    const loadedOk = await Promise.race([loadPromise, sleep(PAGE_TIMEOUT).then(() => false)]);
    if (!loadedOk) {
      process.stderr.write('TIMEOUT\n');
      timeouts.push(slug);
      await call('Target.closeTarget', { targetId }).catch(() => {});
      continue;
    }
    await sleep(200);
    const res = await call('Runtime.evaluate', {
      expression: 'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      returnByValue: true,
    }, true);
    const diff = Number(res.result.result.value);
    process.stderr.write(diff > 0 ? `SCROLL +${diff}px\n` : 'ok\n');
    if (diff > 0) overflows.push({ slug, diff });
    await call('Target.closeTarget', { targetId });
  }
  ws.close();
  proc.kill();
  return { skipped: false, overflows, timeouts };
}

async function main() {
  const contentDir = path.join(root, 'content');
  const researchDir = path.join(root, 'data', 'research');
  const distDir = path.join(root, 'dist');
  const csvRows = parseCsv(await readFile(path.join(root, 'data', 'businesses.csv'), 'utf8'));
  const files = (await readdir(contentDir)).filter((f) => f.endsWith('.json')).sort();
  const issues = [];
  const fixed = [];

  for (const file of files) {
    const slug = path.basename(file, '.json');
    const contentPath = path.join(contentDir, file);
    const researchPath = path.join(researchDir, file);
    const htmlPath = path.join(distDir, slug, 'index.html');
    const content = JSON.parse(await readFile(contentPath, 'utf8'));
    const research = JSON.parse(await readFile(researchPath, 'utf8').catch(() => '{}'));
    const csv = csvRows.find((r) => r.slug === slug) || {};
    const html = await readFile(htmlPath, 'utf8').catch(() => '');
    if (!html) { issues.push({ slug, problem: 'dist page missing', status: 'осталось' }); continue; }

    const robots = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i)?.[0] || '';
    if (!robots.toLowerCase().includes('noindex') || !robots.toLowerCase().includes('nofollow')) {
      issues.push({ slug, problem: 'meta robots not noindex,nofollow', status: 'осталось' });
    }
    if (!html.includes('Демо-концепт')) {
      issues.push({ slug, problem: 'demo badge missing', status: 'осталось' });
    }

    const telLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/g)].map((m) => m[1]);
    const expectedHref = phoneHref(csv.phone || research.phone);
    for (const tel of telLinks) {
      if (normalizePhone(tel) !== normalizePhone(expectedHref)) {
        issues.push({ slug, problem: `tel mismatch: ${tel} vs ${expectedHref}`, status: 'осталось' });
      }
    }

    const researchAddr = research.address || '';
    const expectedAddr = researchAddr ? `Уфа, ${researchAddr}` : '';
    const routeMatch = html.match(/href=["'](https:\/\/yandex\.ru\/maps\/\?text=[^"']+)["']/);
    const mapMatch = html.match(/src=["'](https:\/\/yandex\.ru\/map-widget\/v1\/\?text=[^"']+)&amp;z=16["']/);
    if (routeMatch && expectedAddr) {
      const decoded = decodeURIComponent(routeMatch[1].split('text=')[1]);
      if (decoded !== expectedAddr) issues.push({ slug, problem: `route address mismatch: ${decoded}`, status: 'осталось' });
    }
    if (mapMatch && expectedAddr) {
      const decoded = decodeURIComponent(mapMatch[1].split('text=')[1]);
      if (decoded !== expectedAddr) issues.push({ slug, problem: `map address mismatch: ${decoded}`, status: 'осталось' });
    }

    const priceEntries = (research.prices || []).map((p) => JSON.stringify([p.name, p.price]));
    const priceNumbers = new Set((research.prices || []).map((p) => p.price));
    const hero = [...html.matchAll(/class=["']hero-price["'][\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<strong>от ([\d\s]+) ₽<\/strong>/g)];
    const list = [...html.matchAll(/class=["']price-name["'](?:[^>]*?)>([^<]+)<\/span>[\s\S]*?class=["']price-value["'][\s\S]*?от(?:<\/span>)?\s+([\d\s]+) ₽/g)];
    const showcase = [...html.matchAll(/class=["']product-card-copy["'][\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?class=["']product-price["'][\s\S]*?от(?:<\/span>)?\s+([\d\s]+) ₽/g)];
    const featuredSource = content.featured_price?.source;
    for (const m of hero) {
      const label = decodeHtml(m[1].trim());
      const price = parseInt(m[2].replace(/\s/g, ''), 10);
      const ok = featuredSource && priceEntries.includes(JSON.stringify([featuredSource, price]));
      if (!ok) issues.push({ slug, problem: `hero price not in research: ${label} от ${price} ₽`, status: 'осталось' });
    }
    for (const m of list) {
      const name = decodeHtml(m[1].trim());
      const price = parseInt(m[2].replace(/\s/g, ''), 10);
      if (!priceEntries.includes(JSON.stringify([name, price]))) {
        issues.push({ slug, problem: `price list item not in research: ${name} от ${price} ₽`, status: 'осталось' });
      }
    }
    for (const m of showcase) {
      const name = decodeHtml(m[1].trim());
      const price = parseInt(m[2].replace(/\s/g, ''), 10);
      if (!priceEntries.includes(JSON.stringify([name, price]))) {
        issues.push({ slug, problem: `showcase price not in research: ${name} от ${price} ₽`, status: 'осталось' });
      }
    }
    for (const m of html.matchAll(/от(?:\s*<[^>]+>)*\s*(\d[\d\s]*)\s*₽/g)) {
      const price = parseInt(m[1].replace(/\s/g, ''), 10);
      if (!priceNumbers.has(price)) {
        issues.push({ slug, problem: `generic price phrase от ${price} ₽ not from research`, status: 'осталось' });
      }
    }

    if (content.featured_price?.source) {
      const priceNames = new Set((research.prices || []).map((p) => p.name));
      if (!priceNames.has(content.featured_price.source)) {
        issues.push({ slug, problem: `featured_price.source not in research prices: ${content.featured_price.source}`, status: 'осталось' });
      }
    }

    if (content.review_summary && !research.review_summary) {
      if (doFix) {
        delete content.review_summary;
        await writeFile(contentPath, `${JSON.stringify(content, null, ' ')}\n`);
        fixed.push(slug);
      } else {
        issues.push({ slug, problem: 'review_summary in content but missing in research data', status: 'исправить' });
      }
    }

    const sections = [...html.matchAll(/<section[^>]*aria-labelledby=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/g)];
    for (const m of sections) {
      const headingId = m[1];
      const inner = m[2];
      const heading = inner.match(new RegExp(`id=["']${headingId}["'][^>]*>([^<]+)`, 'i'))?.[1] || headingId;
      const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const withoutHeading = text.replace(heading, '').trim();
      if (!withoutHeading) issues.push({ slug, problem: `empty section: ${heading}`, status: 'осталось' });
    }
  }

  const scroll = await checkScroll(files.map((f) => path.basename(f, '.json')));
  if (scroll.skipped) {
    issues.push({ slug: '*', problem: `scroll check skipped: ${scroll.reason}`, status: 'осталось' });
  } else {
    for (const slug of (scroll.timeouts || [])) {
      issues.push({ slug, problem: 'scroll check page load timeout', status: 'осталось' });
    }
    for (const o of scroll.overflows) {
      issues.push({ slug: o.slug, problem: `horizontal scroll on 360px (+${o.diff}px)`, status: 'осталось' });
    }
  }

  const report = { total: files.length, issues, fixed };
  console.log(JSON.stringify(report, null, ' '));
}

main().catch((e) => { console.error(e); process.exit(1); });
