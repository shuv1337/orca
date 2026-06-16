# First-Class Zellij Sessions (Linux)

## Problem

Orca already bifurcates terminal processes from the app via its own out-of-process
terminal daemon (`src/main/daemon/`): PTYs survive app restarts, reattach with a
repainted scrollback snapshot, and cold-restore from disk after a daemon crash.

That persistence is **Orca-internal**. Two gaps remain:

1. A hard daemon kill (or a deliberate "restart daemon" that kills sessions) still
   tears down the running process tree.
2. The running sessions are only reachable from Orca. There is no way to view or
   resume them from a plain terminal (iTerm, Ghostty, a bare SSH login).

Zellij closes both gaps. If an agent/shell runs **inside** a named Zellij session,
the process tree lives in Zellij's own server — detached from Orca's PTY lifecycle
entirely — and `zellij attach <name>` from any terminal client resumes the exact
same session.

## Goal

Add a terminal setting (`terminalUseZellij`, **disabled by default**, Linux-only)
that, when enabled, makes every integrated shell or agent launch run inside a new
Zellij session named deterministically per Orca pane. This must work for both
local and SSH worktrees.

Outcome:

- Survive app crashes / full restarts (already true via daemon) **and** daemon
  kills (new — Zellij server is independent).
- View/resume any Orca session from a non-Orca terminal client via `zellij attach`.

## Non-Goals

- Do **not** replace the terminal daemon. Zellij is an additive durability +
  shareability layer on top of it, not a backend swap.
- Do **not** add a `ZellijPtyProvider`. The launch command is rewritten, not the
  transport (see Mechanism).
- macOS and Windows are out of scope. Zellij is Linux-only here. WSL is **not**
  targeted in this pass.
- Do not double-multiplex or re-implement Zellij layouts/splits inside Orca.

## Mechanism: command rewriting at spawn time

