import crypto from 'crypto';

// ============================================================================
// SERVER-ONLY signed session for the Agency Leader area.
// ----------------------------------------------------------------------------
// HMAC-SHA256 over a minimal, NON-sensitive payload using NT_LEADER_SESSION_SECRET
// (built-in Node crypto — no dependency). The cookie carries NO name/unit/CT,
// NO Drive ID, and NO access-list data — only a version, timestamps, a random
// opaque id, and scope. Fails closed when the secret is absent.
// Read only on the server (API routes + getServerSideProps); never bundled to
// the client.
// ============================================================================

export const COOKIE_NAME = 'nt_leader_session';
const MAX_AGE_SEC = 4 * 60 * 60; // ~4 hours

function getSecret() {
  const s = process.env.NT_LEADER_SESSION_SECRET;
  return s && typeof s === 'string' && s.length >= 16 ? s : null;
}

export function isSessionConfigured() {
  return !!getSecret();
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(s, 'base64');
}

// Create a signed token (or null if not configured). Returns { name, value, maxAge }.
export function createSessionCookie() {
  const secret = getSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    iat: now,
    exp: now + MAX_AGE_SEC,
    scope: 'leader',
    sid: b64url(crypto.randomBytes(9)), // opaque, non-identifying
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return { name: COOKIE_NAME, value: `${body}.${sig}`, maxAge: MAX_AGE_SEC };
}

// Verify a token: signature (constant-time) + structure + expiry. Returns the
// payload on success, otherwise null. Never throws.
export function verifySessionToken(token) {
  const secret = getSecret();
  if (!secret || !token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!payload || payload.v !== 1 || payload.scope !== 'leader') return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
  return payload;
}

export function buildSetCookie({ name, value, maxAge }, { secure } = {}) {
  const parts = [`${name}=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/leader', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie({ secure } = {}) {
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/leader', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

// Whether the request is over HTTPS (Vercel preview + prod are HTTPS) → Secure.
export function isSecureRequest(req) {
  const proto = String((req && req.headers && req.headers['x-forwarded-proto']) || '');
  return proto.split(',')[0].trim() === 'https' || process.env.NODE_ENV === 'production';
}

export function parseCookies(header) {
  const out = {};
  String(header || '')
    .split(';')
    .forEach((p) => {
      const i = p.indexOf('=');
      if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
  return out;
}
