# `rusttop-suggest-proxy` — Cloudflare Worker

Принимает POST с формы «Предложить билдера» на сайте, проверяет Cloudflare Turnstile, ограничивает по IP (3 заявки в час, 10 в сутки), и постит готовый embed в приватный Discord-канал через webhook.

Webhook URL и Turnstile secret хранятся в env-секретах Worker'а — в публичный HTML они не попадают.

## Что нужно один раз сделать

### 1. Зарегаться в Cloudflare и поставить wrangler

```bash
npm install -g wrangler
wrangler login
```

(`wrangler login` откроет браузер для OAuth — войди в свой Cloudflare-аккаунт.)

### 2. Получить ключи Cloudflare Turnstile

1. https://dash.cloudflare.com/?to=/:account/turnstile
2. **Add site** → имя любое (например `rust-builders`)
3. Hostname: `paradox-iq.github.io` (можно добавить `localhost` для теста)
4. Widget mode: **Managed** (рекомендую) или **Invisible**
5. Получишь **Site Key** (публичный, в HTML) и **Secret Key** (приватный, в Worker)

### 3. Создать KV namespace для rate-limit

```bash
cd worker
wrangler kv:namespace create RATE_LIMIT
```

В выводе будет `id = "..."`. Скопируй и подставь в `wrangler.toml` вместо `REPLACE_WITH_KV_ID`.

### 4. Зашить секреты

```bash
cd worker
wrangler secret put DISCORD_WEBHOOK_URL
# вставляешь полный URL https://discord.com/api/webhooks/.../...

wrangler secret put TURNSTILE_SECRET_KEY
# вставляешь Secret Key из шага 2
```

### 5. Установить зависимости и задеплоить

```bash
cd worker
npm install
npm run typecheck    # на всякий случай — проверка типов
npm run deploy       # деплоит Worker
```

После `wrangler deploy` ты увидишь URL вида:

```
https://rusttop-suggest-proxy.<your-subdomain>.workers.dev
```

Скопируй его.

### 6. Подставить URL Worker'а и Turnstile site key в `index.html`

В корне репо открой `index.html` и найди две константы:

```js
const SUGGEST_WORKER_URL = '';        // <— сюда URL из шага 5
const SUGGEST_TURNSTILE_SITE_KEY = ''; // <— сюда site key из шага 2
```

Запушь изменения в `main` и GitHub Pages обновится.

## Локальный тест Worker'а

```bash
cd worker
wrangler dev   # поднимает Worker на http://localhost:8787
```

Можно postman'ом или curl'ом дёрнуть:

```bash
curl -X POST http://localhost:8787 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","youtube":"https://youtube.com/@test","note":"тестовое описание длиной больше 20 символов","turnstileToken":"test"}'
```

Без реального Turnstile-токена ответит `403 captcha_failed` — это ожидаемо.

## Что меняется если хочешь

- **Лимиты:** константы `HOUR_LIMIT` / `DAY_LIMIT` в `src/index.ts`
- **CORS-origin:** `ALLOWED_ORIGIN` в `wrangler.toml` (если хостишь не на github.io)
- **Цвет embed:** `ACCENT_COLOR` в `src/index.ts`
- **Отключить Turnstile (только для дебага!):** убрать вызов `verifyTurnstile` и поле `turnstileToken` из валидации

## Что делать если случился спам

1. Открой https://dash.cloudflare.com → Workers → `rusttop-suggest-proxy` → Logs
2. Если конкретный IP флудит — добавь его в KV-блокировку (можно расширить Worker)
3. Удалить webhook в Discord и создать новый, обновить секрет:
   ```bash
   wrangler secret put DISCORD_WEBHOOK_URL
   ```
   Существующий деплой подхватит новый секрет на следующем запросе, фронтенд менять не надо.
