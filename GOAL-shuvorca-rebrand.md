# GOAL: Ship the shuvorca v1 surface rebrand, end to end

Execute the v1 surface rebrand of the Orca fork to **shuvorca**, from the current
working tree to a released build, without breaking installs, profiles, macOS
permissions, the packaged CLI, agent skills, or the updater.

**Authority docs (read first):**
- `PLAN-shuvorca-rebrand.md` — full scope, decisions D1–D10, phase detail
- `CONTEXT.md` — glossary (display name vs Orca app identity vs CLI command)
- `docs/adr/0001-v1-preserves-orca-os-identity.md` — why OS identity stays `Orca`
- `docs/adr/0002-runtime-i18n-brand-transform.md` — why i18n is a runtime transform

**Invariants (must hold at every step):**
- `app.setName('Orca')` / `BASE_APP_NAME = 'Orca'` — **never changed** (userData key)
- `appId: 'com.stablyai.orca'` and all bundle IDs — unchanged
- macOS binary stays `Contents/MacOS/Orca`; `resources/darwin/bin/orca` untouched
- CLI binaries `orca` / `orca-ide` — unchanged; only agent-facing *strings* fixed
- Release `artifactName` patterns (`orca-*`) and updater repo `shuv1337/orca` — unchanged
- `locales/*.json` — byte-identical to upstream (transform does the rebrand)
- Brand token is lowercase `shuvorca` everywhere, every sentence position

**Definition of done:** packaged build on host arch shows `shuvorca` in OS shell,
window, and localized UI; existing profile loads; `orca --help` works; Linux agent
gets `orca-ide` in hints; no star nag / upstream feeds; `pnpm tc && pnpm test &&
pnpm lint` green; release artifacts publish to `shuv1337/orca`.

---

## Step 0 — Branch & baseline

- [ ] Confirm on `shuv1337/shuvorca-rebrand` (already is); working tree currently
      holds `PLAN`, `CONTEXT`, `docs/adr/*`, `GOAL` (docs only — no code yet)
- [ ] Baseline green: `pnpm tc && pnpm test && pnpm lint`
- [ ] Decide commit/PR cadence with the user before pushing (do not push unasked)

---

## PR 1 — Core constant + packaging + main-process surfaces (Phase 1)

**Outcome:** packaged app shows `shuvorca` in OS shell; profile + CLI + perms intact.

### 1a. Brand source of truth
- [ ] Create `src/shared/product-brand.ts`:
  - `PRODUCT_DISPLAY_NAME = 'shuvorca'`
  - `cliCommandName(platform = process.platform)` → `'orca-ide'` if linux else `'orca'`
  - `FORK_GITHUB_REPO_SLUG = 'shuv1337/orca'`
  - `LEGACY_USER_DATA_APP_NAME = 'Orca'`, `LEGACY_PACKAGED_EXECUTABLE_NAME = 'Orca'`
  - (No `PRODUCT_SLUG`; no flat `CLI_COMMAND_NAME`.) Add `// why` comment that the
    legacy constants pin OS identity per ADR-0001.
- [ ] Create `config/product-brand.cjs` mirroring `productName`/`executableName`
      strings (CJS cannot import the TS module).

### 1b. electron-builder (`config/electron-builder.config.cjs`)
- [ ] `productName: 'Orca'` (line ~50) → read `shuvorca` from `product-brand.cjs`
- [ ] Add to the **mac** block: `executableName: 'Orca'` (D7) — keeps `Contents/MacOS/Orca`
- [ ] Leave `appId` (line ~49), win `executableName: 'Orca'` (line ~148), linux
      `executableName: 'orca-ide'` (line ~247), all `artifactName`, `StartupWMClass`,
      and the `Orca Computer Use.app` copy/sign paths **unchanged**
- [ ] Rewrite TCC usage-description prose `"Orca allows..."` → `"shuvorca allows..."`
      (lines ~178–195); keep `NSCamera/NSMicrophone` generic strings as-is
- [ ] Linux desktop entry: add `Name=shuvorca` if supported; verify generated `.desktop`

### 1c. Main-process display surfaces
- [ ] `src/main/window/createMainWindow.ts` — default title `'Orca'` → `PRODUCT_DISPLAY_NAME`
- [ ] `src/main/providers/local-pty-provider.ts:338` — `TERM_PROGRAM` → `PRODUCT_DISPLAY_NAME` (D9)
- [ ] `src/main/daemon/pty-subprocess.ts:323` — `TERM_PROGRAM` → `PRODUCT_DISPLAY_NAME` (D9)
- [ ] `src/main/ipc/pty.ts` — terminal env via shared constant
- [ ] Update tests asserting `TERM_PROGRAM === 'Orca'`:
      `ipc/pty.test.ts:620`, `local-pty-provider.test.ts:187`, `pty-subprocess.test.ts`
