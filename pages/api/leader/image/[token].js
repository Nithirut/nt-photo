import { COOKIE_NAME, verifySessionToken, parseCookies } from '../../../../lib/leaderSession';
import { readPhotoToken } from '../../../../lib/leaderPhotoToken';
import { sendThumbnail, streamOriginal } from '../../../../lib/leaderDrive';

// Protected image delivery. Session-verified on EVERY request, so a logged-out
// user (or incognito) cannot load an image even with a previously valid URL.
// ?size=thumb → grid thumbnail; otherwise the original. Bytes are proxied; no
// Google URL is ever exposed. Invalid/expired/tampered token → generic 404.
export const config = { api: { responseLimit: false } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');

  const cookies = parseCookies(req.headers.cookie || '');
  if (!verifySessionToken(cookies[COOKIE_NAME])) {
    return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' });
  }

  const fileId = readPhotoToken(req.query.token);
  if (!fileId) {
    return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  }

  const thumb = String(req.query.size || '') === 'thumb';
  const ok = thumb
    ? await sendThumbnail(res, fileId)
    : await streamOriginal(res, fileId, { attachment: false });

  if (!ok && !res.headersSent) {
    return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  }
}
