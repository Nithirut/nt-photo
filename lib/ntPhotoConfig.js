// ============================================================================
// NT Photo - central application configuration (NUMTHONG-only)
// ----------------------------------------------------------------------------
// Single source of truth for NT Photo's folder identity and security boundary.
//
// NT Photo serves ONLY the NUMTHONG event gallery. The NUMTHONG root folder ID
// is a public Google Drive folder identifier (it already ships in the client
// bundle and appears in shareable gallery URLs) - it is NOT a secret. It is
// declared here ONCE so pages/index.js, pages/api/drive.js and
// pages/api/download.js all read the same value and the ID is never duplicated.
//
// SECURITY BOUNDARY
//   NT_ALLOWED_ROOT_IDS is the authoritative allowlist for every Google Drive
//   access NT Photo performs. It currently contains ONLY the NUMTHONG root.
//     * It must NEVER include LICA / Ideaplan / Pednoi roots.
//     * DRIVE_FOLDER_ID (a Vercel env var) must NEVER be used as a security
//       boundary or as an implicit allowed root.
//   Any Drive ID that is not the NUMTHONG root - or not nested beneath it - is
//   denied (fail closed). Because this allowlist is static application config,
//   the boundary cannot be silently disabled by a missing/unset env var.
// ============================================================================

// NUMTHONG root Drive folder ID (public identifier, not a secret).
export const NUMTHONG_ROOT_ID = '12Tq9bNbpeKTazJetxmMb9xVCBvYZRWbb';

// The single NT Photo display group, consumed by pages/index.js.
export const NUMTHONG_GROUP = { id: 'numthong', name: 'NUMTHONG', emoji: '⭐', folderId: NUMTHONG_ROOT_ID };

// Authoritative allowed-root allowlist for the NT Photo security boundary.
// Currently NUMTHONG only. NEVER add LICA / Ideaplan / Pednoi here.
export const NT_ALLOWED_ROOT_IDS = [NUMTHONG_ROOT_ID];
