import { validateLeaderForm } from '../../../lib/leaderAccess';
import { loadAccessList, findLeaderMatch } from '../../../lib/leaderAccessServer';
import { isSessionConfigured, createSessionCookie, buildSetCookie, isSecureRequest } from '../../../lib/leaderSession';

// ============================================================================
// Agency Leader login. Validates shape, loads the CURRENT (cached) Drive access
// list, requires an exact same-row match of name + unit + ctCode, and on success
// issues a signed HttpOnly session cookie. Generic failures only — never reveals
// which field failed or whether a name exists. no-store. No sensitive logging.
// ============================================================================

// Best-effort, process-local rate limit. NOTE: serverless instances are
// ephemeral and not shared, so this only throttles bursts hitting the same warm
// instance — it is not a global limiter. A durable limiter would need a paid
// store (out of scope / free-only).
const attempts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 8;
function rateLimited(key) {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || now > e.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > MAX_ATTEMPTS;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }
  // Fail closed if the session secret is not configured (no fallback).
  if (!isSessionConfigured()) {
    return res.status(503).json({ ok: false, code: 'CONFIG' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, code: 'RATE_LIMIT' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { name, unit, ctCode } = body || {};

  // Shape check (generic; do not reveal which field).
  if (validateLeaderForm({ name, unit, ctCode }).length > 0) {
    return res.status(401).json({ ok: false, code: 'INVALID_CREDENTIALS' });
  }

  const list = await loadAccessList();
  if (!list.ok) {
    // Drive/parse/missing/duplicate/empty → safe config error (no details).
    return res.status(503).json({ ok: false, code: 'CONFIG' });
  }

  if (!findLeaderMatch(list.records, { name, unit, ctCode })) {
    return res.status(401).json({ ok: false, code: 'INVALID_CREDENTIALS' });
  }

  const cookie = createSessionCookie();
  if (!cookie) {
    return res.status(503).json({ ok: false, code: 'CONFIG' });
  }
  res.setHeader('Set-Cookie', buildSetCookie(cookie, { secure: isSecureRequest(req) }));
  return res.status(200).json({ ok: true });
}
