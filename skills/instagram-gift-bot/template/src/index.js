// Instagram gift bot (Instagram API with Instagram Login). Template from github.com/sakouhi92-cell/instagram-gift-bot
// Someone comments a keyword (CLAUDE, كليون...) -> reply under the comment,
// DM "follow me" + button -> real follow check -> gift link. Everything is logged in D1.

import * as M from './messages.js';
import { findGift, isNotReceived, isDeleteRequest, learnableWord, pick } from './text.js';
import { giftPage, privacyPage, deleteDataPage, notFound, setupResultPage } from './pages.js';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const now = () => Date.now();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    env = await withSettings(env);

    if (path === '/setup') return startSetup(env);
    if (path === '/setup/callback') return finishSetup(url, env);
    if (path === '/webhook' && request.method === 'GET') return verifyWebhook(url, env);
    if (path === '/webhook' && request.method === 'POST') return receiveWebhook(request, env, ctx);
    if (path === '/gift') return html(giftPage(env));
    if (path === '/privacy') return html(privacyPage(env));
    if (path === '/delete-data' && request.method === 'POST') return deletionCallback(request, env, url.origin);
    if (path === '/delete-data') return html(deleteDataPage(env, url.searchParams.get('code')));
    if (path === '/') return Response.redirect(`${url.origin}/gift`, 302);
    return html(notFound(), 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(withSettings(env).then(hourly));
  },
};

// ---------- Connection settings (saved by /setup) ----------

async function withSettings(env) {
  const rows = (await env.DB.prepare('SELECT key, value FROM settings').all()).results;
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...env, IG_TOKEN: s.ig_token, IG_USER_ID: s.ig_user_id, TOKEN_REFRESHED_AT: Number(s.ig_token_refreshed_at || 0) };
}

async function saveSetting(env, key, value) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, String(value)).run();
}

// The owner opens /setup -> Instagram login -> /setup/callback saves a long-lived token in D1.
// The token never appears on screen or in chat.
async function startSetup(env) {
  const state = crypto.randomUUID();
  await saveSetting(env, 'oauth_state', `${state}:${now()}`);
  const dialog = new URL('https://www.instagram.com/oauth/authorize');
  dialog.searchParams.set('client_id', env.IG_APP_ID);
  dialog.searchParams.set('redirect_uri', `${env.PUBLIC_URL}/setup/callback`);
  dialog.searchParams.set('response_type', 'code');
  // Same permissions the n8n workflows ran with (Meta refused to add manage_comments to this app on 2026-10-29)
  dialog.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_messages');
  dialog.searchParams.set('state', state);
  return Response.redirect(dialog.toString(), 302);
}

async function finishSetup(url, env) {
  const fail = (msg) => html(setupResultPage(false, msg), 400);
  const saved = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'oauth_state'").first())?.value || '';
  const [state, at] = saved.split(':');
  if (!state || state !== url.searchParams.get('state') || now() - Number(at) > 15 * MIN) return fail('الرابط قديم. عاود حل /setup');
  const code = (url.searchParams.get('code') || '').replace(/#_$/, '');
  if (!code) return fail('ما تمش القبول في إنستغرام');

  try {
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: env.IG_APP_ID, client_secret: env.IG_APP_SECRET, grant_type: 'authorization_code',
        redirect_uri: `${env.PUBLIC_URL}/setup/callback`, code,
      }),
    });
    const short = await shortRes.json();
    if (!short.access_token) throw new Error(`short token: ${JSON.stringify(short)}`);

    const longUrl = new URL('https://graph.instagram.com/access_token');
    longUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longUrl.searchParams.set('client_secret', env.IG_APP_SECRET);
    longUrl.searchParams.set('access_token', short.access_token);
    const long = await (await fetch(longUrl)).json();
    if (!long.access_token) throw new Error(`long token: ${JSON.stringify(long.error || long)}`);

    const meEnv = { ...env, IG_TOKEN: long.access_token };
    const me = await graph(meEnv, 'GET', 'me', { fields: 'user_id,username' });
    if (!me.ok) throw new Error(`me: ${JSON.stringify(me.error)}`);
    if (me.data.username !== env.IG_USERNAME) return fail(`هذا موش @${env.IG_USERNAME}، هذا @${me.data.username}`);

    await saveSetting(env, 'ig_token', long.access_token);
    await saveSetting(env, 'ig_user_id', me.data.user_id);
    await saveSetting(env, 'ig_token_refreshed_at', now());
    await saveSetting(env, 'oauth_state', 'used:0');

    // Ask Instagram to send this account's events to the webhook of this app
    const sub = await graph(meEnv, 'POST', 'me/subscribed_apps?subscribed_fields=comments,messages,messaging_postbacks', {});
    await log(env, 'setup_done', JSON.stringify({ ig: me.data.username, subscribed: sub.ok ? sub.data : sub.error }));
    return html(setupResultPage(true, `@${me.data.username}`, sub.ok && sub.data.success === true));
  } catch (e) {
    await log(env, 'setup_error', String(e.message || e));
    return fail('صار مشكل مع إنستغرام. قول لـ Claude.');
  }
}

