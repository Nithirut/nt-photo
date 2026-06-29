import { google } from 'googleapis';
import { normalizeName, normalizeCtCode, isValidUnit } from './leaderAccess';

// ============================================================================
// SERVER-ONLY Agency Leader access-list loader.
// ----------------------------------------------------------------------------
// Reads the CURRENT passcode.txt from Google Drive (LEADER folder) via the
// service account, parses it, and caches the parsed records in a private,
// process-local in-memory cache for a short TTL so the owner can edit the file
// in Drive without any code change or redeploy. The list is NEVER sent to the
// browser, NEVER written to the repo, and NEVER logged. Fails closed on any
// problem (missing / duplicate-name file / unreadable / empty / malformed).
//
// Refresh semantics:
//   - Successful parses are cached ~5 min; after expiry the next login re-reads
//     Drive, so added/edited/removed entries take effect automatically.
//   - Errors are NOT cached (so a transient Drive error is retried), and we
//     never serve stale data after a failure.
//   - Already-issued sessions are independent of this cache (see leaderSession);
//     removing a person blocks NEW logins after cache expiry but does not revoke
//     a live session before its ~4h expiry.
// ============================================================================

const LEADER_FOLDER_ID = '1QiTo5faaUNkjxHHIDxGaLRIsKqqCMDuF';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null; // { records, fileId, modifiedTime, loadedAt } — success only

async function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

// Parse a Buffer of passcode.txt into normalized records. No assumptions beyond
// the audited format: UTF-8, optional BOM, CRLF/LF, no header, whitespace-
// delimited, 3 columns (name unit ctCode). Malformed rows are skipped+counted.
export function parseAccessList(buf) {
  let text = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const lines = text.split(/\r\n|\n|\r/);
  const records = [];
  let invalid = 0;
  let blank = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { blank += 1; continue; }
    const parts = line.split(/\s+/);
    if (parts.length !== 3) { invalid += 1; continue; }
    const [n, u, c] = parts;
    if (!isValidUnit(u)) { invalid += 1; continue; }
    const name = normalizeName(n);
    const ctCode = normalizeCtCode(c);
    if (!name || !ctCode) { invalid += 1; continue; }
    records.push({ name, unit: String(u), ctCode });
  }
  return { records, invalid, blank, total: lines.length };
}

// Load the current access list (cached). Returns { ok:true, records } or
// { ok:false, code } where code is generic (CONFIG/DRIVE/MISSING/DUPLICATE_FILE/
// EMPTY). Never throws to the caller.
export async function loadAccessList() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return { ok: true, records: cache.records, cached: true };
  }
  let drive;
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return { ok: false, code: 'CONFIG' };
    drive = await getDriveClient();
  } catch (e) {
    return { ok: false, code: 'CONFIG' };
  }
  let files;
  try {
    const r = await drive.files.list({
      q: `'${LEADER_FOLDER_ID}' in parents and name = 'passcode.txt' and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      pageSize: 10,
      supportsAllDrives: true,
    });
    files = (r.data.files || []).filter((f) => f.name === 'passcode.txt');
  } catch (e) {
    return { ok: false, code: 'DRIVE' };
  }
  if (files.length === 0) return { ok: false, code: 'MISSING' };
  // Multiple exact-named direct children → ambiguous → fail closed (never auto-pick).
  if (files.length > 1) return { ok: false, code: 'DUPLICATE_FILE' };
  const file = files[0];
  let buf;
  try {
    const dl = await drive.files.get(
      { fileId: file.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    buf = Buffer.from(dl.data);
  } catch (e) {
    return { ok: false, code: 'DRIVE' };
  }
  const parsed = parseAccessList(buf);
  if (parsed.records.length === 0) return { ok: false, code: 'EMPTY' };
  cache = {
    records: parsed.records,
    fileId: file.id,
    modifiedTime: file.modifiedTime || null,
    loadedAt: Date.now(),
  };
  return { ok: true, records: parsed.records, cached: false };
}

// Exact same-row match of all three normalized values. Returns boolean only.
export function findLeaderMatch(records, input) {
  const name = normalizeName(input && input.name);
  const unit = String(input && input.unit);
  const ctCode = normalizeCtCode(input && input.ctCode);
  if (!name || !isValidUnit(unit) || !ctCode) return false;
  return (records || []).some(
    (r) => r.name === name && r.unit === unit && r.ctCode === ctCode
  );
}

// Test-only hook to reset the cache (not used in production paths).
export function __resetCache() { cache = null; }
