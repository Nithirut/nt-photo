import { buildClearCookie, isSecureRequest } from '../../../lib/leaderSession';

// Agency Leader logout. POST-only (no state change on GET). Clears the session
// cookie. no-store.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }
  res.setHeader('Set-Cookie', buildClearCookie({ secure: isSecureRequest(req) }));
  return res.status(200).json({ ok: true });
}
