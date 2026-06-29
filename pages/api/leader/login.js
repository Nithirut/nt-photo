import { validateLeaderForm } from '../../../lib/leaderAccess';

// ============================================================================
// Agency Leader login — PLACEHOLDER endpoint (login-shell phase).
// ----------------------------------------------------------------------------
// The access list (owner-provided passcode.txt) is NOT configured yet, so this
// endpoint NEVER authenticates anyone and issues NO session. It validates only
// the request SHAPE and always responds 503 ACCESS_LIST_NOT_CONFIGURED.
//
// Security posture (shell phase):
//   * Server-side only — the access list will never be sent to the browser.
//   * Reveals no folder IDs, server paths, or eligibility data.
//   * Never logs the submitted first name (or any field) in plaintext.
//   * Cache-Control: no-store on every response.
//   * Does NOT say which field is right/wrong vs. any list (there is no list).
// ============================================================================

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'รองรับเฉพาะการส่งแบบฟอร์ม',
    });
  }

  // Parse body defensively (Next parses JSON when Content-Type is set; guard
  // against string/empty bodies without throwing).
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { name, unit, ctCode } = body || {};

  // Shape-only contract check (NOT an access decision; result is not exposed).
  validateLeaderForm({ name, unit, ctCode });

  // Access list not configured → never authenticate in this phase.
  return res.status(503).json({
    ok: false,
    code: 'ACCESS_LIST_NOT_CONFIGURED',
    message: 'ระบบกำลังรอไฟล์รายชื่อผู้มีสิทธิ์',
  });

  // TODO(passcode.txt): when the access list exists, AFTER a server-side parse
  // and an exact 3-field (name + unit + ctCode) single-row match, issue an
  // HttpOnly; Secure (prod); SameSite=Lax session cookie with an expiry, then
  // gate the LEADER image + download APIs and the /leader club route on that
  // session, with free-tier brute-force throttling. None of that is enabled now.
}
