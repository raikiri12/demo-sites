import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SLUGS = [
  'shino-master', 'greenbell', 'zhanetta', 'yanacvetok', 'webstar',
  'vetvi', 'vagservice', 'tvoybuket', 'tutprolubov', 'toylex',
  'tm-motors', 'teamavto', 'storiscvety', 'stolichny', 'stebelyok',
  'starter102', 'sisters', 'shaman', 'set100', 'servisplus'
];

const summaries = {
  'shino-master': {
    review_points: ['Быстрое и качественное обслуживание', 'Отсутствие очередей', 'Компетентные и ответственные мастера', 'Доступные цены'],
    complaints: []
  },
  greenbell: {
    review_points: ['Оперативная доставка букетов в другие города', 'Свежие и красивые цветы', 'Приятные цены', 'Внимательный персонал и флорист'],
    complaints: ['Некоторые покупатели жалуются, что розы быстро вянут', 'Претензии по качеству цветов не всегда принимаются']
  },
  zhanetta: {
    review_points: ['Большой выбор цветов в просторном холодильнике', 'Приятный и профессиональный персонал', 'Демократичные цены', 'Экзотические цветы и необычные сочетания', 'Дают советы по уходу за букетом'],
    complaints: ['Встречаются замечания к упаковке и свежести отдельных цветов']
  },
  yanacvetok: {
    review_points: ['Потрясающие цветы и композиции', 'Удобное удалённое согласование заказа', 'Быстрая сборка и доставка', 'Присылают фото букета перед отправкой', 'Внимательный и вежливый персонал'],
    complaints: []
  },
  webstar: {
    review_points: ['Грамотный подход к сложному ремонту', 'Цены обсуждаются и не меняются после работ', 'Запчасти привозят оперативно', 'Не навязывают лишних услуг', 'Адекватные цены и квалифицированные специалисты'],
    complaints: []
  },
  vetvi: {
    review_points: ['Высокий уровень обслуживания', 'Тщательная и удобная упаковка букетов', 'Свежие и долго стоящие цветы', 'Приемлемые цены', 'Надёжная доставка'],
    complaints: []
  },
  vagservice: {
    review_points: ['Сложный ремонт выполняют очень быстро', 'Профессиональная диагностика и прошивка', 'Рекомендуют владельцам VAG', 'Качество работы и обслуживания на высоком уровне'],
    complaints: ['По мнению одного клиента, ремонт прокладки ГБЦ оказался неполным при высокой стоимости']
  },
  tvoybuket: {
    review_points: ['Свежие цветы, которые долго стоят', 'Вежливые флористы и хороший сервис', 'Разумные цены и помощь с выбором', 'Удобная доставка', 'Оригинальные и красивые композиции'],
    complaints: ['Отдельные покупатели остаются не впечатлены букетом']
  },
  tutprolubov: {
    review_points: ['Красивые и свежие букеты по приемлемым ценам', 'Приветливый и вежливый персонал', 'Цветы долго стоят', 'Уютное оформление магазина', 'Быстрая сборка композиций'],
    complaints: []
  },
  toylex: {
    review_points: ['Быстрая и профессиональная диагностика', 'Оперативно устраняют неисправности', 'Дружелюбный персонал', 'Предоставляют гарантию на работу'],
    complaints: []
  },
  'tm-motors': {
    review_points: ['Качественно выполняют ТО и ремонт', 'Не навязывают лишних деталей', 'Мастера вежливые и всё объясняют', 'Быстрое выполнение работ', 'Двигатель работает заметно лучше'],
    complaints: []
  },
  teamavto: {
    review_points: ['Быстрый и аккуратный шиномонтаж', 'Приятные цены без скрытых доплат', 'Скидки постоянным клиентам', 'Запись по времени без очереди', 'Порядочные и вежливые мастера'],
    complaints: []
  },
  storiscvety: {
    review_points: ['Приятный и отзывчивый персонал', 'Свежие и красивые цветы', 'Доступные цены', 'Быстрое обслуживание'],
    complaints: []
  },
  stolichny: {
    review_points: ['Профессиональная диагностика VAG, Porsche и Mercedes', 'Решают сложные проблемы, с которыми не справились другие', 'Быстрый и качественный ремонт', 'Адекватные итоговые цены', 'Продуманный сервис от диагностики до подбора запчастей'],
    complaints: ['Шиномонтаж и балансировку колёс большого радиуса не всегда выполняют качественно']
  },
  stebelyok: {
    review_points: ['Недорогие и красивые цветы', 'Добрый и отзывчивый продавец', 'Уютная студия с широким ассортиментом', 'Свежие букеты долго стоят', 'Помогают подобрать подходящий букет'],
    complaints: []
  },
  starter102: {
    review_points: ['Специализация на ремонте стартеров и генераторов', 'Запчасти в наличии', 'Нормальные цены', 'Быстрый и качественный ремонт', 'Мастер подробно объясняет причины неисправности'],
    complaints: []
  },
  sisters: {
    review_points: ['Уютная цветочная лавка', 'Быстро и качественно собирают букеты', 'Удобная доставка точно ко времени', 'Шары и цветы в одном месте', 'Свежие цветы и красивые букеты'],
    complaints: []
  },
  shaman: {
    review_points: ['Быстрый и качественный ремонт двигателя', 'Запчасти быстро подбирают и доставляют', 'Мастера знают своё дело', 'Решают сложные проблемы с ходовой частью'],
    complaints: []
  },
  set100: {
    review_points: ['Удобная запись на шиномонтаж без очередей', 'Предлагают сезонное хранение колёс', 'Аккуратная работа с контролем момента затяжки и балансировкой', 'Свой магазин запчастей', 'Квалифицированные и вежливые специалисты'],
    complaints: []
  },
  servisplus: {
    review_points: ['Качественное развал-схождение', 'Мастер предупреждает о будущих заменах', 'Ведут историю обращений клиента', 'Адекватные цены', 'Можно записаться в день обращения'],
    complaints: []
  }
};

const tracked = ['email', 'services', 'prices', 'payment', 'amenities', 'review_points', 'complaints', 'review_summary'];

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function updateMissing(data) {
  const missing = [];
  for (const field of tracked) {
    if (field in data && isEmpty(data[field])) missing.push(field);
  }
  if (data.photos_count === 0) missing.push('photos');
  missing.sort();
  return missing;
}

const rows = [];

for (const slug of SLUGS) {
  const file = join('data', 'research', `${slug}.json`);
  const raw = await readFile(file, 'utf8');
  const data = JSON.parse(raw);
  const summary = summaries[slug];

  data.review_points = summary.review_points;
  data.complaints = summary.complaints;
  delete data.reviews_raw;
  data.missing = updateMissing(data);

  await writeFile(file, JSON.stringify(data, null, 1) + '\n', 'utf8');
  rows.push({ slug, count: data.review_points.length, hasComplaints: data.complaints.length > 0 ? 'да' : 'нет' });
}

console.log('| slug | review_points count | complaints (да/нет) |');
console.log('|---|---|---|');
for (const row of rows) {
  console.log(`| ${row.slug} | ${row.count} | ${row.hasComplaints} |`);
}
