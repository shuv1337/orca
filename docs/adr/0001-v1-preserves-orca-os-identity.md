# v1 surface rebrand preserves the legacy Orca OS identity

**Status:** accepted

The ShuvOrca fork rebrands the user-visible product to **shuvorca**, but in v1 it
deliberately keeps the underlying OS-level identity of upstream Orca: production
still calls `app.setName('Orca')` (so `app.getPath('userData')` stays
`Application Support/Orca` / `~/.config/orca`), `appId` stays
`com.stablyai.orca`, the macOS bundle pins `executableName: 'Orca'` (so
`shuvorca.app` contains `Contents/MacOS/Orca` and `resources/darwin/bin/orca`
keeps working), and the Computer Use helper stays `Orca Computer Use.app`. We
chose this because changing the app name moves the userData path and loses every
existing profile, and changing `appId` resets macOS TCC permissions
(notifications, accessibility, screen recording) — both high-severity, and
neither buys anything for a display-only rebrand.

## Considered options

- **Change `app.setName`/`appId` to shuvorca now** — rejected for v1: silent
  profile loss + TCC reset, with no auto-migration written yet.
- **Pin userData back after renaming** (the original plan) — rejected: it
  introduces the profile-move bug and then fights it; many stores resolve
  `getPath('userData')` lazily *after* `setName`, so the capture-before guard
  wouldn't cover them.

## Consequences

- A future reader will see `shuvorca.app` ship a binary literally named `Orca`
  and the data dir named `Orca`; this is intentional, not leftover.
- `BASE_APP_NAME` in `dev-instance-identity.ts` must stay `Orca` for the
  production identity; only display surfaces (window/dock title, `productName`,
  dialogs, TCC prose) become shuvorca.
- A full identity rename **with automatic userData migration** is deferred to a
  v2 deep rebrand.
