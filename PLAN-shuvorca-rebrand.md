# PLAN: Surface-level rebrand — Orca → ShuvOrca

Fork display identity for `shuv1337/orca` without breaking installs, agent skills,
updater manifests, or macOS privacy permissions.

**Status:** revised after adversarial review  
**Scope:** user-visible product name and packaging labels only  
**Out of scope:** deep renames (paths, env vars, module names, CLI binary, repo slug)

---

## Context

This repo is a fork of upstream Orca (`stablyai/orca`). Fork infrastructure already
exists:

- Auto-updater targets `shuv1337/orca` (`config/electron-builder.config.cjs`,
  `src/main/updater-prerelease-feed.ts`) — see `notes/fork-updater-and-release.md`.
- `appId` / bundle IDs remain `com.stablyai.orca*` so macOS TCC permissions and
  installed-app identity are preserved.
- Production `userData` continuity is **not** guaranteed by `appId` alone.
  The packaged app must explicitly keep using the legacy Orca app-data directory
  before any store, runtime, telemetry, or CLI metadata paths are resolved.
- Release artifact filenames remain `orca-linux.*`, `orca-macos-*.dmg`, etc. for
  updater compatibility.

A **surface rebrand** layers ShuvOrca as the product name users see in the UI,
window chrome, installers, and fork README — while internal contracts stay `orca`.

---

## Decisions (resolve before Phase 1)

Record choices here when made:

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | UI display name casing | `ShuvOrca`, `shuvorca`, `Shuvorca` | **ShuvOrca** in UI; `shuvorca` for slug-style logs only |
| D2 | Upstream doc URLs (`onorca.dev`) | Keep, replace with fork docs, strip help links | **Keep** for minimal rebrand; fork README links to fork releases |
| D3 | GitHub star nag target | `shuv1337/orca`, `stablyai/orca`, disable | **Fork repo** or disable — do not nag users to star upstream |
| D4 | Mobile / App Store CTAs and defaults | Hide, label “upstream Orca mobile”, keep | **Hide or label upstream** — if the fork does not ship mobile, also default mobile entry points off |
| D5 | GitHub attribution footer | Rebrand text, disable, keep upstream | **Rebrand** to ShuvOrca or **disable** in fork settings default |
| D6 | App icons / logo | Keep whale assets, customize later | **Keep** for v1; labels only in Phase 2 |
| D7 | macOS executable name | Keep `Orca`, rename to `ShuvOrca`, launcher detects executable | **Keep `Orca` or make launcher detect `CFBundleExecutable`** — do not break the public `orca` CLI |

---

## Scope matrix

### Change (surface)

| Area | What changes |
|------|----------------|
| `productName` / installer labels | `Orca` → `ShuvOrca` (`ShuvOrca.app` on macOS, while launchable executable compatibility is preserved) |
| Window title, titlebar, onboarding, crash UI | Display name |
| macOS privacy prompt prose | `Orca` → `ShuvOrca` in TCC usage descriptions without changing bundle IDs |
| i18n locale strings (~336 `Orca` hits in `en.json`; ~335-349 per locale) | User-facing prose |
| Settings labels (attribution, mobile button, CLI section headers) | Display name |
| `TERM_PROGRAM` in spawned terminals | `Orca` → `ShuvOrca` across local-provider and daemon-backed PTYs |
| README + fork download links | Fork branding |
| Casks (if used) | `name` field only |
| Star nag + `ORCA_REPO` in GitHub client | Fork repo or off |
| Linux launcher **display** name in desktop entry | ShuvOrca label (binary stays `orca-ide`) |

### Do not change (deep / breaking)

