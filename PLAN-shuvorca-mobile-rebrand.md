# PLAN: Fork mobile coverage — shuvorca mobile rebrand + iOS/Xcode setup

Extend the shuvorca fork to ship its own **mobile companion app** (iOS first,
Android follow-on), with local Xcode builds on macOS and fork-specific store /
release links wired through the desktop app.

**Status:** draft for macOS handoff  
**Depends on:** `PLAN-shuvorca-rebrand.md`, `CONTEXT.md`, `docs/adr/0001`, `docs/adr/0002`  
**Handoff target:** macOS dev machine with Xcode + Apple Developer access

---

## Executive summary

The repo already contains the full **Expo/React Native application source** under
`mobile/` (~266 tracked files). What is missing for fork coverage:

1. **Rebrand** — user-visible strings, icons policy, store URLs, and desktop CTAs
   still point at upstream **Orca Mobile** / `stablyai/orca` releases.
2. **Generated native shell** — `mobile/ios/` is gitignored; Xcode project is
   produced by `expo prebuild` on a Mac.
3. **Signing & distribution** — no in-repo Apple credentials, no iOS CI job, no
   fork App Store listing.
4. **Decision reversal** — v1 desktop rebrand **D4** explicitly kept "Orca Mobile"
   as an upstream-only product. This plan **supersedes D4 for the fork** once
   fork mobile ships.

**Non-goal:** Rewriting the mobile app in native Swift. It stays Expo/RN.

---

## New decisions (resolve before coding)

| # | Question | Recommended resolution | Rationale |
|---|----------|----------------------|-----------|
| M1 | User-visible app name | **`shuvorca`** (lowercase, D1) on home screen / About / splash config | Matches desktop display brand; avoid "shuvorca Mobile" unless App Store metadata needs a subtitle |
| M2 | Desktop references to companion app | Rebrand strings from "Orca Mobile" → **"shuvorca"** (or "shuvorca app" where grammar needs a noun) | D4 exemption removed once fork ships mobile |
| M3 | iOS bundle identifier | **New ID**, not `com.stably.orca.mobile` | Separate App Store listing; cannot reuse upstream listing `id6766130217` |
| M4 | Android applicationId | **Same new namespace as iOS** (e.g. `dev.shuv.orca.mobile`) | Parallel fork store identity |
| M5 | URL scheme `orca` in `app.json` | **Keep `orca`** for v1 | Pairing protocol uses `orca://pair#…`; changing scheme is deep-rebrand scope |
| M6 | Internal npm scope `@orca/expo-two-way-audio` | **Keep unchanged** | Internal module name; mergeability with upstream |
| M7 | App icons | **Phase 1: keep whale assets** (D6 parity); optional Phase 2 custom icon | Labels-only first ship |
| M8 | Distribution v1 | **TestFlight + sideload/dev-client** for internal dogfood; App Store public listing as Phase 2 | Faster iteration; store review is a gate |
| M9 | Desktop download links | Point iOS CTA to **fork TestFlight / App Store URL**; Android APK to **`shuv1337/orca` GitHub Releases** | Replace hardcoded `stablyai/orca` URLs |
| M10 | Protocol / pairing compatibility | **No protocol bump** for rebrand-only changes | Wire format unchanged; only strings and bundle IDs |

### Bundle ID candidates (pick one in Phase 0)

Use a namespace you control in Apple Developer:

- `dev.shuv.orca.mobile` (readable, distinct from upstream)
- `com.shuv1337.orca.mobile` (matches GitHub org)

Document the choice in `docs/adr/0003-fork-mobile-identity.md` (new ADR).

---

## Architecture

### Brand source of truth (mobile)

Desktop brand lives in `src/shared/product-brand.ts`. Mobile **cannot import**
parent-repo modules today (see comment in
`mobile/src/transport/protocol-version.ts` — Metro resolves inside `mobile/`).

**Add** `mobile/src/product-brand.ts` mirroring the desktop constants the mobile
app needs:

```ts
export const PRODUCT_DISPLAY_NAME = 'shuvorca'
export const FORK_GITHUB_REPO_SLUG = 'shuv1337/orca'
export const COMPANION_APP_NAME = 'shuvorca' // was "Orca Mobile"
export function applyProductBrand(value: string): string { /* same rules as desktop, minus D4 exemption */ }
```

