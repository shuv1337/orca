// Single source of truth for the fork's user-visible brand. See
// docs/adr/0001-v1-preserves-orca-os-identity.md: only display surfaces become
// `shuvorca` in v1 — the OS identity, data paths, and CLI binaries stay `Orca`.

/** User-visible product name. Always lowercase, every sentence position. */
export const PRODUCT_DISPLAY_NAME = 'shuvorca'

/** Fork release repo (README / metadata). The star nag itself is disabled — D3. */
export const FORK_GITHUB_REPO_SLUG = 'shuv1337/orca'

/**
 * Whether to consume upstream's onorca.dev "what's new" feeds (changelog +
 * nudge). False for the fork (D2): those feeds reflect upstream releases and
 * would mismatch the fork's own shuv1337/orca build. Flip to true only if the
 * fork hosts its own equivalent feed.
 */
export const CONSUMES_UPSTREAM_WHATS_NEW_FEEDS = false

/**
 * Legacy Electron app-data name AND production app name passed to
 * `app.setName()`. This keys `app.getPath('userData')`; changing it loses every
 * existing profile, so it stays `Orca` in v1 (ADR-0001).
 */
export const LEGACY_USER_DATA_APP_NAME = 'Orca'

/**
 * Packaged macOS executable file name (`Contents/MacOS/Orca`). Pinned via the
 * electron-builder `executableName` so `resources/darwin/bin/orca` keeps working
 * even though the bundle is `shuvorca.app` (D7).
 */
export const LEGACY_PACKAGED_EXECUTABLE_NAME = 'Orca'

/**
 * Public shell command — platform-dependent, not a flat constant. Linux ships
 * `orca-ide` to avoid shadowing GNOME Orca's `/usr/bin/orca`. Use this at every
 * agent-facing / instructional command string so the hint matches the installed
 * binary (D8). Pass an explicit platform from the renderer, where `process` may
 * be absent.
 */
export function cliCommandName(
  platform: NodeJS.Platform = typeof process !== 'undefined' ? process.platform : 'linux'
): string {
  return platform === 'linux' ? 'orca-ide' : 'orca'
}

/**
 * Rebrand `Orca` → shuvorca in a user-facing string at runtime. Applied at the
 * i18n translate seams so the locale catalogs stay byte-identical to upstream
 * (ADR-0002). The capital-`O` word boundary leaves identifiers (`onorca.dev`,
 * `orca-first`, `ORCA_*`) untouched. Curated exceptions:
 * - "Orca Mobile" keeps the upstream brand (the fork ships no mobile app — D4):
 *   the distinct name signals the separate upstream product, while the app
 *   itself is "shuvorca". The negative lookahead on " Mobile" preserves the
 *   phrase wherever it appears (titles, buttons, descriptions).
 * - "Non-Orca worktrees" reads better as "Other worktrees".
 * - Spanish "Orcas" (a mistranslation of the singular brand) maps to the brand.
 */
export function applyProductBrand(value: string): string {
  if (!value.includes('Orca')) {
    return value
  }
  return value
    .replace(/Non-Orca worktrees/g, 'Other worktrees')
    .replace(/\bOrcas\b/g, PRODUCT_DISPLAY_NAME)
    .replace(/\bOrca\b(?! Mobile)/g, PRODUCT_DISPLAY_NAME)
}

/**
 * Brand every string leaf of an i18n resource tree (templates + default
 * strings) so the transform runs BEFORE i18next interpolation. Branding the
 * resolved output instead would also rewrite interpolated user data — e.g. a
 * branch named `fix-Orca` in `Deleted "{{value0}}".`. Returns a fresh tree;
 * the on-disk locale JSON stays byte-identical to upstream (ADR-0002).
 */
export function brandResourceTree<T>(node: T): T {
  if (typeof node === 'string') {
    return applyProductBrand(node) as T
  }
  if (Array.isArray(node)) {
    return node.map((item) => brandResourceTree(item)) as T
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, brandResourceTree(value)])
    ) as T
  }
  return node
}
