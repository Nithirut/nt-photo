// ============================================================================
// Agency Leader access — interface / contract ONLY (login-shell phase).
// ----------------------------------------------------------------------------
// The real access list arrives later as an owner-provided passcode.txt. Until
// then we make NO assumptions about that file's encoding, delimiter, header
// presence, or row shape, and we ship NO sample/seed data (any placeholder
// could leak into production). This module defines the shared shape + the
// normalizers used by both the client form and the (future) server matcher.
//
// A leader record is the tuple we will eventually match against — all three
// fields must match the SAME row:
//   - name   : ชื่อจริง (first name only), Thai-aware, whitespace-normalized
//   - unit   : '866' | '1149'
//   - ctCode : รหัสทัพ, uppercased (e.g. CT1) — the set of codes is NOT assumed
//
// @typedef {{ name: string, unit: string, ctCode: string }} LeaderRecord
// ============================================================================

// The only safe, owner-stated unit values. Used to populate the select and to
// shape-validate input. NOT an access decision.
export const LEADER_UNITS = ['866', '1149'];

// Normalize a first name: trim ends + collapse internal whitespace. Thai-safe
// (no transliteration; Thai has no letter case so we do not change case).
export function normalizeName(input) {
  return String(input == null ? '' : input).trim().replace(/\s+/g, ' ');
}

// Normalize รหัสทัพ: trim + uppercase, so ct1 / Ct1 / CT1 are one value.
// No length / format restriction (the real set of CT codes is unknown).
export function normalizeCtCode(input) {
  return String(input == null ? '' : input).trim().toUpperCase();
}

// Unit must be one of the two known units.
export function isValidUnit(unit) {
  return LEADER_UNITS.includes(String(unit));
}

// Shape-only check (NOT an access decision). Returns the list of missing /
// invalid field keys; an empty array means the form is well-formed. It never
// reveals anything about eligibility — there is no access list yet.
export function validateLeaderForm({ name, unit, ctCode } = {}) {
  const errors = [];
  if (!normalizeName(name)) errors.push('name');
  if (!isValidUnit(unit)) errors.push('unit');
  if (!normalizeCtCode(ctCode)) errors.push('ctCode');
  return errors;
}

// TODO(passcode.txt): once the owner provides passcode.txt, implement the
// parser HERE, and only after auditing: encoding, delimiter, header / no-header,
// duplicate names, duplicate (name+unit+ctCode) combinations, blank rows, Thai
// normalization, allowed unit values, CT format, and invalid rows. The parser
// MUST run server-side only and MUST never ship the list to the browser.
//   export function parseAccessList(raw) { /* not implemented — awaiting file */ }
//   export function findLeaderRecord(list, record) { /* exact 3-field row match */ }