**Manual sync rule:** When desktop `applyProductBrand` exception list changes,
update mobile copy in the same PR. Longer-term optional: extract shared file to
`packages/product-brand/` consumed by both trees — defer unless duplication hurts.

### What changes vs stays internal

| Surface | v1 change |
|---------|-----------|
| `app.json` `expo.name`, permission strings, plugin permission copy | → shuvorca |
| UI strings in `mobile/app/**`, `mobile/src/**` | → use `PRODUCT_DISPLAY_NAME` / `applyProductBrand` |
| `ProtocolBlockScreen` store + GitHub URLs | → fork URLs |
| Desktop `MobileSettingsPane`, `mobile-platform-copy.ts` | → fork URLs + shuvorca copy |
| Desktop `applyProductBrand` D4 `(?! Mobile)` exemption | → **remove** |
| `scheme: "orca"`, `orca://pair` pairing | **unchanged** |
| `@orca/expo-two-way-audio`, `slug: orca-mobile` | **unchanged** (internal) |
| Upstream App Store id `6766130217` | **removed from fork** |

---

## Rebrand inventory (grep-driven)

Run before and after rebrand to diff coverage:

```bash
cd mobile
rg -n '\bOrca\b' --glob '!pnpm-lock.yaml' --glob '!*.test.ts'
rg -n 'stablyai/orca' .
rg -n '6766130217' .
```

### High-priority user-visible files

| File | Examples to rebrand |
|------|---------------------|
| `mobile/app.json` | `expo.name`, all `*Permission*` strings, `infoPlist` usage descriptions |
| `mobile/app/index.tsx` | Brand header, pairing copy |
| `mobile/app/about.tsx` | Brand name |
| `mobile/app/pair-scan.tsx` | QR validation errors, step text |
| `mobile/app/troubleshoot.tsx` | Firewall / restart instructions (desktop = shuvorca) |
| `mobile/app/terminal-settings.tsx` | Terminal fit copy |
| `mobile/app/h/[hostId]/tasks.tsx` | Feature-gate errors ("Update … desktop") |
| `mobile/src/components/ProtocolBlockScreen.tsx` | Titles, bodies, `RELEASES_URL`, `IOS_APP_STORE_URL` |
| `mobile/src/session/mobile-diff-review-loaders.ts` | Desktop version gate message |
| `mobile/src/browser/MobileBrowserPane.tsx` | Desktop version gate message |
| `mobile/src/transport/rpc-client.ts` | Error string (keep "runtime" generic or say shuvorca) |

### Desktop-side files (fork mobile CTAs)

| File | Change |
|------|--------|
| `src/shared/product-brand.ts` | Remove D4 `(?! Mobile)` exemption; update comment |
| `src/shared/product-brand.test.ts` | Expect "Open shuvorca" not "Open Orca Mobile" |
| `src/renderer/src/components/settings/MobileSettingsPane.tsx` | Fork iOS + Android URLs |
| `src/renderer/src/components/mobile/mobile-platform-copy.ts` | Fork store / APK URLs |
| `src/main/menu/register-app-menu.test.ts` | Menu label expectations |

### Low priority / non-shipping

| File | Action |
|------|--------|
| `mobile/mock-*.html` | Update or mark dev-only |
| `mobile/README.md` | Fork branding + Xcode section (this plan) |
| `mobile/scripts/mock-server.ts` | Log prefix optional |
| Test fixtures with `"Orca"` as **code sample text** | Keep literal (syntax highlighting tests) |
| `mobile/constants/marine-creatures.ts` | Keep `'Orca'` animal name |

---

## macOS / Xcode setup (handoff checklist)

All commands assume repo root `/path/to/orca` unless noted.

### 0. Machine prerequisites

- [ ] macOS 14+ (match team standard)
- [ ] Xcode 16+ from App Store
- [ ] Xcode CLI tools: `xcode-select --install`
- [ ] Accept license: `sudo xcodebuild -license accept`
- [ ] Node.js **24+** (match `mobile/README.md`)
- [ ] pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)
- [ ] CocoaPods: `brew install cocoapods` (Expo prebuild uses Pods)
- [ ] Apple Developer Program membership with permission to create App IDs,
      provisioning profiles, and TestFlight builds