| Area | Why |
|------|-----|
| `appId` `com.stablyai.orca` | macOS TCC reset (notifications, accessibility, screen recording) |
| Bundle IDs `com.stablyai.orca.computer-use`, dev `*.dev.*` | Same |
| User data paths `~/.orca`, `Application Support/Orca` | Profile continuity; explicitly pin legacy paths before `app.setName()` or product-name changes can move data |
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
/** User-visible product name in window chrome, dialogs, and i18n fallbacks. */
export const PRODUCT_DISPLAY_NAME = 'ShuvOrca'

/** Slug-style name for logs or non-UI identifiers (not the CLI command). */
export const PRODUCT_SLUG = 'shuvorca'

/** Public shell command — unchanged for agent skill compatibility. */
export const CLI_COMMAND_NAME = 'orca'

/** Fork release repo for star nag / attribution (if enabled). */
export const FORK_GITHUB_REPO_SLUG = 'shuv1337/orca'

/** Legacy Electron app-data name; changing this loses existing profiles. */
export const LEGACY_USER_DATA_APP_NAME = 'Orca'

/** Packaged executable name expected by the public CLI launcher unless detected dynamically. */
export const LEGACY_PACKAGED_EXECUTABLE_NAME = 'Orca'
```

### Wire consumers

| File | Current | After |
|------|---------|-------|
| `src/main/startup/dev-instance-identity.ts` | `BASE_APP_NAME = 'Orca'` | import `PRODUCT_DISPLAY_NAME` |
| `src/main/window/createMainWindow.ts` | default title `'Orca'` | `PRODUCT_DISPLAY_NAME` |
| `src/main/providers/local-pty-provider.ts` | `TERM_PROGRAM: 'Orca'` | `PRODUCT_DISPLAY_NAME` |
| `src/main/daemon/pty-subprocess.ts` | `TERM_PROGRAM: 'Orca'` | `PRODUCT_DISPLAY_NAME` |
| `src/main/ipc/pty.ts` | attribution / terminal env | `TERM_PROGRAM` via shared constant |
| `src/main/startup/configure-process.ts` | production userData follows Electron default | pin packaged production userData to legacy Orca path |
| `resources/darwin/bin/orca` | hardcoded `Contents/MacOS/Orca` | keep executable name valid or read `CFBundleExecutable` |
| `config/electron-builder.config.cjs` | `productName: 'Orca'` | read from small `config/product-brand.cjs` shim that mirrors shared values (CJS cannot import TS directly) |

Renderer components with hardcoded `'Orca'` translate fallbacks should import
`PRODUCT_DISPLAY_NAME` instead of string literals.

---

## Implementation phases

### Phase 1 — Core constant + packaging + main process

**Goal:** Packaged app shows ShuvOrca in OS shell and main-process surfaces.

- [ ] Add `src/shared/product-brand.ts`
- [ ] Add `config/product-brand.cjs` (re-exports same strings for electron-builder)
- [ ] Pin packaged production `userData` to the legacy Orca app-data directory in
  `src/main/startup/configure-process.ts` before `configureOrcaUserDataPathEnv()`,
  `initDataPath()`, `initStatsPath()`, and every runtime/CLI metadata path read.
  - [ ] Keep E2E, `ORCA_DEV_USER_DATA_PATH`, and dev `orca-dev` overrides unchanged.
  - [ ] Add a regression test that a packaged/non-dev ShuvOrca identity still resolves
        `app.getPath('userData')` to the legacy Orca profile path.
- [ ] Update `config/electron-builder.config.cjs`:
  - [ ] `productName` from product-brand shim
  - [ ] **Keep** `appId: 'com.stablyai.orca'`
  - [ ] **Keep** all `artifactName`, `executableName`, launcher names
  - [ ] Preserve packaged CLI compatibility on macOS: either keep `CFBundleExecutable`
        as `Orca` or update `resources/darwin/bin/orca` to read the executable name
        from `Contents/Info.plist`.
  - [ ] Update macOS TCC usage descriptions from “Orca allows...” to ShuvOrca wording
        while keeping every bundle ID and entitlement path unchanged.
- [ ] Update `src/main/startup/dev-instance-identity.ts` — `BASE_APP_NAME`
- [ ] Update `src/main/window/createMainWindow.ts` — default window title
- [ ] Update `src/main/providers/local-pty-provider.ts` — `TERM_PROGRAM`
- [ ] Update `src/main/daemon/pty-subprocess.ts` — `TERM_PROGRAM`
- [ ] Update `src/main/ipc/pty.ts` and tests expecting `TERM_PROGRAM: 'Orca'`
- [ ] Update packaged CLI launcher tests for macOS, Windows, and Linux when executable
      lookup text or behavior changes.
- [ ] Update `src/main/index.ts` comment references only if misleading (optional)

**Linux packaging notes** (`config/electron-builder.config.cjs`):

- [ ] Keep `executableName: 'orca-ide'` (Ubuntu GNOME Orca conflict)
- [ ] Keep `StartupWMClass: 'orca'` (Electron WM_CLASS; dock grouping)
- [ ] Add desktop `Name=ShuvOrca` via `linux.desktop.entry` if electron-builder supports it; verify generated `.desktop` file label
- [ ] Update user-facing error string in `resources/linux/bin/orca-ide` (“Unable to locate the Orca executable…”)

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

- [ ] macOS: dock / menu shows ShuvOrca; bundle is `ShuvOrca.app`
- [ ] macOS: generated `Info.plist` `CFBundleExecutable` matches what the public
      `resources/darwin/bin/orca` launcher executes.
- [ ] macOS: `orca --help` works from an installed packaged build after the rebrand.
- [ ] Startup diagnostics or direct inspection confirm production `userData` is still
      the legacy Orca profile path, not a new ShuvOrca profile.
- [ ] Linux: launcher label ShuvOrca; `orca-ide` binary still launches
- [ ] Local-provider and daemon-backed terminals: `echo $TERM_PROGRAM` → `ShuvOrca`
- [ ] `~/.orca` and `Application Support/Orca` still used (no path migration)

---

### Phase 2 — Renderer hardcoded strings

**Goal:** Non-i18n UI surfaces show ShuvOrca before locale bulk pass.

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
| `src/shared/app-icon.ts` | `Classic Orca` → `Classic ShuvOrca` (etc.) |

- [ ] Replace hardcoded `'Orca'` fallbacks with `PRODUCT_DISPLAY_NAME` import
- [ ] Keep identifier/data labels unchanged where `Orca` is describing an internal source
      value such as automation target `orca`, repo fixture data, or protocol names.
- [ ] Leave comments in `Terminal.tsx` / `App.tsx` that describe layout (“Orca title”) — update only if confusing

**Validation:**

```bash
pnpm tc:web
pnpm test -- src/renderer/src/components/status-bar/zellij-session-display.test.ts  # unrelated smoke
```

- [ ] Dev UI: titlebar reads ShuvOrca with `pnpm dev`

---

### Phase 3 — i18n bulk pass (English first)

**Goal:** All translated UI strings use ShuvOrca in user-facing prose.

**Scale:** `src/renderer/src/i18n/locales/en.json` has ~336 whole-word `Orca`
hits; non-English locale files have ~335-349 each. Recount before editing.

**Procedure:**

- [ ] Export list of keys whose **default English value** contains `Orca`:
   ```bash
   node -e "
   const en = require('./src/renderer/src/i18n/locales/en.json');
   const hits = [];
   function walk(o, p) {
     for (const [k,v] of Object.entries(o)) {
       const path = p ? p+'.'+k : k;
       if (typeof v === 'string' && /Orca/i.test(v)) hits.push({ path, v });
       else if (v && typeof v === 'object') walk(v, path);
     }
   }
   walk(en, '');
   console.log(hits.length);
   "
   ```
- [ ] Export the matching source fallback strings from `t(..., 'fallback')`,
   `translate(..., 'fallback')`, and `translateMain(..., 'fallback')` call sites.
   The localization verifier checks key presence and locale parity; it does not
   rewrite existing `en.json` values when fallback text changes.
- [ ] Scripted replace on **English user-facing values and source fallbacks**:
   - Replace `Orca` → `ShuvOrca` in `en.json` values that are product prose
   - Replace matching source fallback strings so source and catalog do not drift
   - **Do not** change i18n keys or structural keys like `exploreOrca`
   - **Do not** change enum/string data values such as `orca-first`, target
     value `orca`, repo fixture names, protocol names, or internal IDs
- [ ] Manual review queue (do not blind replace):

   | Pattern | Action |
   |---------|--------|
   | `Non-Orca worktrees` | → `Non-ShuvOrca worktrees` or `Other worktrees` |
   | `Orca Attribution` | → `ShuvOrca Attribution` |
   | `Orca Mobile` / App Store links | Hide CTA or prefix “Upstream Orca” per D4 |
   | `orca-first` in **values** | **Never** — enum value, not display text |
   | Automation target label `Orca` | Decide if this means product UI or source type before replacing |
   | `Orca server/runtime/client` | Replace only where it is user-facing product prose, not protocol data |
   | Spanish `· Orcas` (`835037edc9`) | Grammar fix after replace |
   | URLs `onorca.dev` | Per D2 — keep or replace individually |

- [ ] Run localization tooling:
   ```bash
   pnpm verify:localization-catalog
   pnpm sync:localization-catalog   # only repairs missing keys / locale parity; it does not rewrite existing English values
   pnpm verify:localization-coverage
   ```

- [ ] Locale follow-up (`zh`, `ko`, `ja`, `es`):
   - Option A: mechanical replace `Orca` → `ShuvOrca` in each locale file + native speaker spot-check
   - Option B: `pnpm bootstrap:locale-catalog` per locale from updated English (may be lossy)
   - Recommended: **Option A** for fork; run `repair:locale-catalog` if catalog drifts

**Settings strings to verify manually:**

- `ShortcutTerminalPolicyControl.tsx` — “Choose whether Orca or the focused terminal…”
- GitHub attribution section (`e02ea23a32`, `bc7d9f69ce`)
- Star nag (`6922c1fa2b`, `36a72f0d9e`)
- Update card / restart prompts (`6714206e5a`, `ad3d3ed7f1`)
- CLI installer strings (`79371593b0` through `15cbedc3e3`)

**Validation:**

- [ ] `pnpm lint` (includes localization gates)
- [ ] `rg -n "\\bOrca\\b|orca-first|onorca\\.dev" src/renderer/src/i18n/locales`
      reviewed into allow/change buckets
- [ ] Spot-check: onboarding, settings → General, settings → Shortcuts, update card, crash dialog
- [ ] No `orca-first` value corrupted in JSON

---

### Phase 4 — Fork URLs, star nag, attribution

**Goal:** Fork-specific touchpoints do not promote upstream Orca by default.

| File | Change |
|------|--------|
| `src/main/github/client.ts` | `ORCA_REPO` → `FORK_GITHUB_REPO_SLUG` from product-brand (or disable star check) |
| `src/main/star-nag/service.ts` | Confirm star action uses fork repo |
| `src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.tsx` | `DOCS_URL`, `CHANGELOG_URL` per D2 |
| `src/main/updater-changelog.ts` | `CHANGELOG_URL` — fork or disable |
| `src/main/updater-nudge.ts` | `onorca.dev/whats-new/nudge.json` — disable or fork endpoint |
| `src/renderer/src/lib/telemetry.ts` | `PRIVACY_URL` per D2 |
| `src/shared/feature-wall-tiles.ts` | `docsUrl` fields per D2 |
| `src/shared/feature-wall-workflows.ts` | `docsUrl` fields per D2 |
| `src/renderer/src/components/settings/GeneralSupportSection.tsx` | star/repo labels per D3 |
| `src/shared/constants.ts` | mobile defaults and attribution defaults per D4/D5 |

- [ ] Implement D3 (star nag target)
- [ ] Implement D2 (doc URLs — minimal: README only; or code URLs too)
- [ ] Implement D5 (attribution default in `getDefaultSettings()` if disabling)
- [ ] Implement D4:
  - [ ] If fork mobile is not shipped, default mobile entry points off
        (`showMobileButton`, relevant CTAs/settings), or label every app-store/APK
        path as upstream Orca.
  - [ ] If desktop mobile-pairing is still supported by the fork, document that
        distinction and only hide/relabel distribution links.
- [ ] Run a runtime + docs URL audit and classify every hit:
  ```bash
  rg -n "stablyai/orca|onorca\\.dev|apps\\.apple\\.com|orca_build|discord\\.gg" \
    README.md docs/readme package.json src/main src/renderer/src src/shared
  ```
  Allowed hits must have a written reason: test fixture, upstream docs retained by D2,
  upstream mobile label, or historical note.

**Validation:**

- [ ] Star nag opens / checks `shuv1337/orca` (or feature disabled)
- [ ] Help menu does not 404 to wrong product without user context
- [ ] Settings → General star/support labels do not ask users to star upstream
- [ ] Mobile App Store/APK CTAs are hidden or explicitly labeled upstream
- [ ] Updater still uses `shuv1337/orca` releases (unchanged from fork baseline)

---

### Phase 5 — Docs, metadata, distribution

- [ ] `README.md` — fork banner, ShuvOrca title, download → `https://github.com/shuv1337/orca/releases`
- [ ] Remove or relabel upstream-only badges (Discord, onorca.dev download, mobile App Store) per D4
- [ ] `docs/readme/README.*.md` — same fork banner or explicit defer note in PR
- [ ] `package.json` — update `description`, `homepage` to fork; keep `name` and `bin.orca`
- [ ] `Casks/orca.rb`, `Casks/orca@rc.rb` — `name "ShuvOrca"`; keep zap paths (`com.stablyai.orca`)
- [ ] `AGENTS.md` — short note: display name ShuvOrca, internal identifiers remain `orca`
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
| 1 | Phase 1 — product-brand + packaging + userData / launcher safety | — |
| 2 | Phase 2 — renderer hardcoded strings | PR 1 |
| 3 | Phase 3 — en.json + localization gates | PR 2 |
| 4 | Phase 3b — zh/ko/ja/es locales | PR 3 |
| 5 | Phase 4 — URLs, star nag, attribution, mobile defaults | PR 1 |
| 6 | Phase 5 — README, Casks, AGENTS | PR 3 |
| 7 | Phase 6 — icons (optional) | any |

