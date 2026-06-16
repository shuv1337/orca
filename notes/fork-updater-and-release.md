# Fork updater + multi-platform release

This documents the changes that point Orca's auto-updater at the
`shuv1337/orca` fork and ensure a release publishes macOS (x64 + arm64),
Windows (x64), and **Linux x64** together.

> **Related:** the surface rebrand to **shuvorca** (display name only; internal
> `orca` identifiers preserved) is tracked in [`PLAN-shuvorca-rebrand.md`](../PLAN-shuvorca-rebrand.md)
> and [`GOAL-shuvorca-rebrand.md`](../GOAL-shuvorca-rebrand.md), with rationale in
> [`docs/adr/0001-v1-preserves-orca-os-identity.md`](../docs/adr/0001-v1-preserves-orca-os-identity.md)
> and [`docs/adr/0002-runtime-i18n-brand-transform.md`](../docs/adr/0002-runtime-i18n-brand-transform.md).
> The updater repo (`shuv1337/orca`) and `orca-*` artifact names are intentionally
> unchanged by the rebrand.

## What changed

### 1. Auto-updater now tracks the fork

The packaged app checks GitHub Releases of whatever repo is configured, in two
independent places — both repointed from `stablyai/orca` to `shuv1337/orca`:

- **`config/electron-builder.config.cjs`** → `publish.owner: 'shuv1337'`.
  electron-builder bakes this into `Orca.app/Contents/Resources/app-update.yml`,
  which `electron-updater` reads at runtime.
- **`src/main/updater-prerelease-feed.ts`** → the custom newest-tag resolver
  (atom feed, download base, tag regex) now derives from a single
  `RELEASE_REPO_SLUG = 'shuv1337/orca'` constant. This must stay in sync with
  `publish.owner`/`publish.repo`.

The prerelease feed includes RC tags by default, so any fork release/RC with a
version greater than the running one triggers an update prompt.

Intentionally left untouched (not part of the update feed; changing them has
side effects):

- `appId` / bundle IDs (`com.stablyai.orca*`) — changing these resets macOS TCC
  permissions and the installed-app identity.
- "Made with Orca" attribution footers and `src/main/github/client.ts`
  `ORCA_REPO` — product branding / API repo, unrelated to updates.

### 2. Local mac builds are host-arch only; releases stay dual-arch

`config/electron-builder.config.cjs` computes the mac target arch:

```js
const macArches = isMacRelease ? ['x64', 'arm64'] : [process.arch === 'x64' ? 'x64' : 'arm64']
```

- Local (`pnpm build:mac`, no `ORCA_MAC_RELEASE`) → only the host arch. Avoids
  the slow cross-arch native rebuild for a throwaway local install.
- Release (`ORCA_MAC_RELEASE=1`, set by CI) → both `x64` and `arm64`. **No
  regression to the shipped DMGs.**

### 3. Linux pinned to x64

The Linux target was an arch-less `['AppImage','deb','rpm']`, which defaults to
the builder's host arch. It is now explicitly pinned so a release always emits
**x64** AppImage/deb/rpm regardless of the runner:

```js
target: [
  { target: 'AppImage', arch: ['x64'] },
  { target: 'deb', arch: ['x64'] },
  { target: 'rpm', arch: ['x64'] }
]
```

### 4. Fork can now cut releases manually

`.github/workflows/release-cut.yml`'s `cut` job was hard-gated to
`github.repository == 'stablyai/orca'`, so the whole pipeline no-opped on the
fork — nothing built for any platform. The gate is now:

```yaml
if: github.event_name != 'schedule' || github.repository == 'stablyai/orca'
```

- Manual **Run workflow** (workflow_dispatch) works on the fork → builds and
  publishes mac + windows + linux-x64 to the fork's Releases.
- The 2×/day scheduled RC cron stays canonical-only, so it never diverges the
  fork's `main` (which the original comment warns about).

## How a release maps to platforms

The release `build` matrix (unchanged) runs one leg per platform:

| Leg            | Runner          | electron-builder | Artifacts                                  |
|----------------|-----------------|------------------|--------------------------------------------|
| mac            | `macos-15`      | `--mac` + `ORCA_MAC_RELEASE=1` | `orca-macos-x64.dmg`, `orca-macos-arm64.dmg`, zips, `latest-mac.yml` |
| windows        | `windows-latest`| `--win`          | `orca-windows-setup.exe`, `latest.yml`     |
| linux          | `ubuntu-latest` | `--linux`        | `orca-linux.AppImage`, `.deb`, `.rpm` (x64), `latest-linux.yml` |

`--publish always` uploads to a **draft** release; `publish-release` flips it to
published only after every required asset is present.

### 5. macOS build decoupled from publishing

macOS is now its own job (`build-mac`) instead of a `build` matrix leg, so a
release can publish **Linux x64 + Windows without macOS signing**:

- `cut` emits `include_mac`, derived from whether the `MAC_CERTS` secret exists
  (secrets can't be read in a job-level `if:`, hence the indirection).
- `build` matrix = `win` + `linux` only. `build-mac` runs **only** when
  `include_mac == 'true'` and turns back on automatically once the Apple
  secrets are added.
- `publish-release` requires `build` (linux/win) + `terminal-rendering-golden`
  and treats a **skipped** `build-mac` as a valid partial release. A *failed*
  mac job still blocks publishing (no half-mac releases).
- `verify-release-required-assets.mjs` is now platform-parametrized
  (`ORCA_RELEASE_PLATFORMS`, default all). For a mac-less release it only
  requires the linux + windows assets/manifests.
- The Homebrew cask jobs (mac-only) are gated on `include_mac`.

Net effect for the fork today (no Apple secrets): a manual cut publishes
`orca-linux.AppImage` + `.deb` + `.rpm` (x64), `orca-windows-setup.exe`, and the
`latest-linux.yml` / `latest.yml` updater manifests — mac is skipped. Add the
Apple secrets later and mac rejoins the same release automatically.

## Prerequisites / caveats for releasing from the fork

1. **macOS signing (deferred).** `build-mac` only runs once these fork secrets
   exist: `MAC_CERTS`, `MAC_CERTS_PASSWORD`, `APPLE_ID`,
   `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Until then mac is cleanly
   skipped — it no longer blocks Linux x64 / Windows.
   - Note: macOS release builds run on the GitHub `macos-15` runner, **not** a
     local machine — a local dev-beta macOS / Xcode state does not affect the
     CI mac release.
2. **`ORCA_POSTHOG_WRITE_KEY`** is referenced by the build; the post-publish
   `verify-telemetry-constants.mjs` check expects telemetry constants in
   `app.asar`. Confirm this secret exists on the fork or expect that gate to
   complain.
3. **First release must out-version the running build.** The installed app is
   `1.4.70-rc.0`; cut a fork release with a higher version (an RC is fine) for
   the updater to offer it.

## Verifying locally

```bash
# host-arch-only mac build for local install
pnpm build:mac

# confirm the baked feed points at the fork
grep -E 'owner|repo' dist/mac-arm64/Orca.app/Contents/Resources/app-update.yml
# -> owner: shuv1337 / repo: orca

# confirm arch selection
node -e "const c=require('./config/electron-builder.config.cjs'); console.log(c.mac.target, c.linux.target)"
ORCA_MAC_RELEASE=1 node -e "const c=require('./config/electron-builder.config.cjs'); console.log(c.mac.target)"
```