- [ ] (Physical device testing) iPhone on same LAN as desktop for pairing

Verify:

```bash
node -v          # v24.x
pnpm -v
xcodebuild -version
pod --version
```

### 1. Install JS dependencies

```bash
cd mobile
pnpm install
pnpm exec tsc --noEmit
pnpm lint
```

### 2. Generate the iOS native project

`mobile/ios/` is gitignored — generate locally, do not commit.

```bash
cd mobile
pnpm exec expo prebuild --platform ios --clean
```

This produces:

- `mobile/ios/Orca.xcworkspace` (name follows `expo.name` in `app.json`)
- Podfile, Xcode project, entitlements scaffold

Then install pods (prebuild usually runs this; repeat if needed):

```bash
cd mobile/ios
pod install
```

Open **`Orca.xcworkspace`** (not `.xcodeproj`) in Xcode.

### 3. Xcode signing configuration

In Xcode → Targets → **Signing & Capabilities**:

- [ ] Team: your Apple Developer team
- [ ] Bundle Identifier: chosen fork ID (M3), matching `app.json` →
      `expo.ios.bundleIdentifier`
- [ ] Signing: Automatic (recommended for dev) or Manual with explicit profiles
- [ ] Enable **Local Network** capability (Bonjour / LAN pairing to desktop port 6768)
- [ ] Verify entitlements include local network usage (driven by `infoPlist` strings)

For **device builds**, register test devices in Apple Developer portal.

### 4. Build & run

**Simulator** (no mic AEC — limited audio testing):

```bash
cd mobile
pnpm start --ios
# or
pnpm exec expo run:ios
```

**Physical device** (required for dictation / two-way audio):

```bash
cd mobile
pnpm exec expo run:ios --device
```

**Dev client note:** `expo-two-way-audio` is a native module — **Expo Go is
insufficient** for full feature testing. Use `expo run:ios` dev-client builds.

### 5. Pair with fork desktop

Terminal A (repo root):

```bash
pnpm install
pnpm dev
lsof -nP -iTCP:6768 -sTCP:LISTEN   # mobile RPC server up
```

Terminal B:

```bash
cd mobile
pnpm start --dev-client
```

In desktop shuvorca: Settings → Mobile → enable experimental mobile → scan QR
from phone app.

Emulator loopback: N/A on iOS simulator for LAN; use simulator with desktop on
same Mac (`ws://127.0.0.1:6768` if supported) or physical device on Wi‑Fi.

### 6. Archive for TestFlight (local)

```bash
cd mobile
pnpm exec expo prebuild --platform ios --clean
cd ios
xcodebuild -workspace Orca.xcworkspace \
  -scheme Orca \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/Orca.xcarchive \
  archive
```

Upload via Xcode Organizer → Distribute App → App Store Connect → TestFlight.

**Alternative:** Expo Application Services (EAS) — see Phase 4. No `eas.json`
exists today; adding EAS is optional but simplifies CI signing.

### 7. Troubleshooting reference

| Symptom | Likely fix |
|---------|------------|
| Pod install fails | `cd ios && pod repo update && pod install` |
| Metro cannot resolve module | Stay inside `mobile/` imports; don't import `../../src/shared` without metro config |
| Signing "No profiles" | Create App ID + Development profile in developer.apple.com |
| Blank terminal on device | See `mobile/README.md` streaming repro scripts |
| Protocol block screen | Check `protocol-version.ts` constants both sides |
| Local network blocked | iOS Settings → Privacy → Local Network → enable for app |

---

## Desktop integration after mobile exists

### URL constants (centralize)

Create `src/shared/mobile-distribution.ts` (desktop) and
`mobile/src/mobile-distribution.ts` (mobile) with matching values:

```ts
export const FORK_IOS_APP_STORE_URL = 'https://apps.apple.com/app/…' // after listing live
export const FORK_IOS_TESTFLIGHT_URL = '…' // interim
export const FORK_ANDROID_APK_RELEASE_TAG = 'mobile-v0.0.x' // tag on shuv1337/orca
export const forkAndroidApkUrl = (tag: string) =>
  `https://github.com/shuv1337/orca/releases/download/${tag}/app-release.apk`
export const FORK_GITHUB_RELEASES_URL = 'https://github.com/shuv1337/orca/releases'
```

Wire into:

- `MobileSettingsPane.tsx`
- `mobile-platform-copy.ts`
- `ProtocolBlockScreen.tsx`

### Menu / i18n

After removing D4 exemption, these auto-rebrand via `applyProductBrand`:

- "Show Orca Mobile Button" → "Show shuvorca Button" (or "Show mobile app button")
- Settings pane prose mentioning Orca

Review for awkward grammar; add curated replacements in `applyProductBrand` if
needed (same pattern as "Non-Orca worktrees").

---

## CI / release pipeline extensions

Today `.github/workflows/mobile-build.yml` builds **Android APK only** on
`mobile-v*` tags. `.github/workflows/mobile.yml` runs PR lint/tsc.

### Phase 4a — Documented manual iOS release (short term)

- macOS maintainer runs archive + TestFlight upload locally
- Tag `mobile-v0.0.x` on fork; Android job unchanged
- Add iOS `.ipa` upload to GitHub Release **optional** (Apple notarization not
  applicable; Ad-Hoc/IPA sideload is possible but TestFlight is cleaner)

### Phase 4b — iOS CI job (medium term)

Add `ios-build` job to `mobile-build.yml` or new `mobile-ios-build.yml`:

```yaml
ios-build:
  runs-on: macos-15
  defaults:
    run:
      working-directory: mobile
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: 24
    - run: pnpm install --frozen-lockfile
    - run: npx expo prebuild --platform ios --no-install
    - run: cd ios && pod install
    - name: Build .ipa
      env:
        APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        # … match via fastlane or xcodebuild + exportOptions.plist
      run: …
```

Secrets needed:

- `APPLE_TEAM_ID`
- App Store Connect API key (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`)
  **or** certificate + provisioning profile secrets

Consider **EAS Build** (`eas.json` + `eas build --platform ios`) to offload
signing complexity to Expo's cloud macOS workers.

### Release naming

| Artifact | Current upstream pattern | Fork pattern |
|----------|-------------------------|--------------|
| Git tag | `mobile-v0.0.13` | keep same tag family on `shuv1337/orca` |
| Android APK | `app-release.apk` | unchanged filename |
| iOS | App Store upstream `id6766130217` | new listing under fork team |
| GH Release title | "Orca Mobile mobile-v…" | "shuvorca mobile-v…" |

---

## Implementation phases (PR sequence)

### Phase 0 — Decisions & ADR (docs only)

- [ ] Confirm M1–M10 with maintainer
- [ ] Pick bundle ID; create `docs/adr/0003-fork-mobile-identity.md`
- [ ] Create Apple App ID + placeholder App Store Connect record
- [ ] Amend `PLAN-shuvorca-rebrand.md` D4 footnote: superseded when fork mobile ships

**Exit:** Signed-off bundle ID + Apple team ready

### Phase 1 — Mobile brand module + config

- [ ] Add `mobile/src/product-brand.ts` (+ tests)
- [ ] Update `mobile/app.json` (name, bundle IDs, permission strings)
- [ ] Replace hardcoded "Orca" in shipping UI files (inventory above)
- [ ] Update `ProtocolBlockScreen` URLs to fork constants file
- [ ] `cd mobile && pnpm exec tsc --noEmit && pnpm lint && pnpm test`

**Exit:** Simulator shows shuvorca branding; grep `\bOrca\b` only in tests/dev mocks

### Phase 2 — Desktop CTA + D4 reversal

- [ ] Add `src/shared/mobile-distribution.ts`
- [ ] Update `MobileSettingsPane`, `mobile-platform-copy.ts`
- [ ] Remove `(?! Mobile)` from `applyProductBrand`; fix tests + menu test
- [ ] Root: `pnpm tc && pnpm test && pnpm lint`

**Exit:** Desktop settings point at fork URLs; UI says shuvorca not Orca Mobile

### Phase 3 — macOS Xcode validation (handoff execution)

- [ ] `expo prebuild --platform ios --clean`
- [ ] Xcode signing configured with fork bundle ID
- [ ] `expo run:ios` on simulator **and** physical device
- [ ] End-to-end pair → terminal subscribe → dictation smoke test
- [ ] Capture screenshots for TestFlight / internal docs

**Exit:** Signed dev-client build pairs with fork desktop on LAN

### Phase 4 — TestFlight + tagged release

- [ ] First TestFlight build uploaded
- [ ] Internal testers invited
- [ ] Tag `mobile-v0.0.x` → Android APK via existing workflow
- [ ] Update pinned APK URL constant to new tag
- [ ] (Optional) iOS CI job or EAS pipeline

**Exit:** Fork mobile installable without upstream App Store

### Phase 5 — App Store public listing (optional)

- [ ] Store metadata (description, keywords, privacy policy URL)
- [ ] App Review notes explaining desktop companion pairing
- [ ] Replace TestFlight CTA with public App Store URL in desktop/mobile constants

---

## Test plan

### Automated (every PR touching mobile/)

```bash
cd mobile
pnpm exec tsc --noEmit
pnpm lint
pnpm test
cd ..
pnpm typecheck:node   # if desktop/mobile shared types touched
```

### Manual macOS matrix

| Case | Steps | Expected |
|------|-------|----------|
| Cold install | Install dev build → launch | Shows shuvorca branding, no crashes |
| Pairing | Scan desktop QR | Host appears in list |
| Terminal | Open session → run `ls` | Live output renders |
| Tab switch | Switch terminals | Colors preserved (see README repro if fail) |
| Dictation | Hold mic → speak | Transcript appears on desktop (device only) |
| Protocol block | Temporarily bump `MIN_COMPATIBLE_DESKTOP_VERSION` | Block screen shows fork URLs |
| Desktop gate | Old desktop + new mobile | Clear upgrade message naming shuvorca |
| Local network deny | iOS settings deny LAN | Troubleshoot screen guidance applies |

### Regression guards

- [ ] Pairing still accepts `orca://pair#…` payloads
- [ ] Android APK still builds on `mobile-v*` tag after bundle ID change
- [ ] Upstream merge: internal `@orca/*` scopes unchanged

---

## Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle ID change breaks existing testers | Cannot upgrade in-place over upstream app | New install; communicate side-by-side |
| Apple Local Network entitlement review | Pairing blocked on iOS | Clear usage strings; App Review notes |
| Duplicate brand modules drift | Inconsistent copy desktop vs mobile | Same PR policy; optional shared package later |
| iOS CI signing complexity | Slow releases | Start manual TestFlight; add EAS when painful |
| Upstream mobile merge conflicts | Rebrand overwritten | Document fork-only files; avoid editing upstream strings without `applyProductBrand` |
| `expo.name` drives Xcode product name | Archive scheme named Orca until renamed | Set `expo.name` to shuvorca **before first prebuild** on fork |

---

## Open questions for maintainer (Phase 0)

1. **Exact bundle ID** — `dev.shuv.orca.mobile` vs other?
2. **Apple Developer team** — which team ID owns the listing?
3. **Public App Store in v1?** or TestFlight-only until stable?
4. **Android in same initiative?** Bundle ID + APK workflow is lower effort; can ship same Phase 1 rebrand
5. **Custom app icon** in v1 or whale reuse (M7)?
6. **Deep link scheme** — confirm keeping `orca://` internally is acceptable on fork

---

## Handoff packet for macOS developer

Copy into issue / Slack when assigning Phase 3:

1. Link to this plan
2. Chosen bundle ID + Apple team ID
3. Branch name with Phase 1+2 merged
4. Commands: § macOS / Xcode setup steps 1–5
5. Expected desktop build: fork `pnpm dev` with experimental mobile enabled
6. Success screenshot: paired host + terminal output
7. Blockers escalated: signing, Local Network, protocol version

---

## Definition of done (whole initiative)

- [ ] Fork mobile app displays **shuvorca** everywhere user-visible
- [ ] iOS dev-client build runs from clean `expo prebuild` on macOS
- [ ] TestFlight (or App Store) build installable on physical iPhone
- [ ] Pairs with fork desktop and streams terminal I/O
- [ ] Desktop settings / block screens link to **fork** store/release URLs
- [ ] D4 exemption removed; desktop no longer advertises upstream App Store id
- [ ] `mobile/README.md` documents fork Xcode workflow
- [ ] ADR-0003 recorded; D4 marked superseded in rebrand plan
