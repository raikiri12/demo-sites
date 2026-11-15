# PLAN
Город: Уфа. Ниши: автосервисы, магазины цветов.
Источник бизнесов: "local businesses.md".

- [ ] 0 Настройка: AGENTS.md, агенты, структура
- [x] 1 Сбор базы (parser-2gis-new + tools/no_site_leads.py или вручную) — avtoservis.csv 386 строк, cvety.csv 215 строк; 80 лидов в local businesses.md
- [x] 1.1 Веб-проверка на сайты/сети — 74 лида (6 исключены в data/excluded/: set100 и yanacvetok со своими сайтами, rozaopt/restorancvetov/rd-service/stolichny — сети)
- [x] 1.2 Повторная проверка витрин на Flowwow (ошибка первого чека: ловил только свои домены) — 13 цветочных исключены (data/excluded/WHY.md), осталось 61 лид; podaricvety исключён, эталон цветов выбирается заново; orhideya проверен — чист; delacvetochnye исключён (бренд на Flowwow)
- [x] 2 Данные: 80 research-файлов + data/businesses.csv собраны; карточки добраны tools/collect_cards.py (headed Chrome + API 2ГИС, вне квоты агентов): 80/80 адрес+район+отзывы, 52 с ценами, 73 с фото (216 jpg)
- [x] 2.5 Фото: собраны collect_cards.py — только owner-альбом, max 10, source.txt; фото "превью организации" (баннеры 2ГИС) не использовать
- [x] 3 Эталон + контрольная страница. Выбраны (обход 74 JSON, критерии кита: offer_type=new, фото>=2, цены, минимум missing, рейтинг x оценки):
  - Эталон авто: **vagservice** (Vag service Ufa) — 5.0 при 154 оценках, 10 фото, 15 цен, 12 услуг, missing только amenities/email/payment (не выводятся на страницу). Резерв: modifikar (5.0, 131, так же 15 цен), jobnjoy (702 оценки, но только 2 цены и 2 услуги — блок цен выглядел бы пустым).
  - Эталон цветы: **magnolia** (Магнолия) — 4.9 при 91 оценке, 10 фото, 15 цен, 12 услуг, соцсети VK/WhatsApp/TG; missing только email/payment/amenities. Ранее был выбран podaricvety, но у него нашлась живая витрина на Flowwow — исключён (см. 1.2).
  - Контрольный (без фото): **avtohelp** — 5.0, 6 цен, отзывы и адрес есть, фото 0 (проверка типографского режима шаблона).
  - Готово: `templates/page.html`, `templates/themes.css`, `scripts/build.mjs`; собраны `dist/vagservice/`, `dist/magnolia/`, `dist/avtohelp/`. Есть мобильные CTA, цены «от», отзывы, карта, noindex и демо-плашка; рейтинг со звёздной шкалой, до 3 фото в Hero с переключением по миниатюрам, без отдельной галереи, реальные ссылки socials. У magnolia — трёхрядная витрина со свайпом, у автониши её нет; контрольный Hero работает без изображений.
- [x] 4 Рой: page-writer x3 — партия 1 (12 страниц): anservis, artnikah, avtoaura, dustershop, fixauto, floks, modifikar, paradise, poehali, remavto, shino-master, zhanetta. Партия 2 (45 страниц) подготовлена тремя page-writer параллельно; `scripts/build.mjs` выполнен, собраны все 60 страниц.
- [ ] 5 Проверка: qa-checker
- [ ] 6 Витрина + деплой (ссылки в data/businesses.csv → page_url)
- [ ] 7 Продажи: sales/pipeline.csv

Заметки для видео / кейса:
