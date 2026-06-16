# PLAN: Surface-level rebrand — Orca → shuvorca

Fork display identity for `shuv1337/orca` without breaking installs, agent skills,
updater manifests, or macOS privacy permissions.

**Status:** revised after grilling session (see `CONTEXT.md`, `docs/adr/0001`, `docs/adr/0002`)

**Scope:** user-visible product name and packaging labels only; plus one bug fix —
agent-facing CLI command strings must respect the per-platform command name.

**Out of scope (→ v2 deep rebrand):** OS identity rename + automatic userData
migration, CLI binary rename (`orca`/`orca-ide` → `shuvorca`), Computer Use helper
rename, repo slug. Deep renames of paths, env vars, and module names stay out.

**Canonical brand token:** lowercase `shuvorca` everywhere it is a standalone
product name — never `Shuvorca`, never `ShuvOrca`, regardless of sentence
position (stylized like `npm`/`bun`).

---

## Context

This repo is a fork of upstream Orca (`stablyai/orca`). Fork infrastructure already
exists:

- Auto-updater targets `shuv1337/orca` (`config/electron-builder.config.cjs`,
  `src/main/updater-prerelease-feed.ts`) — see `notes/fork-updater-and-release.md`.
- `appId` / bundle IDs remain `com.stablyai.orca*` so macOS TCC permissions and
  installed-app identity are preserved.
- Production `userData` continuity is **already** guaranteed by the explicit
  `app.setName('Orca')` call (`src/main/index.ts:1205`, fed by
  `dev-instance-identity.ts` `BASE_APP_NAME`), **not** by `productName`. As long
  as that name stays `Orca`, `app.getPath('userData')` keeps resolving to the
  legacy `Application Support/Orca` / `~/.config/orca` profile. **Therefore no
  userData "pinning" step is needed — and `BASE_APP_NAME` must NOT be changed to
  the display name** (doing so is the actual profile-loss vector). See ADR-0001.
- Release artifact filenames remain `orca-linux.*`, `orca-macos-*.dmg`, etc. for
  updater compatibility.

A **surface rebrand** layers shuvorca as the product name users see in the UI,
window chrome, installers, and fork README — while internal contracts stay `orca`.

---

## Decisions (RESOLVED in grilling session)

| # | Decision | Resolution |
|---|----------|------------|
| D1 | UI display name casing | **`shuvorca`, all lowercase, everywhere** — never `Shuvorca`/`ShuvOrca`, any position. `PRODUCT_SLUG` collapses into this single value. |
| D2 | Upstream doc URLs (`onorca.dev`) | **Keep help-menu docs/Discord/privacy links for v1** (cosmetic, accurate). **Disable the updater changelog + nudge feeds** (`onorca.dev/whats-new/*`) — they reflect upstream versions and mismatch the fork build. |
| D3 | GitHub star nag target | **Disable** the star nag (currently targets upstream `stablyai/orca`). |
| D4 | Mobile / App Store CTAs and defaults | **Keep mobile; preserve the distinct "Orca Mobile" name** (exempt from the i18n transform via a `(?! Mobile)` lookahead) so the fork never presents a nonexistent "shuvorca Mobile". Button stays visible (`showMobileButton` unchanged). The inline "(upstream)" suffix was dropped in implementation — it read poorly in nav buttons; the distinct name already signals the upstream product. |
| D5 | GitHub attribution footer | **No work** — `enableGitHubAttribution` already defaults `false` (`constants.ts:186`); the "Orca Attribution" label is handled by the runtime i18n transform. |
| D6 | App icons / logo | **Keep** whale assets for v1; labels only. (Phase 6, optional.) |
| D7 | macOS executable name | **Pin `executableName: 'Orca'`** on macOS (matches the existing Windows block). Bundle is `shuvorca.app`; binary stays `Contents/MacOS/Orca`; `resources/darwin/bin/orca` untouched. See ADR-0001. |
| D8 | CLI command on Linux (bug fix) | **Platform-aware resolver** (`orca` mac/win, `orca-ide` linux) routed through every agent-facing command string. Binaries unchanged; rename to `shuvorca` deferred to v2. |
| D9 | `TERM_PROGRAM` | **Change to `shuvorca`** — cosmetic/safe (no code keys on the value). |
| D10 | Telemetry / PostHog | **No work** — key is build-injected via `process.env.n` (`electron.vite.config.ts`); absent in fork builds → telemetry off. Set your own key only if you want fork analytics. |

---

## Scope matrix

### Change (surface)

| Area | What changes |
|------|----------------|
| `productName` / installer labels | `Orca` → `shuvorca` (`shuvorca.app` on macOS; `executableName` pinned to `Orca` so the binary and CLI launcher are unchanged — D7) |
| Window title, titlebar, onboarding, crash UI | Display name (`shuvorca`) |
| macOS privacy prompt prose | `Orca` → `shuvorca` in TCC usage descriptions without changing bundle IDs |
| i18n locale strings | **Runtime `\bOrca\b → shuvorca` transform** at the two translate seams — locale JSON untouched (ADR-0002), plus a small curated-exception list |
| Settings labels (attribution, mobile button, CLI section headers) | Display name via the i18n transform |
| `TERM_PROGRAM` in spawned terminals | `Orca` → `shuvorca` across local-provider and daemon-backed PTYs (D9) |
| Agent-facing CLI command strings | Resolve per-platform (`orca` / `orca-ide`) — bug fix, D8 |
| README + fork download links | Fork branding |
| Casks (if used) | `name` field only |
| Star nag | **Disabled** (D3); updater changelog + nudge feeds disabled (D2) |
| Linux launcher **display** name in desktop entry | `shuvorca` label (binary stays `orca-ide`) |

### Do not change (deep / breaking)

| Area | Why |
|------|-----|
| `appId` `com.stablyai.orca` | macOS TCC reset (notifications, accessibility, screen recording) |
| Bundle IDs `com.stablyai.orca.computer-use`, dev `*.dev.*` | Same |
| `app.setName('Orca')` / `BASE_APP_NAME` in `dev-instance-identity.ts` | This is what keys `userData`. Must stay `Orca` — changing it is the profile-loss vector (ADR-0001) |
| User data paths `~/.orca`, `Application Support/Orca` | Profile continuity; preserved automatically because `app.setName('Orca')` is unchanged (no pinning step needed) |
| macOS `executableName` / `Contents/MacOS/Orca` | Pinned to `Orca` so the public CLI launcher keeps working (D7) |
| Computer Use helper `Orca Computer Use.app` | Renaming touches the native Swift build + signing; deferred to v2 |
| Default workspace dir `~/orca/workspaces` | Existing user trees |
| Repo metadata `.orca/`, `orca.yaml` | Shared with upstream repos and agents |
| All `ORCA_*` environment variables | Agent hooks, CLI, zellij wiring |
| Internal modules (`orca-runtime.ts`, etc.) | Mergeability with upstream |
| CLI binary names `orca`, `orca-ide` | Agent skills, PATH, `orca` skill docs |
| Packaged CLI launcher contract | `resources/darwin/bin/orca`, `resources/win32/bin/orca.cmd`, and Linux launcher must still find the packaged executable |
| `orca-first` / `terminal-first` enum **values** | Persisted settings schema |
| Release `artifactName` patterns | Updater manifests and CI gates |
| GitHub repo slug `orca` under `shuv1337` | Separate repo rename if ever desired |
| Zellij session prefix `orca-*` | Session detection regex |
| `package.json` `name: "orca"` | npm/workspace identity |
| Test fixtures using `stablyai/orca` as mock repo data | Data, not branding |

---

## Architecture: single source of truth

### New module

Create `src/shared/product-brand.ts`:

```ts
/** User-visible product name. Always lowercase, every position (ADR-0001). */
export const PRODUCT_DISPLAY_NAME = 'shuvorca'

/**
 * Public shell command — platform-dependent, NOT a flat constant.
 * `orca-ide` on Linux avoids shadowing GNOME Orca's /usr/bin/orca.
 * Use this at every agent-facing / instructional command string (D8).
 */
export function cliCommandName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'linux' ? 'orca-ide' : 'orca'
}

/** Fork release repo (README / metadata; star nag itself is disabled — D3). */
export const FORK_GITHUB_REPO_SLUG = 'shuv1337/orca'

/**
 * Legacy Electron app-data name AND production app name. Drives userData.
 * Must equal the value passed to app.setName() — changing it loses profiles.
 */
export const LEGACY_USER_DATA_APP_NAME = 'Orca'

/** Packaged macOS executable name; pinned via electron-builder executableName (D7). */
export const LEGACY_PACKAGED_EXECUTABLE_NAME = 'Orca'
```

Notes:
- `PRODUCT_SLUG` is removed — it collapses into `PRODUCT_DISPLAY_NAME`.
- `CLI_COMMAND_NAME` is replaced by the `cliCommandName(platform)` resolver.
- `process.platform` is unavailable in the renderer; pass an explicit platform
  (from a preload-exposed value) when calling `cliCommandName` renderer-side.

### Wire consumers

| File | Current | After |
|------|---------|-------|
| `src/main/startup/dev-instance-identity.ts` | `BASE_APP_NAME = 'Orca'` | **UNCHANGED** — stays `Orca` (production app name / userData key). Optionally import `LEGACY_USER_DATA_APP_NAME` for clarity, but the value must remain `Orca`. The **dev dock-title** prefix may show `shuvorca` (dev userData is already `orca-dev`). |
| `src/main/window/createMainWindow.ts` | default title `'Orca'` | `PRODUCT_DISPLAY_NAME` |
| `src/main/providers/local-pty-provider.ts` | `TERM_PROGRAM: 'Orca'` | `PRODUCT_DISPLAY_NAME` |
| `src/main/daemon/pty-subprocess.ts` | `TERM_PROGRAM: 'Orca'` | `PRODUCT_DISPLAY_NAME` |
| `src/main/ipc/pty.ts` | attribution / terminal env | `TERM_PROGRAM` via shared constant |
| `src/renderer/src/i18n/i18n.ts` | `translate()` returns raw value | apply `\bOrca\b → shuvorca` transform beside `pseudoLocalizeString` (ADR-0002) |
| `src/main/i18n/main-i18n.ts` | `translateMain()` returns raw value | same transform |
| `src/shared/computer-use-error-recovery.ts`, `src/cli/help.ts`, other agent-facing command strings | hardcoded `orca ...` | `cliCommandName(platform)` (D8) |
| `config/electron-builder.config.cjs` | `productName: 'Orca'`, no mac `executableName` | `productName: 'shuvorca'` from `config/product-brand.cjs`; add mac `executableName: 'Orca'` (D7) |

`src/main/startup/configure-process.ts` is **NOT** touched for userData — there is
no pinning step (the original plan's pin was solving a problem the `BASE_APP_NAME`
change itself would have created). `resources/darwin/bin/orca` stays **unchanged**
because `executableName` is pinned to `Orca`.

Renderer components with hardcoded `'Orca'` literals (Phase 2) should import
`PRODUCT_DISPLAY_NAME` instead of string literals.

---

## Implementation phases

### Phase 1 — Core constant + packaging + main process

**Goal:** Packaged app shows shuvorca in OS shell and main-process surfaces.

- [ ] Add `src/shared/product-brand.ts` (constants + `cliCommandName(platform)`)
- [ ] Add `config/product-brand.cjs` (re-exports same strings for electron-builder)
- [ ] **Do NOT change `app.setName`/`BASE_APP_NAME`** and **do NOT add a userData
      pin** — production app name stays `Orca`, so `userData` is preserved with no
      extra code (ADR-0001). Optionally add a regression test asserting a packaged
      non-dev build still resolves `app.getPath('userData')` to the legacy Orca path.
