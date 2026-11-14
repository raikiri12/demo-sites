# PLAN
Город: Уфа. Ниши: автосервисы, магазины цветов.
Источник бизнесов: "local businesses.md".

- [ ] 0 Настройка: AGENTS.md, агенты, структура
- [x] 1 Сбор базы (parser-2gis-new + tools/no_site_leads.py или вручную) — avtoservis.csv 386 строк, cvety.csv 215 строк; 80 лидов в local businesses.md
- [x] 2 Данные: 80 research-файлов + data/businesses.csv собраны; карточки добраны tools/collect_cards.py (headed Chrome + API 2ГИС, вне квоты агентов): 80/80 адрес+район+отзывы, 52 с ценами, 73 с фото (216 jpg)
- [x] 2.5 Фото: собраны collect_cards.py — только owner-альбом, max 3, source.txt; фото "превью организации" (баннеры 2ГИС) не использовать
- [ ] 3 Эталон + контрольная страница (slug: ..., ...)
- [ ] 4 Рой: page-writer x3
- [ ] 5 Проверка: qa-checker
- [ ] 6 Витрина + деплой (ссылки в data/businesses.csv → page_url)
- [ ] 7 Продажи: sales/pipeline.csv

Заметки для видео / кейса:
