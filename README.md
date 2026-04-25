# Rust Top Builders

Личный авторский гид по билдерам Rust: рейтинги, кастомные базы, ссылки на каналы и платный контент. Только активные авторы (инактив < 2 мес).

**🌐 Live:** https://paradox-iq.github.io/RustTopBuilders/

---

## RU

Сайт-справочник по билдерам Rust: 50+ карточек с оценкой, ссылками, описанием стиля, форматом баз и наличием платного контента.

### Что внутри

- **Шкала оценок** — пятизвёздочная, шаг **0.25** (★, ¼, ½, ¾, ☆). Все оценки субъективны и являются моим личным мнением.
- **Методика** — раскрывашка `// как я оцениваю` под шапкой. Объясняет, по каким осям сравниваю билдеров.
- **Глоссарий** — раскрывашка с 12 терминами (floor stack, китайка, опен кор, бункер и т.д.) для тех, кто только в теме.
- **Кастомные базы** — отдельный блок с теми, кто принимает заказы.
- **Фильтры** — по формату (соло/трио/медиум/клан), языку (RU/EN), наличию платного контента.
- **Сортировки** — по рейтингу, по имени, «сначала с платным контентом».
- **Билингва** — сайт полностью переведён, переключатель RU/EN сверху справа.
- **Тёмная и светлая темы** — переключатель ☾/☼ рядом с языком.

### Как предложить билдера

- Discord: **gamunkul8515**
- Или через issue в этом репозитории

В сообщении по возможности приложи: ник канала, ссылки (YouTube/Discord/Patreon), пару последних видео с интересными базами, формат баз (соло / клан / кастом).

### Локальный запуск

Это статический сайт без билда:

```bash
git clone https://github.com/Paradox-IQ/RustTopBuilders.git
cd RustTopBuilders
python3 -m http.server 8000
# открой http://localhost:8000
```

Весь код — в одном `index.html` (HTML + CSS + JS + данные). Никаких зависимостей.

### Структура данных

Билдеры хранятся в массиве `raw` внутри `<script>`-тега. Формат:

```js
["Имя","@handle", ratingValue, upkeepTier, isFavorite, "tag1,tag2,...", "format1,format2,...",
  [["Стиль","RU значение","EN значение","good|warn|bad"], ...],
  "RU описание",
  "EN описание",
  [["Имя ссылки","https://url"], ...]
]
```

Языковая принадлежность настраивается отдельно в `builderLangs` (по умолчанию `['en']`).

---

## EN

Author's curated guide to Rust builders: ratings, custom-base providers, channel links and paid content. Active channels only (inactive < 2 months).

### What's inside

- **Rating scale** — 5 stars with **0.25 step** (★, ¼, ½, ¾, ☆). All ratings are subjective personal opinions.
- **Methodology** — `// how i rate` accordion under the header. Explains the axes used to compare builders.
- **Glossary** — 12-term accordion (floor stack, china wall, open core, bunker, etc.) for newcomers.
- **Custom bases** — dedicated block listing builders who accept commissions.
- **Filters** — by format (solo/trio/medium/clan), language (RU/EN), paid-content availability.
- **Sorts** — by rating, by name, "paid-first".
- **Bilingual** — fully translated, RU/EN switcher in the top-right.
- **Dark and light themes** — ☾/☼ toggle next to the language switcher.

### Suggest a builder

- Discord: **gamunkul8515**
- Or open an issue in this repository

Please include: channel name, links (YouTube/Discord/Patreon), a couple of recent videos with notable bases, base formats (solo / clan / custom).

### Local run

Static site, no build step:

```bash
git clone https://github.com/Paradox-IQ/RustTopBuilders.git
cd RustTopBuilders
python3 -m http.server 8000
# open http://localhost:8000
```

Everything lives in a single `index.html` (HTML + CSS + JS + data). Zero dependencies.
