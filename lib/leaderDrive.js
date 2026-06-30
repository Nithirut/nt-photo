import { google } from 'googleapis';

// ============================================================================
// SERVER-ONLY NT ACADEMY gallery Drive layer.
// ----------------------------------------------------------------------------
// Lists the image files that are DIRECT children of the NT ACADEMY folder (a
// child of LEADER) via the service account, and streams their bytes through
// the server. The folder ID, raw file IDs, service-account credential, and
// Google URLs NEVER reach the browser. Fails closed on any problem.
//
// A short, private, process-local cache of the listing (id → entry) doubles as
// an isolation guard: image/download endpoints only serve a fileId that is
// present in the current NT ACADEMY listing, so a token can never be used to
// read a file outside this folder.
// ============================================================================

const NT_ACADEMY_FOLDER_ID = '1iu0ohw82uojRQo70brBwzkPolGQFhBsP';
const CACHE_TTL_MS = 5 * 60 * 1000;
const THUMB_SIZE = 600; // px on the long edge for the grid (retina-friendly)

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

let cache = null; // { items, byId: Map, loadedAt }
let auth = null;

function getAuth() {
  if (auth) return auth;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return auth;
}
function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

function isAllowedImage(f) {
  if (!f || !f.name || !f.mimeType) return false;
  if (f.name.startsWith('.')) return false; // hidden/config
  if (f.name === 'passcode.txt') return false;
  if (/\.(tmp|crdownload|part)$/i.test(f.name)) return false; // temporary files
  return IMAGE_MIME.has(f.mimeType) && IMAGE_EXT.test(f.name);
}

// Load + cache the NT ACADEMY image listing. Returns { ok, items } or
// { ok:false, code }. Never throws. Errors are NOT cached.
export async function listAcademyPhotos() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return { ok: true, items: cache.items, cached: true };
  }
  let drive;
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return { ok: false, code: 'CONFIG' };
    drive = getDrive();
  } catch (e) {
    return { ok: false, code: 'CONFIG' };
  }
  const files = [];
  try {
    let pageToken;
    do {
      const r = await drive.files.list({
        q: `'${NT_ACADEMY_FOLDER_ID}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, thumbnailLink, imageMediaMetadata(width,height))',
        orderBy: 'modifiedTime desc',
        pageSize: 200,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken,
      });
      (r.data.files || []).forEach((f) => files.push(f));
      pageToken = r.data.nextPageToken;
    } while (pageToken);
  } catch (e) {
    return { ok: false, code: 'DRIVE' };
  }
  const items = files
    .filter(isAllowedImage)
    .map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime || null,
      width: (f.imageMediaMetadata && f.imageMediaMetadata.width) || null,
      height: (f.imageMediaMetadata && f.imageMediaMetadata.height) || null,
      thumbnailLink: f.thumbnailLink || null,
    }));
  const byId = new Map(items.map((it) => [it.id, it]));
  cache = { items, byId, loadedAt: Date.now() };
  return { ok: true, items, cached: false };
}

// Resolve a fileId to its cached NT ACADEMY entry (refreshing the list if the
// cache is cold/stale). Returns null if the file is NOT a current NT ACADEMY
// image — this is the per-request isolation check.
async function getEntry(fileId) {
  if (!fileId) return null;
  if (!cache || Date.now() - cache.loadedAt >= CACHE_TTL_MS) {
    const r = await listAcademyPhotos();
    if (!r.ok) return null;
  }
  return (cache && cache.byId.get(fileId)) || null;
}

function safeName(name) {
  return String(name || 'photo').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'photo';
}

// Stream a grid-sized thumbnail for fileId. Verifies the file is an NT ACADEMY
// image first. Returns true on success; false → caller should 404.
export async function sendThumbnail(res, fileId) {
  const entry = await getEntry(fileId);
  if (!entry) return false;
  try {
    if (entry.thumbnailLink) {
      const sized = entry.thumbnailLink.replace(/=s\d+(-c)?$/, `=s${THUMB_SIZE}`);
      const accessToken = await getAuth().getAccessToken();
      const tok = typeof accessToken === 'string' ? accessToken : (accessToken && accessToken.token);
      const resp = await fetch(sized, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        res.setHeader('Content-Type', resp.headers.get('content-type') || entry.mimeType);
        res.setHeader('Cache-Control', 'private, no-store');
        res.status(200).end(buf);
        return true;
      }
    }
    // Fallback: stream the original if no usable thumbnail.
    return await streamOriginal(res, fileId, { attachment: false });
  } catch (e) {
    return false;
  }
}

// Stream the original image for fileId. Verifies NT ACADEMY membership first.
// asAttachment → Content-Disposition: attachment. Returns true on success.
export async function streamOriginal(res, fileId, { attachment = false } = {}) {
  const entry = await getEntry(fileId);
  if (!entry) return false;
  try {
    const drive = getDrive();
    const r = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    res.setHeader('Content-Type', entry.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    if (attachment) {
      res.setHeader('Content-Disposition', `attachment; filename="${safeName(entry.name)}"`);
    }
    await new Promise((resolve, reject) => {
      r.data.on('end', resolve);
      r.data.on('error', reject);
      r.data.pipe(res);
    });
    return true;
  } catch (e) {
    return false;
  }
}

export function __resetCache() { cache = null; }
export { NT_ACADEMY_FOLDER_ID, isAllowedImage };