// ---------- Webhook ----------

function verifyWebhook(url, env) {
  const ok = url.searchParams.get('hub.mode') === 'subscribe'
    && url.searchParams.get('hub.verify_token') === env.VERIFY_TOKEN;
  return ok ? new Response(url.searchParams.get('hub.challenge')) : new Response('forbidden', { status: 403 });
}

async function receiveWebhook(request, env, ctx) {
  const raw = await request.text();
  const signature = request.headers.get('x-hub-signature-256') || '';
  if (!(await validSignature(raw, signature, env.IG_APP_SECRET))) {
    await log(env, 'bad_signature', null);
    return new Response('bad signature', { status: 401 });
  }
  const body = JSON.parse(raw);
  ctx.waitUntil(handleWebhook(body, env).catch((e) => log(env, 'webhook_error', String(e?.stack || e))));
  return new Response('ok'); // answer Meta fast, work in the background
}

async function handleWebhook(body, env) {
  if (body.object !== 'instagram') return;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'comments') await handleComment(env, change.value, 'webhook');
    }
    for (const event of entry.messaging || []) await handleMessaging(env, event);
  }
}

// ---------- Comments ----------

async function handleComment(env, c, source) {
  const commentId = c.id;
  const igsid = c.from?.id;
  const username = c.from?.username || c.username || null;
  if (!commentId || igsid === env.IG_USER_ID || username === env.IG_USERNAME) return; // our own replies

  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO comments (comment_id, igsid, username, media_id, text, source, handled_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(commentId, igsid || null, username, c.media?.id || null, c.text || '', source, now()).run();
  if (!inserted.meta.changes) return; // already handled (webhook + cron, or Meta retry)

  const learned = Object.fromEntries((await env.DB.prepare('SELECT word, gift FROM keywords').all()).results.map((r) => [r.word, r.gift]));
  const gift = findGift(c.text, learned);
  if (!gift) {
    const word = learnableWord(c.text);
    if (word && igsid) {
      await env.DB.prepare('INSERT OR REPLACE INTO unknown_words (word, igsid, seen_at, hit) VALUES (?, ?, ?, 0)')
        .bind(word, igsid, now()).run();
    }
    return;
  }

  await env.DB.prepare('UPDATE comments SET matched = 1 WHERE comment_id = ?').bind(commentId).run();
  if (igsid) {
    await learnFrom(env, igsid, gift);
    await env.DB.prepare(
      `INSERT INTO users (igsid, username, asked_at, last_seen_at, gift) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(igsid) DO UPDATE SET username = excluded.username, gift = excluded.gift, asked_at = excluded.asked_at`
    ).bind(igsid, username, now(), gift).run();
  }

  // Private reply to the comment opens the DM conversation
  await send(env, 'dm', { comment_id: commentId }, followCard(M.ASK_FOLLOW, gift));
  await send(env, 'comment_reply', commentId, { message: pick(M.COMMENT_REPLIES) });
  await log(env, 'keyword_comment', JSON.stringify({ commentId, username, gift, source }));
}

// Someone wrote an unknown word, then a keyword within 10 minutes: count it.
// When 3 different people did that with the same word, it becomes a keyword for that gift.
async function learnFrom(env, igsid, gift) {
  await env.DB.prepare('UPDATE unknown_words SET hit = 1 WHERE igsid = ? AND seen_at > ?')
    .bind(igsid, now() - 10 * MIN).run();
  const rows = (await env.DB.prepare(
    `SELECT word FROM unknown_words WHERE hit = 1 GROUP BY word HAVING COUNT(DISTINCT igsid) >= 3
     AND word NOT IN (SELECT word FROM keywords)`
  ).all()).results;
  for (const { word } of rows) {
    await env.DB.prepare('INSERT OR IGNORE INTO keywords (word, source, added_at, gift) VALUES (?, ?, ?, ?)')
      .bind(word, 'learned', now(), gift).run();
    await log(env, 'keyword_learned', `${word} -> ${gift}`);
  }
}

// ---------- Direct messages ----------

async function handleMessaging(env, event) {
  const igsid = event.sender?.id;
  if (!igsid || igsid === env.IG_USER_ID || event.message?.is_echo) return;

  const eventId = event.message?.mid || event.postback?.mid || `${igsid}:${event.timestamp}`;
  const fresh = await env.DB.prepare('INSERT OR IGNORE INTO events_seen (id, at) VALUES (?, ?)').bind(eventId, now()).run();
  if (!fresh.meta.changes) return;

  const user = await getUser(env, igsid);
  if (user) await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE igsid = ?').bind(now(), igsid).run();

  const payload = event.postback?.payload || event.message?.quick_reply?.payload || '';
  if (payload.startsWith(M.FOLLOWED_PAYLOAD)) {
    const gift = payload.split(':')[1] || user?.gift;
    if (M.GIFTS[gift]) return checkFollowAndReply(env, igsid, gift, M.GIFT, M.STILL_NOT_FOLLOWING);
  }

  const text = event.message?.text;
  if (!text) return;

  if (isDeleteRequest(text)) {
    await deleteUser(env, igsid);
    await send(env, 'dm', { id: igsid }, { text: M.DATA_DELETED });
    return;
  }

  // Only people who asked for a gift get an answer; other DMs stay for the owner.
  if (user?.gift && M.GIFTS[user.gift] && isNotReceived(text)) {
    return checkFollowAndReply(env, igsid, user.gift, M.GIFT_RESEND, M.ASK_FOLLOW);
  }
}

async function checkFollowAndReply(env, igsid, gift, giftVariants, notFollowingVariants) {
  const res = await graph(env, 'GET', igsid, { fields: 'username,is_user_follow_business' });
  if (!res.ok) {
    await log(env, 'follow_check_failed', JSON.stringify({ igsid, error: res.error }));
    return send(env, 'dm', { id: igsid }, followCard(M.CHECK_FAILED, gift));
  }

  if (res.data.is_user_follow_business !== true) {
    await send(env, 'dm', { id: igsid }, followCard(notFollowingVariants, gift));
    return log(env, 'not_following', res.data.username || igsid);
  }

  const user = await getUser(env, igsid);
  const hadThisGift = (user?.gifts_sent || '').includes(`,${gift},`);
  const variants = hadThisGift && giftVariants === M.GIFT ? M.GIFT_AGAIN : giftVariants;
  const delivered = await send(env, 'dm', { id: igsid }, giftCard(variants, gift));
  if (!delivered) return; // stays in the outbox, retried every hour; not counted as sent
  await env.DB.prepare(
    `INSERT INTO users (igsid, username, status, asked_at, last_seen_at, gift_sent_at, gift_count, gift, gifts_sent)
     VALUES (?, ?, 'gift_sent', ?, ?, ?, 1, ?, ?)
     ON CONFLICT(igsid) DO UPDATE SET status = 'gift_sent', username = excluded.username,
       gift_sent_at = COALESCE(users.gift_sent_at, excluded.gift_sent_at), gift_count = users.gift_count + 1,
       gifts_sent = CASE WHEN COALESCE(users.gifts_sent, ',') LIKE ? THEN users.gifts_sent
                         ELSE COALESCE(users.gifts_sent, ',') || ? END`
  ).bind(igsid, res.data.username || null, now(), now(), now(), gift, `,${gift},`, `%,${gift},%`, `${gift},`).run();
  await log(env, 'gift_sent', `${res.data.username || igsid} -> ${gift}`);
}

// ---------- Cards ----------

function fill([title, subtitle], gift) {
  const name = M.GIFTS[gift]?.name || '';
  return [title.replace('{gift}', name), subtitle.replace('{gift}', name)];
}

function card([title, subtitle], button) {
  return {
    attachment: {
      type: 'template',
      payload: { template_type: 'generic', elements: [{ title, subtitle, buttons: [button] }] },
    },
  };
}

function followCard(variants, gift) {
  return card(fill(pick(variants), gift), { type: 'postback', title: M.FOLLOW_BUTTON, payload: `${M.FOLLOWED_PAYLOAD}:${gift}` });
}

function giftCard(variants, gift) {
  return card(fill(pick(variants), gift), { type: 'web_url', title: M.OPEN_BUTTON, url: M.GIFTS[gift].url });
}

// ---------- Sending with retry ----------

// kind 'dm': target = recipient object, message = message object
// kind 'comment_reply': target = comment id, message = { message: text }
async function send(env, kind, target, message) {
  const result = await deliver(env, kind, target, message);
  if (result.ok) return true;
  await env.DB.prepare(
    'INSERT INTO outbox (kind, target, payload, attempts, last_error, next_at, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)'
  ).bind(kind, JSON.stringify(target), JSON.stringify(message), JSON.stringify(result.error), now() + 5 * MIN, now()).run();
  await log(env, 'send_failed', JSON.stringify({ kind, target, error: result.error }));
  return false;
}

function deliver(env, kind, target, message) {
  if (kind === 'comment_reply') return graph(env, 'POST', `${target}/replies`, message);
  return graph(env, 'POST', `${env.IG_USER_ID}/messages`, { recipient: target, message });
}

async function retryOutbox(env) {
  const due = (await env.DB.prepare(
    "SELECT * FROM outbox WHERE status = 'pending' AND next_at <= ? ORDER BY id LIMIT 50"
  ).bind(now()).all()).results;
  for (const row of due) {
    const result = await deliver(env, row.kind, JSON.parse(row.target), JSON.parse(row.payload));
    if (result.ok) {
      await env.DB.prepare("UPDATE outbox SET status = 'sent', attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
      continue;
    }
    const attempts = row.attempts + 1;
    const dead = attempts >= 8 || now() - row.created_at > 6 * DAY; // Meta limits: 24h DMs / 7 days private replies
    await env.DB.prepare('UPDATE outbox SET attempts = ?, status = ?, last_error = ?, next_at = ? WHERE id = ?')
      .bind(attempts, dead ? 'dead' : 'pending', JSON.stringify(result.error), now() + 2 ** attempts * 5 * MIN, row.id).run();
  }
}

// ---------- Every hour ----------

async function hourly(env) {
  try {
    if (!env.IG_TOKEN) return;
    await refreshToken(env);
    await retryOutbox(env);
    await scanRecentComments(env);
    await cleanup(env);
  } catch (e) {
    await log(env, 'cron_error', String(e?.stack || e));
  }
}

// Instagram tokens live 60 days; refresh once a day so it never expires.
async function refreshToken(env) {
  if (now() - env.TOKEN_REFRESHED_AT < DAY) return;
  const u = new URL('https://graph.instagram.com/refresh_access_token');
  u.searchParams.set('grant_type', 'ig_refresh_token');
  u.searchParams.set('access_token', env.IG_TOKEN);
  const data = await (await fetch(u)).json().catch(() => ({}));
  if (!data.access_token) return log(env, 'token_error', JSON.stringify(data.error || data));
  await saveSetting(env, 'ig_token', data.access_token);
  await saveSetting(env, 'ig_token_refreshed_at', now());
  env.IG_TOKEN = data.access_token;
  await log(env, 'token_refreshed', null);
}

// Catch keyword comments the webhook missed (last 10 posts, comments younger than 7 days).
async function scanRecentComments(env) {
  const media = await graph(env, 'GET', `${env.IG_USER_ID}/media`, { fields: 'id,timestamp', limit: '10' });
  if (!media.ok) return log(env, 'scan_error', JSON.stringify(media.error));
  const weekAgo = now() - 7 * DAY;
  for (const m of media.data.data || []) {
    const comments = await graph(env, 'GET', `${m.id}/comments`, { fields: 'id,text,timestamp,username,from', limit: '50' });
    if (!comments.ok) continue;
    for (const c of comments.data.data || []) {
      if (Date.parse(c.timestamp) < weekAgo) continue;
      await handleComment(env, { ...c, media: { id: m.id } }, 'cron');
    }
  }
}

async function cleanup(env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM unknown_words WHERE hit = 0 AND seen_at < ?').bind(now() - DAY),
    env.DB.prepare('DELETE FROM events_seen WHERE at < ?').bind(now() - 7 * DAY),
    env.DB.prepare('DELETE FROM log WHERE at < ?').bind(now() - 90 * DAY),
  ]);
}