Orca already launches agents/shells by passing a `command` through
`PtySpawnOptions.command`. The shell-ready machinery
(`src/main/providers/local-pty-shell-ready.ts`,
`writeStartupCommandWhenShellReady`) waits for the OSC 777 ready marker, then
**types that command into the freshly spawned login shell**. The SSH path forwards
`command` to the relay, which likewise lets the user's shell run it
(`src/main/providers/ssh-pty-provider.ts` — "The relay does not execute `command`
itself — the user types it into the shell").

The Zellij feature hooks in exactly there. When enabled, rewrite `command`:

```
# agent / shell launch
zellij attach --create <sessionName> options --default-cwd <cwd> -- <originalCommand>

# blank terminal (no agent)
zellij attach --create <sessionName>
```

The PTY Orca owns becomes a thin Zellij **client**; the real processes live in the
Zellij **server**, which outlives the client, the daemon, and the app.

### Why command-rewrite, not a provider

A `ZellijPtyProvider` would re-implement everything `LocalPtyProvider` /
`SshPtyProvider` already do — env assembly (`buildPtyHostEnv`), shell-ready marker
handling, worktree-scoped history, attribution shims, SSH relay routing.
Command-rewrite reuses all of it unchanged and is **identical for local and SSH**,
because in both cases the command is typed into the (local or remote) shell rather
than executed by Orca directly. Env injected by `buildPtyHostEnv`
(`ORCA_PANE_KEY`, agent-hook coordinates, overlay dirs) is inherited by the Zellij
session's child processes, so agent status hooks keep routing correctly.

This mirrors the existing `claude-agent-teams` precedent, which already rewrites
launch commands and shims a multiplexer (tmux) behind the same `command` field.

## Design

### 1. Setting

- `src/shared/types.ts` (next to `terminalScopeHistoryByWorktree`, ~line 2463):
  add `terminalUseZellij: boolean` with a doc comment.
- `src/shared/constants.ts` (~line 285): default `terminalUseZellij: false`.
- `src/renderer/src/components/settings/TerminalPane.tsx`: a toggle row, gated to
  Linux (`process.platform === 'linux'`), with help text covering session sharing
  + persistence. Follow `docs/STYLEGUIDE.md` and reuse the existing shadcn switch
  primitive.
- Thread into the provider via the `getSettings` hook already wired in
  `registerPtyHandlers` (`src/main/ipc/pty.ts`), which already reads several
  terminal settings at spawn time.

### 2. Command-rewrite module (new, pure, unit-tested)

`src/main/pty/zellij-session-command.ts` — concrete name per `AGENTS.md`
(no `utils`/`helpers`). Pure functions, tested like
`src/shared/claude-agent-teams-tmux-compat.ts`:

- `buildZellijSessionName({ worktreeId, tabId, leafId })` → deterministic,
  filesystem/Zellij-safe session name. This is the **identity bridge** and the
  make-or-break detail:
  - **Stable across restarts** so reattach hits the same session. Derive from
    durable identity only — `worktreeId` (`src/shared/worktree-id.ts`) and the
    stable terminal leaf id (`src/shared/stable-pane-id.ts`), never a
    renderer-local numeric pane id or a fresh UUID per spawn.
  - **Unique per pane** so two tabs/splits don't collide. Suggested shape:
    `orca-<shortHash(worktreeId)>-<shortLeafId>`. Sanitize to Zellij's allowed
    charset.
- `wrapLaunchCommandWithZellij(originalCommand, sessionName, cwd)` → the
  `zellij attach --create … -- …` string with correct POSIX shell quoting.
- `shouldWrapWithZellij(env)` → idempotency / nesting guard: return false when
  already inside Zellij (`ZELLIJ` / `ZELLIJ_SESSION_NAME` present), so launching
  Orca from inside a Zellij pane does not nest sessions.

### 3. Wire-in (single chokepoint, covers local + SSH)

Rewrite `opts.command` inside `pty:spawn` in `src/main/ipc/pty.ts`, **before**
dispatching to the provider. Gate on all of:

- `terminalUseZellij` enabled, and
- `process.platform === 'linux'` (local) / remote-host check (SSH), and
- Zellij available, and
- `shouldWrapWithZellij(env)` (not already nested).

Doing it here keeps the local and SSH paths identical and avoids editing two
providers. Both `LocalPtyProvider.spawn` and `SshPtyProvider.spawn` already consume
`opts.command` unchanged downstream.

### 4. Zellij availability + graceful degradation

- **Local:** probe `command -v zellij` once and cache.
- **SSH:** Zellij must exist on the **remote** host. Probe via the relay (one-shot
  `command -v zellij`) and cache per connection.
- If absent (either side), **silently fall back to the unwrapped command**. The
  feature is host-dependent; a missing binary must never error a terminal launch.

### 5. Reattach / lifecycle

- On app restart the renderer reattaches panes by `sessionId`
  (`src/renderer/src/components/terminal-pane/use-terminal-pane-lifecycle.ts` →
  `connectPanePty`). The Orca-level PTY is fresh, but re-issuing the **same**
  `zellij attach <sessionName>` resumes the live process tree. Net effect: the
  daemon snapshot repaints instantly while Zellij re-attaches the running
  processes underneath.
- **Detection / titles:** extend `src/main/providers/agent-foreground-process.ts`
  and `src/shared/agent-process-recognition.ts` to recognize `zellij`, since the
  client's foreground process is `zellij` rather than the agent. Agent status still
  routes via env (`ORCA_PANE_KEY`) inherited by the Zellij child, so hooks are
  unaffected.

### 6. Keybinding passthrough (Phase 2)

Zellij chords (`Ctrl+p/t/n/o/s`, `Alt+arrows`) collide with Orca window shortcuts
and xterm handling in
`src/renderer/src/components/terminal-pane/xterm-bypass-policy.ts`. When the active
pane is a Zellij session, Orca must yield those chords to the PTY. Reuse the
`claude-agent-teams` `native-panes-shim` precedent. This is the only genuinely
fiddly piece and is **not required for persistence**, so it is deferred to Phase 2.

## Edge Cases

- **Nesting:** launching Orca from inside Zellij must not wrap again (guard in
  `shouldWrapWithZellij`).
- **Session name collisions:** two splits in one tab get distinct leaf ids →
  distinct session names. Verified by deriving from the stable leaf id.
- **Remote Zellij missing:** unwrapped fallback, no error.
- **Worktree deleted then recreated:** name is derived from `worktreeId`; a new
  worktree id yields a new session, which is correct.
- **`--default-cwd` vs. agent cwd:** pass the resolved pane cwd so a fresh Zellij
  session starts where the agent expects.
- **OSC 52 clipboard:** already supported for tmux/nvim
  (`src/renderer/src/components/terminal-pane/osc52-clipboard.ts`, gated on
  `terminalAllowOsc52Clipboard`); confirm it survives the Zellij passthrough.

## Phasing

- **Phase 1 (MVP — delivers all persistence/shareability goals):** setting +
  `zellij-session-command.ts` (+ tests) + `ipc/pty.ts` wire-in for local and SSH +
  nesting guard + availability fallback + Zellij process recognition for titles.
- **Phase 2:** keybinding passthrough mode, settings polish.

## Remote Orca client coverage (post-Phase-1 fix)

The original Phase 1 wire-in only covered the renderer-driven `pty:spawn` handler
and the renderer startup-command delivery path — both **client-local**. Terminals
opened by a **remote Orca client** (runtime environment / `orca serve`) are born
**host-side** through the main-owned `ptyController.spawn` callback
(`src/main/ipc/pty.ts`, registered via `runtime.setPtyController`), which had **no**
Zellij wrapping. Result: a remote client's first pane (an attach to a pre-existing
host session) worked, but freshly-spawned panes were never put inside Zellij and
hung on a blank terminal.