- [ ] `resources/linux/bin/orca-ide` — error string "Unable to locate the Orca…" → `shuvorca`
- [ ] **Do NOT** touch `dev-instance-identity.ts` `BASE_APP_NAME`,
      `configure-process.ts` (no userData pin), or `resources/darwin/bin/orca`

### 1d. Validate PR 1
```bash
pnpm tc
pnpm test -- \
  src/main/ipc/pty.test.ts \
  src/main/daemon/pty-subprocess.test.ts \
  src/main/providers/local-pty-provider.test.ts \
  src/main/cli/cli-installer.test.ts \
  src/main/cli/packaged-cli-assets.test.ts
pnpm build:mac   # or build:linux on this host (Linux)
```
- [ ] Host build: dock/menu shows `shuvorca`; bundle is `shuvorca.app` (mac)
- [ ] mac `Info.plist` `CFBundleExecutable` == `Orca`; `orca --help` works from build
- [ ] `app.getPath('userData')` still `…/Application Support/Orca` (or `~/.config/orca`)
- [ ] Linux: launcher labeled `shuvorca`; `orca-ide` launches; system `orca` unaffected
- [ ] `echo $TERM_PROGRAM` in a spawned terminal → `shuvorca`

---

## PR 2 — Renderer literals + CLI command bug fix (Phase 2 + D8)

**Outcome:** non-translate UI literals show `shuvorca`; agents get the right command.

### 2a. Non-translate literals → `PRODUCT_DISPLAY_NAME`
(Only literals NOT routed through `translate()`; the i18n transform in PR 3 covers the rest.)
- [ ] `src/renderer/src/App.tsx` — titlebar `aria-label` / visible title
- [ ] `src/renderer/src/components/onboarding/OnboardingFlow.tsx` — logo row label
- [ ] `src/renderer/src/components/crash-report/CrashReportDialogSurface.tsx` — header
- [ ] `src/renderer/src/web/web-preload-api.ts` — web surface `name`
- [ ] `src/shared/app-icon.ts` — `Classic Orca` → `Classic shuvorca` (etc.)
- [ ] Status-bar / automations fallbacks listed in PLAN Phase 2 table
- [ ] Keep internal source labels (`orca` automation target, fixtures, protocols) as-is

### 2b. CLI command strings (D8 — the bug you flagged)
- [ ] Route agent-facing / instructional command strings through `cliCommandName(platform)`:
  - `src/shared/computer-use-error-recovery.ts` (`orca computer …` hints)
  - `src/cli/help.ts` (usage output)
  - any other hardcoded `orca …` user/agent-facing instruction
- [ ] Reuse existing platform logic (`cli-installer.ts:67`) — do not duplicate
- [ ] `src/shared/*` runs in both processes; pass an explicit platform when the
      renderer needs it (preload-exposed), since `process.platform` is main-only

### 2c. Validate PR 2
```bash
pnpm tc:web && pnpm tc
pnpm test -- src/shared/computer-use-error-recovery.test.ts   # if present
```
- [ ] Dev UI titlebar reads `shuvorca` (`pnpm dev`)
- [ ] On Linux, computer-use recovery hints say `orca-ide …`, not `orca …`

---

## PR 3 — i18n runtime transform (Phase 3, ADR-0002)

**Outcome:** all five locales render `shuvorca` with zero locale-file edits.

- [ ] Add `applyBrand(value)` → `value.replace(/\bOrca\b/g, PRODUCT_DISPLAY_NAME)`
      (capital-O boundary skips `onorca.dev`, `orca-first`, `ORCA_*`, lowercase data)
- [ ] Apply in `src/renderer/src/i18n/i18n.ts` `translate()` (line ~43), composed
      with the existing `pseudoLocalizeString` post-process
- [ ] Apply in `src/main/i18n/main-i18n.ts` `translateMain()` (line ~68), same way
- [ ] **Curated exceptions:**
  - Mobile strings → keep "Orca Mobile" verbatim (exempt via `(?! Mobile)` lookahead); the fork ships no mobile app (D4)
  - `Non-Orca worktrees` → `Other worktrees`
  - Spanish `Orcas` plural — add explicit rule or accept
- [ ] Audit the ~12 `useTranslation` callers — ensure none render raw `t()` that
      bypasses the seam; route stragglers through `translate()`
