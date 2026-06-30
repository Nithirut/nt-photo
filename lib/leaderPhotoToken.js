import crypto from 'crypto';

// ============================================================================
// SERVER-ONLY opaque photo token for the protected NT ACADEMY gallery.
// ----------------------------------------------------------------------------
// A token is an AES-256-GCM encryption of `${exp}|${driveFileId}` using a key
// derived from NT_LEADER_SESSION_SECRET. Properties:
//   - Opaque + non-decodable by the client → the raw Drive file ID never leaks.
//   - Unforgeable → only the server (which holds the secret) can mint a valid
//     token, so a token can only ever point at a file WE listed from NT ACADEMY.
//   - Self-expiring → an embedded exp (~4h) is rejected after expiry.
// The session cookie is still verified on every request; the token is a second
// gate, never a replacement for it. Fails closed when the secret is absent.
// ============================================================================

const TOKEN_TTL_SEC = 4 * 60 * 60; // ~4 hours

function deriveKey() {
  const s = process.env.NT_LEADER_SESSION_SECRET;
  if (!s || typeof s !== 'string' || s.length < 16) return null;
  // Domain-separated from the session HMAC so the two token types never mix.
  return crypto.createHash('sha256').update('nt-academy-image-token:v1:' + s).digest();
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBuf(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Returns an opaque token string, or null if not configured / bad input.
export function createPhotoToken(fileId) {
  const key = deriveKey();
  if (!key || !fileId || typeof fileId !== 'string') return null;
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const plaintext = Buffer.from(`${exp}|${fileId}`, 'utf8');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64url(Buffer.concat([iv, tag, enc])); // iv(12) | tag(16) | ciphertext
}

// Returns the Drive file ID on success, or null on ANY problem (tampered,
// truncated, wrong key, expired, malformed). Never throws.
export function readPhotoToken(token) {
  try {
    const key = deriveKey();
    if (!key || !token || typeof token !== 'string') return null;
    const raw = b64urlToBuf(token);
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    const i = pt.indexOf('|');
    if (i <= 0) return null;
    const exp = parseInt(pt.slice(0, i), 10);
    const fileId = pt.slice(i + 1);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
    if (!fileId) return null;
    return fileId;
  } catch (e) {
    return null;
  }
}
