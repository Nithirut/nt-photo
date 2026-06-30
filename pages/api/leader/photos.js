import { COOKIE_NAME, verifySessionToken, parseCookies } from '../../../lib/leaderSession';
import { listAcademyPhotos } from '../../../lib/leaderDrive';
import { createPhotoToken } from '../../../lib/leaderPhotoToken';

// Protected NT ACADEMY photo metadata. Session-verified server-side; returns
// only opaque per-photo tokens (no raw Drive file IDs, no folder ID, no URLs).
// Paginated for load-more. Cache-Control: private, no-store.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');

  const cookies = parseCookies(req.headers.cookie || '');
  if (!verifySessionToken(cookies[COOKIE_NAME])) {
    return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' });
  }

  const list = await listAcademyPhotos();
  if (!list.ok) {
    return res.status(503).json({ ok: false, code: 'UNAVAILABLE' });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 60);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const slice = list.items.slice(offset, offset + limit);
  const items = slice
    .map((it) => ({
      token: createPhotoToken(it.id),
      name: it.name,
      width: it.width,
      height: it.height,
      modifiedTime: it.modifiedTime,
    }))
    .filter((x) => x.token);

  return res.status(200).json({
    ok: true,
    total: list.items.length,
    offset,
    limit,
    count: items.length,
    nextOffset: offset + limit < list.items.length ? offset + limit : null,
    items,
  });
}
