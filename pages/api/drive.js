import { google } from 'googleapis';
import { NT_ALLOWED_ROOT_IDS, NUMTHONG_ROOT_ID } from '../../lib/ntPhotoConfig';

// ---- NT Photo security boundary (NUMTHONG-only) -------------------------
// Drive IDs are URL-safe base64-ish tokens. Reject anything else (also blocks
// Drive query injection, since validated IDs contain no quotes/spaces).
const ID_RE = /^[A-Za-z0-9_-]{10,200}$/;
const isValidDriveId = (id) => typeof id === 'string' && ID_RE.test(id);

// Allowed roots come from the central static config (NUMTHONG only). No env
// dependency, no fallback to DRIVE_FOLDER_ID / shared parent. Each entry is
// re-validated here; an empty allowlist would still fail closed.
function getAllowedRoots() {
  return new Set((NT_ALLOWED_ROOT_IDS || []).filter((s) => isValidDriveId(s)));
}

async function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

// True iff `id` is an allowed root or nested under one. BFS up the parent chain
// with cycle protection, a hop cap, and a per-request memo. Stops as soon as an
// allowed root is seen (never reads above it).
async function isUnderAllowedRoot(drive, id, allowedRoots, memo) {
  if (!allowedRoots || allowedRoots.size === 0) return false; // fail closed
  if (allowedRoots.has(id)) return true;
  const seen = new Set();
  let frontier = [id];
  const MAX_HOPS = 25;
  for (let hop = 0; hop < MAX_HOPS && frontier.length; hop++) {
    const next = [];
    for (const cur of frontier) {
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (memo.has(cur)) { if (memo.get(cur)) return true; continue; }
      let parents = [];
      try {
        const r = await drive.files.get({ fileId: cur, fields: 'id, parents', supportsAllDrives: true });
        parents = r.data.parents || [];
      } catch (e) { parents = []; }
      for (const p of parents) {
        if (allowedRoots.has(p)) { memo.set(cur, true); return true; }
        next.push(p);
      }
    }
    frontier = next;
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, folderId, groupFolderId } = req.query;
  const allowedRoots = getAllowedRoots();
  // Defense-in-depth: with static config this is non-empty. If the allowlist
  // were ever emptied, still refuse rather than serve unbounded Drive access.
  if (allowedRoots.size === 0) {
    return res.status(503).json({ error: 'Service not configured' }); // fail closed
  }

  try {
    const drive = await getDriveClient();
    const memo = new Map();

    if (type === 'folders') {
      // Default to the NUMTHONG root from central config when no group folder is
      // supplied. DRIVE_FOLDER_ID is never consulted as a boundary or default.
      const target = (groupFolderId || NUMTHONG_ROOT_ID).trim();
      if (!isValidDriveId(target)) return res.status(400).json({ error: 'Invalid folder id' });
      if (!(await isUnderAllowedRoot(drive, target, allowedRoots, memo))) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const response = await drive.files.list({
        q: `'${target}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 50,
      });
      const folders = response.data.files || [];

      if (folders.length > 0) {
        try {
          const parentClause = folders.map((f) => `'${f.id}' in parents`).join(' or ');
          const posterNames = ['POSTER.JPG','poster.jpg','Poster.jpg','POSTER.jpg','Poster.JPG','poster.JPG','POSTER.PNG','poster.png','Poster.png'];
          const nameClause = posterNames.map((n) => `name='${n}'`).join(' or ');
          const posterRes = await drive.files.list({
            q: `(${parentClause}) and (${nameClause}) and mimeType contains 'image/' and trashed=false`,
            fields: 'files(id, name, parents)',
            pageSize: 100,
          });
          const coverByParent = {};
          for (const p of (posterRes.data.files || [])) {
            for (const par of (p.parents || [])) {
              if (!coverByParent[par]) coverByParent[par] = p.id;
            }
          }
          for (const f of folders) {
            if (coverByParent[f.id]) f.coverId = coverByParent[f.id];
          }
        } catch (coverErr) {
          console.error('Album cover lookup failed (continuing without covers):', coverErr && coverErr.message);
        }
      }

      return res.status(200).json({ folders });
    }

    if (type === 'photos') {
      // Validate + authorize the REQUESTED folder once (not per-photo): every image
      // child of an NT-allowed folder is itself within the NT boundary.
      const target = (folderId || '').trim();
      if (!isValidDriveId(target)) return res.status(400).json({ error: 'Invalid folder id' });
      if (!(await isUnderAllowedRoot(drive, target, allowedRoots, memo))) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      let allFiles = [];
      let pageToken;
      do {
        const response = await drive.files.list({
          q: `'${target}' in parents and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp') and trashed=false`,
          fields: 'nextPageToken, files(id, name, thumbnailLink, createdTime, imageMediaMetadata/time)',
          pageSize: 1000,
          orderBy: 'createdTime desc',
          pageToken,
        });
        allFiles = allFiles.concat(response.data.files || []);
        pageToken = response.data.nextPageToken;
      } while (pageToken);

      const photos = allFiles.filter((p) => {
        const n = (p.name || '').trim().toLowerCase();
        return n !== 'poster.jpg' && n !== 'poster.jpeg' && n !== 'poster.png';
      });

      const captureTs = (p) => {
        const t = p.imageMediaMetadata && p.imageMediaMetadata.time;
        if (t) {
          const m = String(t).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
          if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        }
        if (p.createdTime) {
          const d = Date.parse(p.createdTime);
          if (!Number.isNaN(d)) return d;
        }
        return null;
      };
      photos.sort((a, b) => {
        const ta = captureTs(a);
        const tb = captureTs(b);
        if (ta !== null && tb !== null) { if (ta !== tb) return ta - tb; }
        else if (ta === null && tb !== null) return 1;
        else if (ta !== null && tb === null) return -1;
        return (a.name || '').localeCompare(b.name || '');
      });

      return res.status(200).json({ photos });
    }

    return res.status(400).json({ error: 'Invalid request' });
  } catch (error) {
    console.error('drive route error:', error && error.message);
    return res.status(500).json({ error: 'Failed to connect to Google Drive' });
  }
}
