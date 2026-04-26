/**
 * Cloudflare Worker that proxies builder-suggestion submissions from the
 * static site to a Discord webhook.
 *
 * Pipeline:
 *   1. CORS preflight
 *   2. Validate Cloudflare Turnstile token (server-side siteverify)
 *   3. Per-IP rate limit via KV (3/hour, 10/day)
 *   4. Validate & normalize payload
 *   5. Build Discord embed and POST to the webhook
 *
 * Secrets / bindings (configured via wrangler):
 *   - DISCORD_WEBHOOK_URL  (secret) — full Discord webhook URL
 *   - TURNSTILE_SECRET_KEY (secret) — Turnstile siteverify secret
 *   - ALLOWED_ORIGIN       (var)    — site origin allowed to POST (CORS)
 *   - RATE_LIMIT           (kv)     — KV namespace for per-IP counters
 */

export interface Env {
  DISCORD_WEBHOOK_URL: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGIN: string;
  RATE_LIMIT: KVNamespace;
}

interface SuggestPayload {
  type: 'suggest';
  name: string;
  youtube: string;
  format?: string;
  lang?: string;
  note: string;
  contact?: string;
  formatLabel?: string;
  langLabel?: string;
  turnstileToken: string;
}

interface ReviewPayload {
  type: 'review';
  rating: number;
  comment: string;
  contact?: string;
  agree?: string;
  agreeLabel?: string;
  turnstileToken: string;
}

type Payload = SuggestPayload | ReviewPayload;

const HOUR_LIMIT = 3;
const DAY_LIMIT = 10;
const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 60 * 60 * 24;

const ACCENT_COLOR = 0xc8a96e;

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
): Promise<boolean> {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  form.append('remoteip', ip);
  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: form },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

interface RateLimitDecision {
  allowed: boolean;
  reason?: 'hour' | 'day';
  retryAfterSeconds?: number;
}

async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
): Promise<RateLimitDecision> {
  const now = Math.floor(Date.now() / 1000);
  const hourBucket = Math.floor(now / HOUR_SECONDS);
  const dayBucket = Math.floor(now / DAY_SECONDS);
  const hourKey = `h:${ip}:${hourBucket}`;
  const dayKey = `d:${ip}:${dayBucket}`;

  const [hourRaw, dayRaw] = await Promise.all([
    kv.get(hourKey),
    kv.get(dayKey),
  ]);
  const hourCount = parseInt(hourRaw ?? '0', 10);
  const dayCount = parseInt(dayRaw ?? '0', 10);

  if (hourCount >= HOUR_LIMIT) {
    const retry = (hourBucket + 1) * HOUR_SECONDS - now;
    return { allowed: false, reason: 'hour', retryAfterSeconds: retry };
  }
  if (dayCount >= DAY_LIMIT) {
    const retry = (dayBucket + 1) * DAY_SECONDS - now;
    return { allowed: false, reason: 'day', retryAfterSeconds: retry };
  }
  return { allowed: true };
}

async function bumpRateLimit(kv: KVNamespace, ip: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const hourBucket = Math.floor(now / HOUR_SECONDS);
  const dayBucket = Math.floor(now / DAY_SECONDS);
  const hourKey = `h:${ip}:${hourBucket}`;
  const dayKey = `d:${ip}:${dayBucket}`;

  const [hourRaw, dayRaw] = await Promise.all([
    kv.get(hourKey),
    kv.get(dayKey),
  ]);
  const hourCount = parseInt(hourRaw ?? '0', 10);
  const dayCount = parseInt(dayRaw ?? '0', 10);

  await Promise.all([
    kv.put(hourKey, String(hourCount + 1), {
      expirationTtl: (hourBucket + 1) * HOUR_SECONDS - now + 5,
    }),
    kv.put(dayKey, String(dayCount + 1), {
      expirationTtl: (dayBucket + 1) * DAY_SECONDS - now + 5,
    }),
  ]);
}

function clampStr(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed;
}

function validateSuggest(r: Record<string, unknown>): SuggestPayload | null {
  const name = clampStr(r.name, 80);
  const youtube = clampStr(r.youtube, 200);
  const note = clampStr(r.note, 600);
  const contact = clampStr(r.contact, 120);
  const format = clampStr(r.format, 32);
  const lang = clampStr(r.lang, 32);
  const formatLabel = clampStr(r.formatLabel, 64);
  const langLabel = clampStr(r.langLabel, 64);
  const turnstileToken = clampStr(r.turnstileToken, 4096);
  if (name.length < 2) return null;
  if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(youtube)) return null;
  if (note.length < 20) return null;
  if (!turnstileToken) return null;
  return {
    type: 'suggest',
    name,
    youtube,
    format,
    lang,
    note,
    contact,
    formatLabel,
    langLabel,
    turnstileToken,
  };
}

