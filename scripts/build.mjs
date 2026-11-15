import { readdir, readFile, mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedSlugs = process.argv.slice(2);
const money = new Intl.NumberFormat('ru-RU');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((cells) => cells.some(Boolean));
  return records.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function parseTemplate(template) {
  const root = [];
  const stack = [{ name: null, children: root }];
  const tokens = /{{\s*([#/]?)([\w.]+)\s*}}/g;
  let cursor = 0;

  for (const match of template.matchAll(tokens)) {
    const [token, marker, name] = match;
    const current = stack.at(-1).children;
    current.push(template.slice(cursor, match.index));
    cursor = match.index + token.length;

    if (marker === '#') {
      const node = { name, children: [] };
      current.push(node);
      stack.push(node);
    } else if (marker === '/') {
      const open = stack.pop();
      if (!open || open.name !== name) throw new Error(`Несбалансированный блок шаблона: ${name}`);
    } else {
      current.push({ variable: name });
    }
  }

  stack.at(-1).children.push(template.slice(cursor));
  if (stack.length !== 1) throw new Error(`Незакрытый блок шаблона: ${stack.at(-1).name}`);
  return root;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

function renderNodes(nodes, context) {
  let output = '';
  for (const node of nodes) {
    if (typeof node === 'string') {
      output += node;
    } else if (node.variable) {
      output += escapeHtml(context[node.variable]);
    } else {
      const value = context[node.name];
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          const child = item && typeof item === 'object' ? { ...context, ...item } : { ...context, '.': item };
          output += renderNodes(node.children, child);
        }
      } else {
        const child = typeof value === 'object' ? { ...context, ...value } : context;
        output += renderNodes(node.children, child);
      }
    }
  }
  return output;
}

function formatPhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length !== 11) return phone;
  const local = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
  return `+7 (${local.slice(1, 4)}) ${local.slice(4, 7)}-${local.slice(7, 9)}-${local.slice(9, 11)}`;
}

function phoneHref(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.startsWith('8') ? `+7${digits.slice(1)}` : `+${digits}`;
}

function pluralizeRatings(count) {
  const value = Number(count);
  const mod100 = value % 100;
  const mod10 = value % 10;
  let word = 'оценок';
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = 'оценка';
    else if (mod10 >= 2 && mod10 <= 4) word = 'оценки';
  }
  return `${money.format(value)} ${word}`;
}

function minutes(time) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function currentStatus(hours) {
  if (!hours) return '';
  if (/круглосуточно/i.test(hours)) return 'Открыто круглосуточно';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const now = Number(get('hour')) * 60 + Number(get('minute'));
  const dayNames = { вс: 0, пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6 };

  for (const segment of hours.split(';')) {
    const dayText = segment.split(/\d{1,2}:\d{2}/)[0].toLowerCase();
    const days = new Set();
    for (const match of dayText.matchAll(/(пн|вт|ср|чт|пт|сб|вс)\s*[-–]\s*(пн|вт|ср|чт|пт|сб|вс)/g)) {
      const start = dayNames[match[1]];
      const end = dayNames[match[2]];
      for (let day = start; ; day = (day + 1) % 7) {
        days.add(day);
        if (day === end) break;
      }
    }
    for (const match of dayText.matchAll(/пн|вт|ср|чт|пт|сб|вс/g)) days.add(dayNames[match[0]]);
    if (!days.has(dayIndex)) continue;

    if (/выходной/i.test(segment)) return 'Сегодня выходной';
    const interval = segment.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!interval) return segment.trim();
    const [, opens, closes] = interval;
    if (now < minutes(opens)) return `Откроется в ${opens}`;
    if (now < minutes(closes)) return `Открыто до ${closes}`;
    return 'Сегодня закрыто';
  }

  return 'Сегодня выходной';
}

