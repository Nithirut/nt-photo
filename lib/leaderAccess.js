// ============================================================================
// Agency Leader access — CLIENT-SAFE shared shape + normalizers.
// ----------------------------------------------------------------------------
// This module is imported by BOTH the client login form and the server matcher,
// so it must contain NO Drive client, NO secret, NO access-list data — only the
// pure normalizers and shape validation. The actual list loading/parsing and the
// session signing live in server-only modules (leaderAccessServer / leaderSession).
//
// A leader record is matched on all three fields of the SAME row:
//   name (ชื่อจริง, first name only) + unit ('866'|'1149') + ctCode (e.g. CT1)
// ============================================================================

export const LEADER_UNITS = ['866', '1149'];

// รหัสทัพ is chosen from a fixed set CT1..CT15 (native <select> on the client;
// re-validated on the server). The actual eligibility still comes from an exact
// same-row match against passcode.txt.
export const LEADER_CT_CODES = Array.from({ length: 15 }, (_, i) => `CT${i + 1}`);

// First name: Unicode NFC + trim + collapse internal whitespace. Thai has no
// letter case, so no case change; no transliteration; exact-match only.
export function normalizeName(input) {
  let s = String(input == null ? '' : input);
  try { s = s.normalize('NFC'); } catch (e) { /* normalize always available in modern runtimes */ }
  return s.trim().replace(/\s+/g, ' ');
}

// รหัสทัพ: trim + uppercase so ct1 / Ct1 / CT1 are one value. No length/format
// assumption (the real set of CT codes comes from passcode.txt).
export function normalizeCtCode(input) {
  let s = String(input == null ? '' : input);
  try { s = s.normalize('NFC'); } catch (e) {}
  return s.trim().toUpperCase();
}

// หน่วย: NFC + trim, kept as a String. No digit-stripping (so "86a6" stays
// invalid rather than being coerced to a valid value).
export function normalizeUnit(input) {
  let s = String(input == null ? '' : input);
  try { s = s.normalize('NFC'); } catch (e) {}
  return s.trim();
}

export function isValidUnit(unit) {
  return LEADER_UNITS.includes(normalizeUnit(unit));
}

export function isValidCtCode(ctCode) {
  return LEADER_CT_CODES.includes(normalizeCtCode(ctCode));
}

// Shape-only check (NOT an access decision). Returns invalid field keys; empty
// array means well-formed. Reveals nothing about eligibility. Enforces the
// closed sets unit ∈ {866,1149} and ctCode ∈ {CT1..CT15} on BOTH client and
// server (the server never trusts the browser).
export function validateLeaderForm({ name, unit, ctCode } = {}) {
  const errors = [];
  if (!normalizeName(name)) errors.push('name');
  if (!isValidUnit(unit)) errors.push('unit');
  if (!isValidCtCode(ctCode)) errors.push('ctCode');
  return errors;
}
