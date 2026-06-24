import { google } from 'googleapis';

const ID_RE = /^[A-Za-z0-9_-]{10,200}$/;
const isValidDriveId = (id) => typeof id === 'string' && ID_RE.test(id);
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getAllowedRoots() {
  const raw = process.env.NT_ALLOWED_ROOT_IDS || '';
  return new Set(raw.split(',').map((s) => s.trim()).filter((s) => isValidDriveId(s)));
}

async function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

async function isUnderAllowedRoot(drive, id, allowedRoots, memo) {
  if (!allowedRoots || allowedRoots.size === 0) return false;
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

function sanitizeName(name, fallback) {
  const base = (name && String(name)) || fallback;
  const cleaned = base.replace(/[\r\n"\\]/g, '_').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return (cleaned || fallback).slice(0, 200);
}
function setAttachment(res, name) {
  const safe = sanitizeName(name, 'photo');
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_');
  res.setHeader('Content-Disposition',
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const id = (req.query.fileId || '').trim();
  const { size } = req.query;
  if (!isValidDriveId(id)) return res.status(400).json({ error: 'Invalid file id' });
  const allowedRoots = getAllowedRoots();
  if (allowedRoots.size === 0) return res.status(503).json({ error: 'Service not configured' });
  try {
    const drive = await getDriveClient();
    const memo = new Map();
    if (!(await isUnderAllowedRoot(drive, id, allowedRoots, memo))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const meta = await drive.files.get({ fileId: id, fields: 'name, mimeType', supportsAllDrives: true });
    const mime = meta.data.mimeType || '';
    if (!IMAGE_MIMES.has(mime)) return res.status(403).json({ error: 'Unsupported file type' });
    const baseName = (meta.data.name || 'photo').replace(/\.[^/.]+$/, '');
    if (size === 'social') {
      const url = `https://drive.google.com/thumbnail?id=${id}&sz=w1080`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('thumbnail fetch failed');
      const buf = Buffer.from(await resp.arrayBuffer());
      res.setHeader('Content-Type', 'image/jpeg');
      setAttachment(res, `${baseName}-social.jpg`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buf);
    }
    const file = await drive.files.get(
      { fileId: id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    res.setHeader('Content-Type', mime || 'image/jpeg');
    setAttachment(res, meta.data.name || 'photo');
    return res.send(Buffer.from(file.data));
  } catch (error) {
    console.error('download route error:', error && error.message);
    return res.status(500).json({ error: 'Download failed' });
  }
}