- [ ] Update `config/electron-builder.config.cjs`:
  - [ ] `productName` → `shuvorca` from product-brand shim
  - [ ] **Add** macOS `executableName: 'Orca'` (D7) — keeps `Contents/MacOS/Orca`
        and leaves `resources/darwin/bin/orca` untouched
  - [ ] **Keep** `appId: 'com.stablyai.orca'`
  - [ ] **Keep** all `artifactName`, Windows/Linux `executableName`, launcher names
  - [ ] **Keep** the Computer Use helper `Orca Computer Use.app` and its signing path
        (rename deferred to v2)
  - [ ] Update macOS TCC usage descriptions from “Orca allows...” to `shuvorca`
        wording while keeping every bundle ID and entitlement path unchanged
- [ ] Update `src/main/window/createMainWindow.ts` — default window title
- [ ] Update `src/main/providers/local-pty-provider.ts` — `TERM_PROGRAM` (D9)
- [ ] Update `src/main/daemon/pty-subprocess.ts` — `TERM_PROGRAM` (D9)
- [ ] Update `src/main/ipc/pty.ts` and tests expecting `TERM_PROGRAM: 'Orca'`
- [ ] `resources/darwin/bin/orca` and the packaged CLI launcher tests stay
      **unchanged** (executable name pinned to `Orca`)
- [ ] Update `src/main/index.ts` comment references only if misleading (optional)

**Linux packaging notes** (`config/electron-builder.config.cjs`):

- [ ] Keep `executableName: 'orca-ide'` (Ubuntu GNOME Orca conflict)
- [ ] Keep `StartupWMClass: 'orca'` (Electron WM_CLASS; dock grouping)
- [ ] Add desktop `Name=shuvorca` via `linux.desktop.entry` if electron-builder supports it; verify generated `.desktop` file label
- [ ] Update user-facing error string in `resources/linux/bin/orca-ide` (“Unable to locate the Orca executable…”) → `shuvorca`

**Validation:**

```bash
pnpm tc
pnpm test -- \
  src/main/startup/dev-instance-identity.test.ts \
  src/main/ipc/pty.test.ts \
  src/main/daemon/pty-subprocess.test.ts \
  src/main/cli/cli-installer.test.ts \
  src/main/cli/windows-launcher-asset.test.ts \
  src/cli/runtime/launch.test.ts
pnpm build:mac   # or build:linux on Linux — host-arch local install
```

- [ ] macOS: dock / menu shows `shuvorca`; bundle is `shuvorca.app`
- [ ] macOS: generated `Info.plist` `CFBundleExecutable` is `Orca`, matching what
      `resources/darwin/bin/orca` executes (`Contents/MacOS/Orca`)
- [ ] macOS: `orca --help` works from an installed packaged build after the rebrand
- [ ] Confirm production `userData` is still the legacy `Application Support/Orca`
      profile path (not a new `shuvorca` profile)
- [ ] Linux: launcher label `shuvorca`; `orca-ide` binary still launches
- [ ] Local-provider and daemon-backed terminals: `echo $TERM_PROGRAM` → `shuvorca`
- [ ] `~/.orca` and `Application Support/Orca` still used (no path migration)

---

### Phase 2 — Renderer hardcoded strings

**Goal:** Non-i18n UI surfaces show shuvorca (literals not routed through translate).

| File | Notes |
|------|-------|
| `src/renderer/src/App.tsx` | Titlebar `aria-label` and visible title |
| `src/renderer/src/components/onboarding/OnboardingFlow.tsx` | Logo row label |
| `src/renderer/src/components/crash-report/CrashReportDialogSurface.tsx` | Crash header |
| `src/renderer/src/components/mobile/slides/HomeSlide.tsx` | Mobile emulator slide |
| `src/renderer/src/components/status-bar/ResourceUsageStatusSegment.tsx` | RAM breakdown label |
| `src/renderer/src/components/automations/AutomationEditorDialogHeader.tsx` | Source label fallback |
| `src/renderer/src/components/automations/AutomationsPage.tsx` | Inline fallback string |
| `src/renderer/src/web/web-preload-api.ts` | Web surface `name` field |
| `src/shared/app-icon.ts` | `Classic Orca` → `Classic shuvorca` (etc.) |