- [ ] Verify transform composes with `pseudo-localization.test.ts`

### Validate PR 3
```bash
pnpm lint            # includes localization gates — expect zero locale-file churn
pnpm verify:localization-catalog
git status src/renderer/src/i18n/locales   # must be clean
```
- [ ] Run app in `es`/`ja`/`zh`/`ko`: primary chrome shows `shuvorca`, no raw `Orca`
- [ ] Mobile CTA reads "Orca Mobile", not "shuvorca Mobile"
- [ ] No identifier (`orca-first`, etc.) altered in rendered output

---

## PR 4 — Fork policy: disable nags/feeds, label mobile (Phase 4)

**Outcome:** the fork stops promoting upstream by default.

- [ ] `src/main/star-nag/service.ts` — disable the star nag (D3); remove the
      "star Orca on GitHub" prompt path. `github/client.ts` star helpers become
      unused — drop the dead path or leave inert
- [ ] `src/main/updater-changelog.ts` — disable the `onorca.dev/whats-new/changelog.json`
      fetch (line ~49) (D2)
- [ ] `src/main/updater-nudge.ts` — disable the `onorca.dev/whats-new/nudge.json` fetch (line ~15) (D2)
- [ ] Mobile strings added to the i18n curated-exception list (PR 3) — confirm here
- [ ] **No change** to `constants.ts` (attribution already `false` @186 — D5; mobile
      stays on — D4) or telemetry (off unless build injects `n` — D10)
- [ ] Keep help-menu docs/Discord/privacy links for v1 (D2)

### Validate PR 4
- [ ] Star nag never appears
- [ ] Update check fetches no upstream changelog/nudge; updater still uses `shuv1337/orca`
- [ ] No telemetry unless a PostHog key was injected at build

---

## PR 5 — Docs & distribution metadata (Phase 5)

- [ ] `README.md` — fork banner, `shuvorca` title, download → `github.com/shuv1337/orca/releases`;
      relabel/remove upstream-only badges
- [ ] `docs/readme/README.*.md` — fork banner or explicit defer note
- [ ] `package.json` — `homepage` → `https://github.com/shuv1337/orca` (line ~5),
      update `description`; **keep** `name: "orca"` and `bin.orca`
- [ ] `Casks/orca.rb`, `Casks/orca@rc.rb` — `name "shuvorca"`; keep zap paths (`com.stablyai.orca`)
- [ ] `AGENTS.md` — note: display name `shuvorca`, internal identifiers stay `orca`
- [ ] `notes/fork-updater-and-release.md` — cross-link this GOAL + PLAN

### Validate PR 5
- [ ] README renders; primary download link not pointed at upstream
- [ ] `pnpm tc && pnpm lint` green

---

## PR 6 — Visual identity (optional, deferred)

- [ ] Only if custom artwork is wanted (D6 = keep whale for v1). Otherwise skip.

---

## Final pre-release gate (run before tagging)

```bash
pnpm tc
pnpm test
pnpm lint
pnpm build:linux   # or build:mac on a Mac host
```
- [ ] App launches; titlebar + OS shell show `shuvorca`
- [ ] Existing `~/.orca` and `Application Support/Orca` profile loads (settings/repos/worktrees)
- [ ] Packaged `orca --help` (mac/win) / `orca-ide` (linux) works; no system `orca` shadow
- [ ] Agent skill setup references `orca`/`orca-ide` (never `shuvorca`)
- [ ] Worktree create still makes `.orca/`; zellij sessions still `orca-*`
- [ ] Auto-updater checks `shuv1337/orca` release
- [ ] **macOS:** notifications work (TCC not reset); `CFBundleExecutable == Orca`;
      Computer Use helper signs `com.stablyai.orca.computer-use` (TCC prompt still
      "Orca Computer Use" — known v1 gap → v2)
- [ ] i18n: switch to es/ja/zh/ko — no raw `Orca` in primary chrome
- [ ] `git status src/renderer/src/i18n/locales` clean

---

## Execution notes

- **Order:** PR 1 → 2 → 3 → 5 are sequential (5 depends on 3); PR 4 depends only
  on PR 1 and can run in parallel with 2/3. PRs 4+5 may merge together if low conflict.
- **Suggested driver:** `/lazy-implementer` against this file, one PR at a time,
  checking boxes as it goes; or hand each PR section to a focused agent.
- **Commit messages:** conventional; end with the required `Co-Authored-By` trailer.
  Do not push or open PRs until the user asks.
- **If a step contradicts an invariant above, stop** — the invariant wins (it
  encodes ADR-0001/0002 and the profile/permission safety guarantees).
```
