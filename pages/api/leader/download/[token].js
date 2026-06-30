import { COOKIE_NAME, verifySessionToken, parseCookies } from '../../../../lib/leaderSession';
import { readPhotoToken } from '../../../../lib/leaderPhotoToken';
import { streamOriginal } from '../../../../lib/leaderDrive';

// Protected single-photo download. Session-verified on every request. Streams
// the original through the server with Content-Disposition: attachment. One
// file at a time — no ZIP / bundle. Invalid token → generic 404.
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

  const ok = await streamOriginal(res, fileId, { attachment: true });
  if (!ok && !res.headersSent) {
    return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  }
}