> **Scope note:** the runtime i18n transform (ADR-0002) already rewrites any
> `Orca` in strings passed through `translate()`/`translateMain()` — including
> their inline fallbacks. Phase 2 therefore only covers `'Orca'` **literals that
> are NOT routed through translate** (raw `aria-label`s, `name` fields, icon
> labels, web-preload values).

- [ ] Replace such hardcoded `'Orca'` literals with `PRODUCT_DISPLAY_NAME` import
- [ ] Keep identifier/data labels unchanged where `Orca` is describing an internal source
      value such as automation target `orca`, repo fixture data, or protocol names.
- [ ] Leave comments in `Terminal.tsx` / `App.tsx` that describe layout (“Orca title”) — update only if confusing

**Validation:**

```bash
pnpm tc:web
pnpm test -- src/renderer/src/components/status-bar/zellij-session-display.test.ts  # unrelated smoke
```

- [ ] Dev UI: titlebar reads shuvorca with `pnpm dev`

---

### Phase 3 — i18n runtime brand transform (ADR-0002)

**Goal:** All translated UI strings render `shuvorca` — without editing the
~336×5 locale entries (which would be a permanent upstream-merge-conflict
surface). Instead, transform at the two translate seams.

**Why a transform:** the entire UI funnels through `translate()` (734 caller
files) and `translateMain()`; only ~12 files touch `useTranslation` directly and
there are no `<Trans>` components. Both seams already post-process via
`pseudoLocalizeString`, so the brand rule slots in beside it. Non-English locales
keep the brand as Latin `Orca` verbatim, so one whole-word rule covers all five.

**Procedure:**

- [ ] Add a `applyBrand(value)` helper: `value.replace(/\bOrca\b/g, PRODUCT_DISPLAY_NAME)`.
   The capital-`O` word boundary skips `onorca.dev`, `orca-first`, `ORCA_*`,
   `orca_disabled`, and lowercase `orca` data values.
- [ ] Apply it in `src/renderer/src/i18n/i18n.ts` `translate()` and
   `src/main/i18n/main-i18n.ts` `translateMain()`, composed with the existing
   `pseudoLocalizeString` post-processing.
- [ ] Leave **all** `locales/*.json` byte-identical to upstream (merge-clean).
- [ ] **Curated exceptions** (handled outside the blind transform):

   | Pattern | Action |
   |---------|--------|
   | `Orca Mobile` / App Store CTAs | Keep as **"Orca Mobile"**; exempt from transform (D4 — fork ships no mobile app) |
   | `Non-Orca worktrees` | → `Other worktrees` |
   | Spanish `Orcas` plural (`835037edc9`) | `\bOrca\b` won't match — add an explicit rule or accept |
   | `orca-first` / target value `orca` / fixtures | **Never** changed (already skipped by the boundary) |

- [ ] Audit the ~12 `useTranslation` callers — confirm none render raw `t()`
   output that bypasses the `translate()` seam; route any stragglers through it.
- [ ] Confirm the transform composes correctly with pseudo-localization
   (`pseudo-localization.test.ts`) and that localization gates stay green with
   **zero** locale-file churn.

**Settings strings to spot-check (now covered by the transform — just verify):**

- `ShortcutTerminalPolicyControl.tsx` — “Choose whether Orca or the focused terminal…”
- Update card / restart prompts
- CLI installer strings — confirm they show the right per-platform command (D8),
  not a blindly-branded one

**Validation:**

- [ ] `pnpm lint` (includes localization gates — should pass with no locale edits)
- [ ] Run the app in `es`/`ja`/`zh`/`ko`: primary chrome shows `shuvorca`, no raw `Orca`
- [ ] Mobile CTA still reads “Orca Mobile”, not “shuvorca Mobile”
- [ ] No `orca-first` value or other identifier altered (grep the rendered output)

---

### Phase 4 — Fork URLs, star nag, attribution

**Goal:** Fork-specific touchpoints do not promote upstream Orca by default.