Keep PRs small enough for review; Phases 4+5 can merge together if low conflict.

---

## Full regression checklist (pre-release)

### Build & tests

- [ ] `pnpm tc`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm build:linux` or `pnpm build:mac` (host arch)

### Functional smoke

- [ ] App launches; titlebar shows ShuvOrca
- [ ] Packaged `orca` CLI on PATH still works (`orca --help`) on macOS/Windows;
      packaged Linux `orca-ide` still works and does not shadow system `orca`
- [ ] Agent skill setup still references `orca` command (not ShuvOrca)
- [ ] Create worktree → `.orca/` dir still created in repo (unchanged)
- [ ] Zellij sessions (if enabled) still use `orca-*` naming
- [ ] Auto-updater checks `shuv1337/orca` draft/published release
- [ ] Existing `~/.orca` profile loads (settings, repos, worktrees)
- [ ] Existing Electron app-data profile loads from legacy Orca userData path after
      productName/app name changes
- [ ] Local-provider and daemon-backed terminals both expose `TERM_PROGRAM=ShuvOrca`
- [ ] Runtime/docs URL audit has no unreviewed upstream promotion hits

### Platform-specific

- [ ] **macOS:** Notifications still work (TCC not reset — same `appId`)
- [ ] **macOS:** Generated `Info.plist` executable name matches packaged CLI launcher
- [ ] **macOS:** Computer Use helper still signs with `com.stablyai.orca.computer-use`
- [ ] **Linux:** `orca-ide` launcher works; no conflict with system `orca` package
- [ ] **Windows:** Installer title ShuvOrca; shortcut opens app

### i18n

- [ ] Switch UI language to es/ja/zh/ko — no raw English “Orca” in primary chrome
- [ ] `pnpm verify:localization-catalog` clean

---

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| TCC / permissions reset | High if `appId` changed | **Never change `appId`** in this plan |
| Profile loss | High if userData path changed | Explicitly pin packaged production userData to the legacy Orca path before any store/runtime path reads |
| Packaged CLI break | High if macOS/Windows executable name changes under existing launchers | Keep executable name compatible or make launchers detect the packaged executable |
| Agent skills break | High if CLI renamed | Keep `orca` binary; UI says “ShuvOrca CLI” |
| Updater break | High if artifact names changed | Keep `orca-*` release filenames |
| Upstream merge conflicts | Medium | Central `product-brand.ts`; minimal touch to `orca-runtime` |
| i18n grammar / bad replace | Medium | Manual review queue; Spanish `Orcas` etc. |
| Runtime/docs promote upstream unintentionally | Medium | Required `rg` audit with allowed/denied buckets after Phase 4/5 |
| Mobile UX misrepresents fork support | Medium | D4 decides default/hide/label behavior before changing mobile strings |
| Two products same `appId` | Low | Document: fork replaces upstream install slot on macOS |

---

## Effort estimate

| Phase | Estimate |
|-------|----------|
| 1 — constant + packaging + userData/launcher safety | 0.75–1 day |
| 2 — hardcoded renderer | 0.25 day |
| 3 — en.json + tooling | 0.5–1 day |
| 3b — other locales | 0.5–1 day |
| 4 — URLs / star nag / mobile defaults | 0.75 day |
| 5 — README / metadata | 0.25–0.5 day |
| 6 — icons (optional) | 0.5 day |

**Total:** ~3–4 days without custom icons.

---

## Reference files

### Branding sources (change)

- `src/shared/product-brand.ts` (new)
- `config/product-brand.cjs` (new)
- `config/electron-builder.config.cjs`
- `src/main/startup/configure-process.ts`
- `src/main/startup/dev-instance-identity.ts`
- `src/main/window/createMainWindow.ts`
- `src/main/providers/local-pty-provider.ts`
- `src/main/daemon/pty-subprocess.ts`
- `src/main/ipc/pty.ts`
- `resources/darwin/bin/orca`
- `resources/win32/bin/orca.cmd`
- `resources/linux/bin/orca-ide`
- `src/main/github/client.ts`
- `src/main/updater-changelog.ts`
- `src/main/updater-nudge.ts`
- `src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.tsx`
- `src/renderer/src/components/settings/GeneralSupportSection.tsx`
- `src/renderer/src/lib/telemetry.ts`
- `src/shared/constants.ts` (mobile / attribution defaults only, if D4/D5 require it)
- `src/shared/feature-wall-tiles.ts`
- `src/shared/feature-wall-workflows.ts`
- `src/renderer/src/i18n/locales/en.json` (+ zh, ko, ja, es)
- `src/renderer/src/App.tsx`
- `README.md`

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

## Open questions (track in PR descriptions)

1. Should `homepage` in `package.json` point to fork GitHub or a future `shuvorca.dev`?
2. Should telemetry / PostHog project remain upstream or fork-isolated?
3. Rename git repo `orca` → `shuvorca` later? (separate from this plan; breaks fewer things than expected but changes clone URLs)
