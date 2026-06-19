// Single source of truth for the fork's user-visible brand in the mobile app.
// Mobile can't import the desktop src/shared/product-brand.ts — Metro resolves
// inside mobile/ only (see src/transport/protocol-version.ts), so these mirror
// the desktop constants and must be kept in sync in the same PR.
//
// Unlike desktop, there is NO "Orca Mobile" exemption here: the fork ships its
// own mobile app, so the companion product is "shuvorca" (ADR-0003 supersedes
// desktop rebrand D4).

/** User-visible product name. Always lowercase, every sentence position. */
export const PRODUCT_DISPLAY_NAME = 'shuvorca'

/** Fork release repo (About screen, release/issue links). */
export const FORK_GITHUB_REPO_SLUG = 'shuv1337/orca'

/**
 * Companion app name on store / update surfaces. Was upstream "Orca Mobile";
 * the fork ships its own mobile app so it is just "shuvorca" (no " Mobile"
 * suffix — see M1 / ADR-0003).
 */
export const COMPANION_APP_NAME = 'shuvorca'

/**
 * Rebrand `Orca` → shuvorca in a user-facing string at runtime. Same rules as
 * desktop `applyProductBrand`, minus the D4 `(?! Mobile)` exemption: on the fork
 * "Orca Mobile" becomes "shuvorca Mobile", so prefer COMPANION_APP_NAME directly
 * when a bare companion-app noun is wanted. The capital-`O` word boundary leaves
 * identifiers (`stablyai/orca`, `orca://`, `ORCA_*`) untouched.
 */
export function applyProductBrand(value: string): string {
  if (!value.includes('Orca')) {
    return value
  }
  return value
    .replace(/Non-Orca worktrees/g, 'Other worktrees')
    .replace(/\bOrcas\b/g, PRODUCT_DISPLAY_NAME)
    .replace(/\bOrca\b/g, PRODUCT_DISPLAY_NAME)
}