// ---------- Data deletion ----------

async function deleteUser(env, igsid) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM users WHERE igsid = ?').bind(igsid),
    env.DB.prepare('DELETE FROM comments WHERE igsid = ?').bind(igsid),
    env.DB.prepare('DELETE FROM unknown_words WHERE igsid = ?').bind(igsid),
  ]);
  await log(env, 'data_deleted', null);
}

// Meta's "data deletion callback": a signed request.
async function deletionCallback(request, env, origin) {
  const form = await request.formData();
  const signed = String(form.get('signed_request') || '');
  const [sig, payload] = signed.split('.');
  const expected = await hmac(env.IG_APP_SECRET, payload || '', 'base64url');
  if (!sig || sig !== expected) return new Response('bad request', { status: 400 });
  const code = crypto.randomUUID().slice(0, 8);
  await log(env, 'deletion_callback', code);
  return Response.json({ url: `${origin}/delete-data?code=${code}`, confirmation_code: code });
}

// ---------- Helpers ----------

async function graph(env, method, path, params = {}) {
  const url = new URL(`https://graph.instagram.com/${env.GRAPH_VERSION}/${path}`);
  url.searchParams.set('access_token', env.IG_TOKEN);
  const init = { method };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  } else {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(params);
  }
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) return { ok: false, error: data.error || { status: res.status } };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: { message: String(e) } };
  }
}

async function getUser(env, igsid) {
  return env.DB.prepare('SELECT * FROM users WHERE igsid = ?').bind(igsid).first();
}

async function log(env, kind, detail) {
  try {
    await env.DB.prepare('INSERT INTO log (at, kind, detail) VALUES (?, ?, ?)').bind(now(), kind, detail).run();
  } catch { /* never break the bot because of the log */ }
}

async function hmac(secret, data, encoding) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  if (encoding === 'base64url') {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function validSignature(raw, header, secret) {
  if (!secret || !header.startsWith('sha256=')) return false;
  return header.slice(7) === (await hmac(secret, raw, 'hex'));
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