| File | Change |
|------|--------|
| `src/main/star-nag/service.ts` | **Disable** the star nag (D3) — gate the feature off in the fork |
| `src/main/github/client.ts` | `checkOrcaStarred`/`starOrca` become unused once the nag is off; leave `ORCA_REPO` or remove dead path |
| `src/main/updater-changelog.ts` | **Disable** the `onorca.dev/whats-new/changelog.json` fetch (D2 — upstream-version mismatch) |
| `src/main/updater-nudge.ts` | **Disable** the `onorca.dev/whats-new/nudge.json` fetch (D2) |
| `src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.tsx` | **Keep** `DOCS_URL`/`CHANGELOG_URL`/Discord for v1 (D2 — cosmetic, accurate) |
| `src/renderer/src/lib/telemetry.ts` | `PRIVACY_URL` kept (D2). Telemetry itself off unless build injects `n` (D10) |
| `src/shared/feature-wall-tiles.ts` / `feature-wall-workflows.ts` | `docsUrl` kept for v1 (D2) |
| Mobile strings (i18n curated exception) | Label “Orca Mobile”, exempt from transform (D4) |
| `src/shared/constants.ts` | **No change** — `enableGitHubAttribution` already `false` (D5); `showMobileButton` stays `true` (D4) |

- [ ] D3 — disable the star nag service; remove the “star Orca on GitHub” prompt path
- [ ] D2 — disable the two updater feeds (changelog + nudge); keep help-menu links
- [ ] D5 — **no work** (attribution already defaults off; label via i18n transform)
- [ ] D10 — **no work** (telemetry off unless `process.env.n` is set at build)
- [ ] D4 — mobile stays visible but labeled “Orca Mobile”; add the
      mobile strings to the i18n curated-exception list so they are NOT
      auto-branded to “shuvorca Mobile”
- [ ] Run a runtime + docs URL audit and classify every hit:
  ```bash
  rg -n "stablyai/orca|onorca\\.dev|apps\\.apple\\.com|orca_build|discord\\.gg" \
    README.md docs/readme package.json src/main src/renderer/src src/shared
  ```
  Allowed hits must have a written reason: test fixture, upstream docs retained by D2,
  upstream mobile label, or historical note.

**Validation:**

- [ ] Star nag never appears (feature disabled — D3)
- [ ] No upstream changelog/nudge fetched on update check (D2); updater still uses
      `shuv1337/orca` releases (unchanged from fork baseline)
- [ ] Help menu links resolve (kept for v1 — D2)
- [ ] Mobile CTA reads “Orca Mobile”, links to upstream app (D4)
- [ ] No telemetry emitted unless a PostHog key was injected at build (D10)

---

### Phase 5 — Docs, metadata, distribution

- [ ] `README.md` — fork banner, `shuvorca` title, download → `https://github.com/shuv1337/orca/releases`
- [ ] Remove or relabel upstream-only badges (Discord, onorca.dev download, mobile App Store) per D4
- [ ] `docs/readme/README.*.md` — same fork banner or explicit defer note in PR
- [ ] `package.json` — `homepage` → `https://github.com/shuv1337/orca` (D-homepage),
      update `description`; **keep** `name: "orca"` and `bin.orca`
- [ ] `Casks/orca.rb`, `Casks/orca@rc.rb` — `name "shuvorca"`; keep zap paths (`com.stablyai.orca`)
- [ ] `AGENTS.md` — short note: display name `shuvorca`, internal identifiers remain `orca`
- [ ] `notes/fork-updater-and-release.md` — add cross-link to this plan

**Validation:**

- [ ] README renders correctly; no broken primary download link
- [ ] README and translated README files do not point primary downloads, badges, or
      support CTAs at upstream unless explicitly labeled upstream.

---

### Phase 6 — Visual identity (optional, separate PR)

Defer unless D6 chooses custom artwork.

- [ ] `resources/logo.svg`, `resources/icon-source/` — new mark or keep whale
- [ ] `pnpm build:icons` → `resources/build/icon.png`, `.icns`, `.ico`
- [ ] `pnpm check:feature-wall-assets` if hero images mention Orca text in pixels