function validateReview(r: Record<string, unknown>): ReviewPayload | null {
  const ratingNum = typeof r.rating === 'number' ? r.rating
    : typeof r.rating === 'string' ? parseFloat(r.rating)
    : NaN;
  if (!Number.isFinite(ratingNum)) return null;
  const rating = Math.max(0, Math.min(10, Math.round(ratingNum)));
  // Discord embed field values are capped at 1024 chars; clamp here so we
  // never produce a webhook the API will reject with HTTP 400.
  const comment = clampStr(r.comment, 1000);
  const contact = clampStr(r.contact, 120);
  const agree = clampStr(r.agree, 32);
  const agreeLabel = clampStr(r.agreeLabel, 64);
  const turnstileToken = clampStr(r.turnstileToken, 4096);
  if (comment.length < 10) return null;
  if (!turnstileToken) return null;
  return { type: 'review', rating, comment, contact, agree, agreeLabel, turnstileToken };
}

function validatePayload(raw: unknown): Payload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = typeof r.type === 'string' ? r.type : 'suggest';
  if (type === 'review') return validateReview(r);
  return validateSuggest(r);
}

function buildSuggestEmbed(p: SuggestPayload, ip: string): unknown {
  const fields = [
    { name: 'YouTube', value: p.youtube, inline: false },
    {
      name: 'Формат / Format',
      value: p.formatLabel || p.format || '—',
      inline: true,
    },
    {
      name: 'Язык / Language',
      value: p.langLabel || p.lang || '—',
      inline: true,
    },
    { name: 'Описание / Note', value: p.note, inline: false },
    {
      name: 'Контакт автора / Submitter contact',
      value: p.contact || '—',
      inline: false,
    },
    { name: 'IP', value: `\`${ip}\``, inline: true },
  ];
  return {
    username: 'Rust Builders — Suggestions',
    embeds: [
      {
        title: `🆕 ${p.name}`,
        url: p.youtube,
        color: ACCENT_COLOR,
        fields,
        footer: {
          text: 'Submitted via paradox-iq.github.io/RustTopBuilders',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function buildReviewEmbed(p: ReviewPayload, ip: string): unknown {
  const stars = '★'.repeat(Math.round(p.rating / 2)).padEnd(5, '☆');
  const fields = [
    {
      name: 'Оценка / Rating',
      value: `**${p.rating}/10**  ${stars}`,
      inline: true,
    },
    {
      name: 'Согласие / Verdict',
      value: p.agreeLabel || p.agree || '—',
      inline: true,
    },
    { name: 'Отзыв / Comment', value: p.comment, inline: false },
    {
      name: 'Контакт автора / Submitter contact',
      value: p.contact || '—',
      inline: false,
    },
    { name: 'IP', value: `\`${ip}\``, inline: true },
  ];
  // Color shifts from red (low) to gold (high) based on rating.
  const color = p.rating >= 7 ? ACCENT_COLOR : p.rating >= 4 ? 0xa39061 : 0xb35a4d;
  return {
    username: 'Rust Builders — Reviews',
    embeds: [
      {
        title: `📝 Отзыв о таблице — ${p.rating}/10`,
        color,
        fields,
        footer: {
          text: 'Review via paradox-iq.github.io/RustTopBuilders',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function buildEmbed(p: Payload, ip: string): unknown {
  return p.type === 'review' ? buildReviewEmbed(p, ip) : buildSuggestEmbed(p, ip);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405, origin);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400, origin);
    }

    const payload = validatePayload(raw);
    if (!payload) {
      return jsonResponse({ error: 'invalid_payload' }, 400, origin);
    }

    const captchaOk = await verifyTurnstile(
      payload.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      ip,
    );
    if (!captchaOk) {
      return jsonResponse({ error: 'captcha_failed' }, 403, origin);
    }

    const rate = await checkRateLimit(env.RATE_LIMIT, ip);
    if (!rate.allowed) {
      return jsonResponse(
        {
          error: 'rate_limited',
          reason: rate.reason,
          retryAfterSeconds: rate.retryAfterSeconds,
        },
        429,
        origin,
      );
    }

    const embed = buildEmbed(payload, ip);
    const discordRes = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });
    if (!discordRes.ok) {
      return jsonResponse(
        { error: 'discord_error', status: discordRes.status },
        502,
        origin,
      );
    }

    // Bump per-IP counters only after a successful Discord delivery so failed
    // webhooks don't burn the user's allowance. KV is eventually consistent —
    // a small race window remains, but this is much fairer than the previous
    // bump-before-send behaviour.
    await bumpRateLimit(env.RATE_LIMIT, ip);

    return jsonResponse({ ok: true }, 200, origin);
  },
};