const socialTypes = {
  vk: 'VK',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

async function processPhotos(slug, name, outputDir) {
  const inputDir = path.join(root, 'data', 'photos', slug);
  let files = [];
  try {
    files = (await readdir(inputDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.(jpe?g|png)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .slice(0, 10);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (!files.length) return [];

  const assetsDir = path.join(outputDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  const photos = [];

  for (const [index, file] of files.entries()) {
    const source = path.join(inputDir, file);
    const filename = `photo-${index + 1}.webp`;
    await sharp(source)
      .rotate()
      .resize({ width: 640, height: 480, fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(path.join(assetsDir, filename));
    photos.push({
      src: `assets/${filename}`,
      alt: `${name}: фото ${index + 1}`,
      loading: index < 3 ? '' : 'lazy',
    });
  }

  await sharp(path.join(inputDir, files[0]))
    .rotate()
    .resize({ width: 1600, height: 1200, fit: 'cover', position: 'attention' })
    .webp({ quality: 84 })
    .toFile(path.join(assetsDir, 'hero.webp'));

  return photos;
}

async function buildPage(slug, csvRows, template, css) {
  const csv = csvRows.find((row) => row.slug === slug);
  if (!csv) throw new Error(`${slug}: нет строки в data/businesses.csv`);

  const [research, content] = await Promise.all([
    readFile(path.join(root, 'data', 'research', `${slug}.json`), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'content', `${slug}.json`), 'utf8').then(JSON.parse),
  ]);
  const business = { ...csv, ...research };
  const outputDir = path.join(root, 'dist', slug);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const photos = await processPhotos(slug, business.name, outputDir);
  const prices = (business.prices ?? []).filter((item) => item?.name && Number.isFinite(item.price)).map((item) => ({
    name: item.name,
    price: money.format(item.price),
  }));
  const featured = content.featured_price
    ? (business.prices ?? []).find((item) => item.name === content.featured_price.source)
    : null;
  const featuredPrice = featured && Number.isFinite(featured.price) ? {
    label: content.featured_price.label || featured.name,
    price: money.format(featured.price),
  } : null;
  const reviewPoints = (business.review_points ?? []).filter(Boolean).slice(0, 3).map((text, index) => ({
    number: String(index + 1).padStart(2, '0'),
    text,
  }));
  const address = business.address || '';
  const phone = business.phone || '';
  const rating = business.rating === '' || business.rating == null ? null : Number(business.rating);
  const ratingStars = rating == null ? [] : Array.from({ length: 5 }, (_, index) => ({
    fill: `${Math.round(Math.max(0, Math.min(1, rating - index)) * 100)}%`,
  }));
  const ratingsCount = business.ratings_count ?? business.reviews_count ?? csv.reviews_count;
  const socials = (business.socials ?? [])
    .filter((item) => socialTypes[item?.type] && typeof item.url === 'string' && /^https?:\/\//.test(item.url))
    .map((item) => ({
      url: item.url,
      label: socialTypes[item.type],
      is_vk: item.type === 'vk',
      is_whatsapp: item.type === 'whatsapp',
      is_telegram: item.type === 'telegram',
    }));
  const hasAddress = Boolean(address);
  const hasPhone = Boolean(phone);
  const hours = (business.hours || '').split(';').map((item) => item.trim()).filter(Boolean);
  const mapAddress = encodeURIComponent(`Уфа, ${address}`);
  const reviewSummary = content.review_summary || business.review_summary || '';
  const theme = business.niche === 'магазин цветов' ? 'flowers' : 'auto';
  const selectedShowcasePhotos = Array.isArray(content.showcase_photo_indexes)
    ? content.showcase_photo_indexes.map((index) => photos[index - 1]).filter(Boolean)
    : photos;
  const showcaseProducts = theme === 'flowers'
    ? (business.prices ?? []).filter((item) => item?.name && Number.isFinite(item.price))
    : [];
  const showcaseItems = selectedShowcasePhotos.length
    ? showcaseProducts.map((item, index) => {
      const photo = selectedShowcasePhotos[index % selectedShowcasePhotos.length];
      return {
        index,
        name: item.name,
        search_name: item.name.toLocaleLowerCase('ru'),
        price_raw: item.price,
        price: money.format(item.price),
        image: photo.src,
        alt: `${business.name}: фото из открытой карточки организации`,
        is_more: index >= 8,
      };
    })
    : [];
  const stats = theme === 'flowers'
    ? [
      { key: 'rating', label: 'Рейтинг' },
      { key: 'ratings_count', label: 'Оценок' },
      { key: 'reviews_count', label: 'Отзывов' },
    ]
      .filter(({ key }) => research[key] !== '' && research[key] != null && Number.isFinite(Number(research[key])))
      .map(({ key, label }) => ({
        value: key === 'rating' ? String(research[key]).replace('.', ',') : String(research[key]),
        label,
      }))
    : [];
  const description = [content.tagline, business.district, address && `Уфа, ${address}`].filter(Boolean).join('. ');

  const data = {
    ...business,
    theme,
    theme_color: theme === 'flowers' ? '#203c33' : '#10191f',
    title: `${business.name} — ${business.niche} в Уфе`,
    description,
    tagline: content.tagline || '',
    watermark: content.watermark || (theme === 'flowers' ? 'FLOWERS' : 'SERVICE'),
    hero_class: photos.length ? 'hero--photo' : 'hero--typographic',
    has_hero_photo: photos.length > 0,
    hero_image: photos.length ? 'assets/hero.webp' : '',
    has_photos: photos.length > 0,
    photos: photos.slice(0, 3),
    photo_credit: photos.length > 0,
    status_badge: currentStatus(business.hours),
    featured_price: featuredPrice,
    has_showcase: showcaseItems.length > 0,
    showcase_items: showcaseItems,
    has_showcase_more: showcaseItems.length > 8,
    has_phone: hasPhone,
    phone_href: hasPhone ? phoneHref(phone) : '',
    phone_display: hasPhone ? formatPhone(phone) : '',
    has_address: hasAddress,
    route_url: hasAddress ? `https://yandex.ru/maps/?text=${mapAddress}` : '',
    map_url: hasAddress ? `https://yandex.ru/map-widget/v1/?text=${mapAddress}&z=16` : '',
    has_stats: stats.length > 0,
    stats,
    has_prices: theme === 'auto' && prices.length > 0,
    prices,
    has_review_points: reviewPoints.length > 0,
    review_points: reviewPoints,
    has_reviews: Boolean(rating != null || reviewSummary),
    has_rating: rating != null,
    rating: rating == null ? '' : String(rating).replace('.', ','),
    rating_stars: ratingStars,
    has_ratings_count: Boolean(ratingsCount),
    ratings_label: ratingsCount ? pluralizeRatings(ratingsCount) : '',
    has_review_summary: Boolean(reviewSummary),
    review_summary: reviewSummary,
    source_url: business.source_url || business.source_links || '',
    has_contact: Boolean(address || hours.length || phone || socials.length),
    has_hours: hours.length > 0,
    hours,
    has_socials: socials.length > 0,
    socials,
    cta_title: content.cta_title || 'Позвоните, чтобы уточнить детали',
  };

  const html = `${renderNodes(template, data).replace(/[ \t]+$/gm, '').trimEnd()}\n`;
  await Promise.all([
    writeFile(path.join(outputDir, 'index.html'), html),
    writeFile(path.join(root, 'dist', 'themes.css'), css),
  ]);
  console.log(`built dist/${slug}/index.html (${photos.length} photos, ${prices.length} prices)`);
}

const slugs = requestedSlugs.length
  ? requestedSlugs
  : (await readdir(path.join(root, 'content'))).filter((file) => file.endsWith('.json')).map((file) => path.basename(file, '.json')).sort();

const [csvText, templateText, themesCss] = await Promise.all([
  readFile(path.join(root, 'data', 'businesses.csv'), 'utf8'),
  readFile(path.join(root, 'templates', 'page.html'), 'utf8'),
  readFile(path.join(root, 'templates', 'themes.css'), 'utf8'),
]);
await mkdir(path.join(root, 'dist'), { recursive: true });
const csvRows = parseCsv(csvText);
const template = parseTemplate(templateText);
for (const slug of slugs) await buildPage(slug, csvRows, template, themesCss);