---

## PR stack (recommended)

| PR | Contents | Depends on |
|----|----------|------------|
| 1 | Phase 1 — product-brand (+ `cliCommandName`) + packaging (`productName`, mac `executableName`, TCC prose) | — |
| 2 | Phase 2 — renderer non-translate literals + D8 CLI command strings | PR 1 |
| 3 | Phase 3 — i18n runtime transform + curated exceptions | PR 2 |
| 4 | Phase 4 — disable star nag + updater feeds, mobile label | PR 1 |
| 5 | Phase 5 — README, Casks, `package.json`, AGENTS | PR 3 |
| 6 | Phase 6 — icons (optional) | any |

No separate per-locale PR — the runtime transform covers all five locales with
zero locale-file edits (ADR-0002). Phases 4+5 can merge together if low conflict.

---

## Full regression checklist (pre-release)

### Build & tests

- [ ] `pnpm tc`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm build:linux` or `pnpm build:mac` (host arch)

### Functional smoke

- [ ] App launches; titlebar shows `shuvorca`
- [ ] Packaged `orca` CLI on PATH still works (`orca --help`) on macOS/Windows;
      packaged Linux `orca-ide` still works and does not shadow system `orca`
- [ ] Agent skill setup still references the `orca`/`orca-ide` command (not `shuvorca`)
- [ ] Create worktree → `.orca/` dir still created in repo (unchanged)
- [ ] Zellij sessions (if enabled) still use `orca-*` naming
- [ ] Auto-updater checks `shuv1337/orca` draft/published release
- [ ] Existing `~/.orca` profile loads (settings, repos, worktrees)
- [ ] Existing Electron app-data profile loads from legacy `Application Support/Orca`
      (preserved because `app.setName('Orca')` is unchanged)
- [ ] Agent on Linux is told `orca-ide` (not `orca`) in computer-use recovery hints (D8)
- [ ] Local-provider and daemon-backed terminals both expose `TERM_PROGRAM=shuvorca`
- [ ] Runtime/docs URL audit has no unreviewed upstream promotion hits

### Platform-specific

- [ ] **macOS:** Notifications still work (TCC not reset — same `appId`)
- [ ] **macOS:** Generated `Info.plist` `CFBundleExecutable` is `Orca` (matches launcher)
- [ ] **macOS:** Computer Use helper still signs with `com.stablyai.orca.computer-use`
      and TCC prompt still reads “Orca Computer Use” (known v1 gap → v2)
- [ ] **Linux:** `orca-ide` launcher works; no conflict with system `orca` package
- [ ] **Windows:** Installer title `shuvorca`; shortcut opens app

### i18n

- [ ] Switch UI language to es/ja/zh/ko — no raw “Orca” in primary chrome (transform)
- [ ] `pnpm verify:localization-catalog` clean (no locale-file edits expected)

---

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| TCC / permissions reset | High if `appId` changed | **Never change `appId`** in this plan |
| Profile loss | High if `app.setName`/`BASE_APP_NAME` changed | **Keep `app.setName('Orca')`** — userData preserved with no extra code (ADR-0001) |
| Packaged CLI break | High if macOS executable name changes under the launcher | **Pin mac `executableName: 'Orca'`** (D7); launcher untouched |
| Agent skills break | High if CLI renamed | Keep `orca`/`orca-ide` binaries; fix agent-facing strings via `cliCommandName` (D8) |
| Updater break | High if artifact names changed | Keep `orca-*` release filenames |
| Upstream merge conflicts | **Low** (was Medium) | Runtime i18n transform keeps locale files byte-identical (ADR-0002); central `product-brand.ts` |
| i18n bad replace | Low | Word-boundary rule skips identifiers; curated exception list for mobile / `Orcas` |
| Updater shows upstream content | Medium | Disable changelog + nudge feeds (D2) |
| Mobile UX misrepresents fork support | Medium | Label “Orca Mobile”, exempt from transform (D4) |
| Two products same `appId` | Low | Document: fork replaces upstream install slot on macOS |

---

## Effort estimate

| Phase | Estimate |
|-------|----------|
| 1 — constant + packaging (no userData pin needed) | 0.5–0.75 day |
| 2 — renderer literals + D8 CLI command strings | 0.25–0.5 day |
| 3 — i18n runtime transform + curated exceptions (was 1–2 days static) | 0.25 day |
| 4 — disable star nag / updater feeds / mobile label | 0.5 day |
| 5 — README / metadata | 0.25–0.5 day |
| 6 — icons (optional) | 0.5 day |

**Total:** ~1.75–2.5 days without custom icons (down from ~3–4 — the i18n
transform removes the per-locale bulk pass).

---

## Reference files

### Branding sources (change)

- `src/shared/product-brand.ts` (new — constants + `cliCommandName`)
- `config/product-brand.cjs` (new)
- `config/electron-builder.config.cjs` (`productName`, mac `executableName`, TCC prose)
- `src/main/window/createMainWindow.ts`
- `src/main/providers/local-pty-provider.ts`
- `src/main/daemon/pty-subprocess.ts`
- `src/main/ipc/pty.ts`
- `src/renderer/src/i18n/i18n.ts` (transform seam — ADR-0002)
- `src/main/i18n/main-i18n.ts` (transform seam)
- `src/shared/computer-use-error-recovery.ts`, `src/cli/help.ts` (D8 command strings)
- `resources/linux/bin/orca-ide` (error string only)
- `src/main/star-nag/service.ts` (disable — D3)
- `src/main/updater-changelog.ts`, `src/main/updater-nudge.ts` (disable feeds — D2)
- `src/shared/app-icon.ts` (`Classic Orca` literal)
- `src/renderer/src/App.tsx`
- `package.json` (`homepage`, `description`)
- `Casks/orca.rb`, `Casks/orca@rc.rb` (`name` field)
- `README.md`

**Explicitly NOT changed (was in the original list):**
`src/main/startup/configure-process.ts` (no userData pin), `resources/darwin/bin/orca`
+ `resources/win32/bin/orca.cmd` (executable name pinned `Orca`),
`src/main/startup/dev-instance-identity.ts` `BASE_APP_NAME` (stays `Orca`),
`src/shared/constants.ts` (attribution already off; mobile stays on),
`locales/*.json` (runtime transform — no edits).

### Fork baseline (already configured — do not regress)

- `notes/fork-updater-and-release.md`
- `src/main/updater-prerelease-feed.ts` — `RELEASE_REPO_SLUG = 'shuv1337/orca'`
- `config/electron-builder.config.cjs` — `publish.owner: 'shuv1337'`

### Intentionally unchanged

- `src/main/runtime/orca-runtime.ts`
- `src/shared/constants.ts` — `ORCA_BROWSER_PARTITION`, workspace dir `orca/workspaces`,
  `orca-first` policy values, and other persisted identifiers
- `src/shared/zellij-session-list.ts` — `orca-*` regex
- `src/shared/keybindings.ts` — `orca-first` policy type
- `package.json` — `bin.orca`, `name: "orca"`

---

## Open questions — RESOLVED

1. `homepage` → `https://github.com/shuv1337/orca` for v1 (a future `shuvorca.dev`
   can replace it later without a code dependency).
2. Telemetry stays off in fork builds (PostHog key is build-injected via
   `process.env.n`; absent in the fork → disabled). Set your own key only if you
   want fork-isolated analytics. No code change (D10).
3. Repo rename `orca` → `shuvorca`: **deferred to v2** (changes clone URLs;
   independent of this plan).

## v2 deep rebrand (deferred — not in scope here)

- Rename OS identity (`app.setName`, `appId`) to shuvorca **with automatic
  userData migration** from the legacy Orca profile.
- Unify the CLI command under `shuvorca` (the rebrand removes the GNOME Orca
  conflict, so Linux no longer needs `orca-ide`); migrate existing installs.
- Rename the Computer Use helper (`Orca Computer Use.app`) — touches native
  Swift build + signing.
- Repo slug rename.