Fix:

- Extracted the wrap gate + command build into a shared, unit-tested module
  `src/main/pty/zellij-spawn-command.ts` (`shouldApplyZellijSpawnWrap` /
  `buildZellijSpawnCommand`).
- Wired it into **both** main spawn chokepoints: the renderer `pty:spawn` handler
  and the runtime `ptyController.spawn` callback. Local and remote-host launches
  now wrap identically.
- Added `commandAlreadyInvokesZellij` (shared) used by both the gate and the
  renderer startup path so an explicit `zellij attach` (Resource Manager resume)
  is never re-wrapped into a nested, hanging session.

## Resource Manager: Zellij session visibility

Orca-spawned Zellij sessions live in the Zellij **server**, independent of the PTY
daemon, so they are queried via the `zellij` binary rather than the PTY registry.

- `src/main/pty/zellij-session-control.ts` — `listZellijSessions()` /
  `killZellijSession()` (delete-session --force, Orca-name-guarded).
- `src/shared/zellij-session-list.ts` — pure parser for
  `zellij list-sessions --no-formatting` + the Orca-managed-name predicate.
- IPC: `pty:listZellijSessions` / `pty:killZellijSession` (preload
  `window.api.pty.listZellijSessions` / `killZellijSession`).
- Runtime RPC (remote clients): `terminal.zellij.list` / `terminal.zellij.kill`
  on `OrcaRuntimeService`; the web preload routes through these.
- UI: `src/renderer/src/components/status-bar/ZellijSessionsPanel.tsx` inside the
  Resource Manager popover — lists Orca sessions (name/label/status), **Resume**
  (opens a tab running `zellij attach <name>`) and **Delete**. Shown in both local
  and runtime modes; hides itself when there are no Orca-managed sessions.

## Manual test checklist

Local (Linux host, `terminalUseZellij` on):

1. Open an agent terminal → confirm it is inside Zellij
   (`zellij list-sessions` shows `orca-<label>-<hash>`).
2. Open the Resource Manager popover → the Zellij sessions panel lists it.
3. Click **Resume** on a session → a new tab runs `zellij attach <name>` and joins
   the same session (no nested/blank hang).
4. Click **Delete** → the session is removed from `zellij list-sessions`.

Remote (Mac client → Linux host running `orca serve`, host `terminalUseZellij` on):

1. Connect from the Mac client; open several projects/terminals.
2. **Every** fresh terminal should enter a Zellij session (previously only the
   first worked; the rest hung blank).
3. The Resource Manager panel lists the host's Orca Zellij sessions; Resume and
   Delete operate on the host server over RPC.

## Verification Plan

- Unit-test `buildZellijSessionName` (stability across restarts, per-pane
  uniqueness, sanitization), `wrapLaunchCommandWithZellij` (quoting, blank-shell
  vs. agent), and `shouldWrapWithZellij` (nesting guard).
- Unit-test the `ipc/pty.ts` gate matrix: setting off → never wraps; non-Linux →
  never wraps; Zellij absent → unwrapped fallback; already-nested → unwrapped.
- Manual: enable setting, launch an agent, kill Orca's daemon, confirm the process
  survives and reopening the tab resumes it; from a bare terminal run
  `zellij attach <name>` and confirm the same session.
- Manual (SSH): same flow against a remote worktree with and without remote Zellij
  installed (fallback path).
- Per `AGENTS.md`: typecheck, lint, `git diff --check`; keep SSH in mind for every
  change; avoid `utils`/`helpers` names; document the "why" briefly in code.
