# PLAN
Город: Уфа. Ниши: автосервисы, магазины цветов.
Источник бизнесов: "local businesses.md".

- [ ] 0 Настройка: AGENTS.md, агенты, структура
- [x] 1 Сбор базы (parser-2gis-new + tools/no_site_leads.py или вручную) — avtoservis.csv 386 строк, cvety.csv 215 строк; 80 лидов в local businesses.md
- [~] 2 Данные: 80 research-файлов (x3 biz-researcher параллельно) + data/businesses.csv собраны; FetchURL блокируется 2ГИС (страница "браузер устарел") — адрес/район/услуги/цены/отзывы/соцсети не собраны, нужен photo-collector с браузером или ручное дополнение
- [ ] 2.5 Фото: photo-collector (1 агент, браузер)
- [ ] 3 Эталон + контрольная страница (slug: ..., ...)
- [ ] 4 Рой: page-writer x3
- [ ] 5 Проверка: qa-checker
- [ ] 6 Витрина + деплой (ссылки в data/businesses.csv → page_url)
- [ ] 7 Продажи: sales/pipeline.csv

Заметки для видео / кейса:
