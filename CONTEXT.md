# ShuvOrca Fork — Branding & Identity Context

This fork of upstream Orca (`stablyai/orca`) rebrands the user-visible product to
**shuvorca** while preserving the internal identity, install slot, and data paths
of the original Orca so existing profiles, permissions, and agent tooling keep
working. This glossary fixes the language used when reasoning about that rebrand.

## Language

**shuvorca** (display name):
The user-visible product name shown in window chrome, dialogs, onboarding,
installers, and i18n prose. Always lowercase — never `Shuvorca`, never
`ShuvOrca`, regardless of sentence position. Stylized like `npm`/`bun`.
_Avoid_: ShuvOrca, Shuvorca, Shuv Orca

**Orca app identity** (OS/data identity):
The legacy OS-level application name passed to `app.setName('Orca')`, which keys
`app.getPath('userData')` (`Application Support/Orca`, `~/.config/orca`). Stays
`Orca` in v1 so existing profiles load. Distinct from the **shuvorca** display
name. Not user-visible.
_Avoid_: conflating with display name; "product name"

**CLI command**:
The shell command the packaged app installs and that agent instructions invoke.
Platform-dependent: `orca` on macOS/Windows, `orca-ide` on Linux (the `-ide`
suffix avoids shadowing GNOME Orca's `/usr/bin/orca` screen reader). NOT a single
flat string.
_Avoid_: assuming a single global `orca` command on all platforms

**v1 surface rebrand**:
This plan. Display name → shuvorca; OS identity, userData, CLI binary names, and
all `orca`/`ORCA_*` internal contracts unchanged. Plus a bug fix so agent-facing
CLI command strings respect the platform CLI command.

**v2 deep rebrand** (future, out of scope here):
Full rename of OS identity to shuvorca with automatic profile migration from the
legacy Orca userData path, CLI command unification under `shuvorca`, and rename
of the **Computer Use helper** display name.

**Computer Use helper**:
The macOS `Orca Computer Use.app` (bundle id `com.stablyai.orca.computer-use`),
whose display name surfaces in TCC permission prompts during computer-use grants.
Kept as "Orca Computer Use" in v1 (renaming touches the native Swift build +
signing); rebrand deferred to v2.

## Relationships

- The **shuvorca** display name is independent of the **Orca app identity**;
  changing the former must never change `app.setName()` in v1.
- The **CLI command** name is resolved per-platform and must match the actually
  installed binary at every agent-facing and internal call site.
- **v2 deep rebrand** depends on a profile-migration step that **v1 surface
  rebrand** deliberately omits.

## Flagged ambiguities

- "product name" was used to mean both the display name (**shuvorca**) and the
  OS app identity (**Orca**) — resolved: these are distinct; only the display
  name changes in v1.
- `CLI_COMMAND_NAME = 'orca'` (proposed flat constant) — resolved: the CLI
  command is platform-dependent (`orca` / `orca-ide`), not a single value.
  v1 fix is a platform-aware resolver routed through every agent-facing string;
  binaries stay `orca`/`orca-ide` (no rename, no migration until v2).
