# Zellij Session Bulk Cleanup Plan

## Context

The Resource Manager already lists Orca-managed Zellij sessions in the footer popover through `src/renderer/src/components/status-bar/ZellijSessionsPanel.tsx`. The current surface supports per-row resume/delete only, and deletion routes through guarded host APIs:

- `src/main/pty/zellij-session-control.ts` lists sessions with `zellij list-sessions --no-formatting` and deletes one Orca-managed session with `zellij delete-session --force`.
- `src/shared/zellij-session-list.ts` owns parsing and the Orca-managed session-name predicate.
- `src/preload/index.ts`, `src/preload/api-types.ts`, `src/renderer/src/web/web-preload-api.ts`, `src/main/runtime/orca-runtime.ts`, and `src/main/runtime/rpc/methods/terminal.ts` expose list/delete to desktop and remote web clients.
- Worktree deletion succeeds in `src/main/ipc/worktrees.ts` for local desktop and `src/main/runtime/orca-runtime.ts` for runtime/remote paths, then renderer state is purged from `src/renderer/src/store/slices/worktrees.ts`.

Zellij session names are deterministic per worktree and terminal leaf via `buildZellijSessionName({ worktreeId, stableLeafId })` in `src/shared/zellij-session-command.ts`. Because the hash includes both worktree ID and leaf ID, automatic cleanup should delete exact derived names from known terminal leaf IDs rather than guessing by the human label prefix.

## Goals

- [ ] Add bulk cleanup controls to the Resource Manager Zellij session list, including selected, all, and exited-only deletes.
- [ ] Add a new terminal setting next to the existing Zellij toggle to automatically delete related Zellij sessions after a worktree delete succeeds.
- [ ] Preserve existing safety boundaries: only Orca-managed session names are deleteable, off-Linux hosts return empty/no-op behavior, and remote clients act on the runtime host, not the local browser/client.
- [ ] Keep the feature compatible with SSH/runtime worktrees and existing desktop flows.

## Non-Goals

- [ ] Do not rename existing `orca-*` Zellij sessions or rebrand internal session identifiers.
- [ ] Do not infer worktree ownership from a session label prefix for automatic cleanup.
- [ ] Do not delete user-created non-Orca Zellij sessions.
- [ ] Do not change terminal wrapping behavior or the opt-in nature of `terminalUseZellij`.

## Proposed Design

### Bulk Session Deletion API

- [ ] Add a shared result type in `src/shared/zellij-session-list.ts` or a focused shared file such as `src/shared/zellij-session-delete.ts`, so preload, runtime RPC, and renderer code do not import types from `src/main`:

  ```ts
  export type ZellijSessionDeleteResult = {
    deleted: string[]
    failed: { name: string; error: string }[]
  }

  ```

- [ ] Add a bulk helper in `src/main/pty/zellij-session-control.ts`, for example:

  ```ts
  export async function killZellijSessions(names: readonly string[]): Promise<ZellijSessionDeleteResult>
  ```

- [ ] Validate every requested name with `isOrcaManagedZellijSessionName` before invoking `zellij`.
- [ ] For invalid/non-Orca names in the bulk helper, add a `failed` entry and continue without invoking `zellij` for that name. Keep single-session `killZellijSession` throwing for existing row-action semantics.
- [ ] Deduplicate names before deletion.
- [ ] Delete sequentially or with very small concurrency. Reuse `killZellijSession` so behavior stays aligned with the existing single-delete path.
- [ ] Return partial failures instead of throwing after the first failure, so UI bulk cleanup can report accurate counts.
- [ ] Keep single-session `killZellijSession` for existing callers and row actions.
- [ ] Keep the helper host-executor aware before using it from worktree deletion. Local desktop can use `execFile('zellij', ...)`, but SSH worktrees must execute on the SSH host and runtime worktrees must execute on the runtime host.
- [ ] Do not add new `max-lines` disables while touching the centralized IPC/preload/runtime files; keep additions minimal and local to existing surfaces.

### IPC, Preload, And Runtime RPC

- [ ] Add `pty:killZellijSessions` in `src/main/ipc/pty.ts`, gated the same way as `pty:killZellijSession`.
- [ ] On non-Linux desktop hosts, make `pty:killZellijSessions` a no-op that returns `{ deleted: [], failed: [] }`, matching list's off-host behavior instead of attempting to execute `zellij`.
- [ ] Extend `src/preload/index.ts` and `src/preload/api-types.ts` with `killZellijSessions(names: string[]): Promise<ZellijSessionDeleteResult>`.
- [ ] Add runtime RPC `terminal.zellij.killMany` in `src/main/runtime/rpc/methods/terminal.ts`.
- [ ] Add `killZellijSessions(names)` to `OrcaRuntimeService` in `src/main/runtime/orca-runtime.ts`.
- [ ] Route web clients through `terminal.zellij.killMany` in `src/renderer/src/web/web-preload-api.ts`.
- [ ] Validate the bulk RPC params as a bounded string array before calling the runtime service, and return the shared `ZellijSessionDeleteResult` shape.
- [ ] For desktop-managed SSH repos, add or reuse a host-side command/RPC surface that can run `zellij list-sessions --no-formatting` and `zellij delete-session --force <name>` on the SSH host. Do not call the local desktop `zellij` binary for SSH cleanup.

### Resource Manager UI

- [ ] Update `src/renderer/src/components/status-bar/ZellijSessionsPanel.tsx` to track selected session names.
- [ ] Keep pure row filtering/selection helpers in `src/renderer/src/components/status-bar/zellij-session-display.ts` or a focused sibling so selected/all/exited behavior is unit-testable without React.
- [ ] Add row checkboxes using the existing shadcn checkbox primitive if available; otherwise add the minimal primitive following `docs/STYLEGUIDE.md`.
- [ ] Add compact header controls:
  - [ ] refresh
  - [ ] select all / clear selection
  - [ ] delete selected
  - [ ] dropdown or compact actions for delete all and delete exited
- [ ] Confirm destructive bulk deletes with a small `Dialog` when deleting more than one session. Include counts for total/running/exited sessions, and use destructive styling only for the confirmation action.
- [ ] Always confirm delete-all if it includes any running session, even when the current filtered count is one.
- [ ] Keep per-row resume/delete behavior unchanged.
- [ ] After bulk deletion, optimistically remove deleted rows, clear deleted names from selection, then refresh.
- [ ] Show a toast summary: deleted count and failed count. Do not claim full success if `failed.length > 0`.
- [ ] Disable bulk actions while a bulk delete is in flight and preserve row-level loading for single-row deletes.
- [ ] Keep the existing behavior that hides the Zellij panel entirely when no Orca-managed sessions are present.

### Worktree-Scoped Session Name Collection

- [ ] Add a renderer helper in a focused file such as `src/renderer/src/lib/worktree-zellij-session-names.ts`, to derive exact Zellij session names for a worktree from current UI state before the backend delete request is sent.
- [ ] Source leaf IDs from `tabsByWorktree[worktreeId]` and each tab's `terminalLayoutsByTabId[tab.id]`:
  - [ ] collect leaf IDs recursively from `layout.root`.
  - [ ] include valid UUID keys from `layout.ptyIdsByLeafId` for preserved split-pane bindings.
  - [ ] ignore legacy/non-UUID keys such as `pane:*` because they cannot reproduce the names created by `buildZellijSessionName`.
- [ ] Use `buildZellijSessionName({ worktreeId, stableLeafId })`; do not parse or guess hashes.
- [ ] Deduplicate derived names before passing them to backend delete APIs.
- [ ] Thread the derived names through local desktop deletion:
  - [ ] Extend `PreloadApi['worktrees'].remove` args in `src/preload/api-types.ts` with `zellijSessionNames?: string[]`.
  - [ ] Add `deleteZellijSessionsOnSuccess?: boolean` (or equivalent) to the same args, set from the current renderer setting.
  - [ ] Pass names from `src/renderer/src/store/slices/worktrees.ts` to `window.api.worktrees.remove`.
  - [ ] Extend `src/main/ipc/worktrees.ts` handler args.
  - [ ] Include the cleanup flag and a stable representation of the names in `getWorktreeRemovalOptionsKey`, so concurrent delete requests cannot silently share a promise with different cleanup behavior.
- [ ] Thread the same names through runtime deletion:
  - [ ] Extend `WorktreeRemove` schema in `src/main/runtime/rpc/methods/worktree-schemas.ts`.
  - [ ] Pass names from renderer `callRuntimeRpc('worktree.rm', ...)`.
  - [ ] Add the same cleanup flag to `worktree.rm`; web settings are browser-local, so runtime-host cleanup must not depend solely on the host store setting.
  - [ ] Extend `OrcaRuntimeService.removeManagedWorktree` with an options object rather than additional positional booleans, to avoid making `force/runHooks` call sites ambiguous.
  - [ ] Update all direct `removeManagedWorktree` call sites and tests to the options object signature in the same change.
  - [ ] Include cleanup fields in `getRuntimeWorktreeRemovalOptionsKey` for the same in-flight dedupe reason.

### Automatic Cleanup Setting

- [ ] Add a `GlobalSettings` boolean in `src/shared/types.ts`, suggested name:

  ```ts
  terminalDeleteZellijSessionsOnWorktreeDelete: boolean
  ```

- [ ] Default it to `false` in `src/shared/constants.ts`.
- [ ] Add a `SettingsSwitchRow` directly under the existing Zellij Sessions switch in `src/renderer/src/components/settings/TerminalPane.tsx`.
- [ ] Keep it under the same non-Mac/non-Windows search gate as `terminalUseZellij`.
- [ ] Update `src/renderer/src/components/settings/terminal-pane-appearance-search.ts` / `terminal-search.ts` so settings search finds both Zellij launch and cleanup controls.
- [ ] Copy should be explicit that this deletes only Orca-managed Zellij sessions for a workspace after the workspace delete succeeds.
- [ ] Ensure the renderer delete flow reads this setting before the backend call and passes the cleanup flag alongside derived names for both desktop and web/runtime clients.

### Backend Cleanup Timing

- [ ] In `src/main/ipc/worktrees.ts`, call `killZellijSessions(args.zellijSessionNames)` only after the worktree has been successfully removed or confirmed already gone and after existing metadata/transient cleanup has succeeded.
- [ ] In `src/main/runtime/orca-runtime.ts`, do the same for runtime deletes.
- [ ] In local desktop worktree deletion, choose the Zellij deletion executor by repo host: local repos use the local process helper; SSH repos use the SSH-host command/RPC surface.
- [ ] Gate cleanup on both `deleteZellijSessionsOnSuccess === true` and a non-empty validated name list. Do not rely only on `store.getSettings()` because web/runtime clients keep the setting in browser storage.
- [ ] Revalidate every cleanup name backend-side with `isOrcaManagedZellijSessionName`; renderer-derived names are not a security boundary.
- [ ] Treat Zellij cleanup as best-effort: log partial failures, include an optional warning in `RemoveWorktreeResult` only if the existing result shape can carry it without breaking callers.
- [ ] Do not block successful worktree deletion if session cleanup fails; the Resource Manager bulk controls remain the manual recovery path.
- [ ] For folder workspaces, use the same exact-name list from renderer state. Do not attempt path-based deletion because multiple folder workspace instances can share one filesystem root.

## Implementation Order

1. [ ] Add shared/main bulk Zellij deletion types and helper.
2. [ ] Extend IPC/preload/runtime APIs for bulk Zellij deletion.
3. [ ] Update `ZellijSessionsPanel` with selection, bulk actions, confirmation, and result toasts.
4. [ ] Add the new setting to `GlobalSettings`, defaults, Terminal settings UI, and search metadata.
5. [ ] Add exact session-name derivation from worktree terminal state before the backend delete request.
6. [ ] Thread derived names through local and runtime worktree delete calls.
7. [ ] Gate post-success cleanup in local/runtime delete backends on the renderer-supplied cleanup flag and backend name validation.
8. [ ] Add targeted unit tests.
9. [ ] Run focused validation, then broader typecheck/test if time allows.

## Test Plan

- [ ] `src/main/pty/zellij-session-control.test.ts`
  - [ ] bulk delete deduplicates names.
  - [ ] reports non-Orca names without invoking `zellij` for those names.
  - [ ] returns partial failures without skipping later valid names.
- [ ] `src/renderer/src/components/status-bar/zellij-session-display.test.ts`
  - [ ] selected/all/exited row filtering helpers return the expected names.
- [ ] `src/renderer/src/components/status-bar/ZellijSessionsPanel.test.tsx` if the repo already supports component tests in this area; otherwise keep UI logic extracted and unit-testable.
  - [ ] delete selected calls `window.api.pty.killZellijSessions` with selected names.
  - [ ] delete exited uses only exited rows.
  - [ ] partial failure toast does not claim full success.
- [ ] `src/shared/zellij-session-command.test.ts`
  - [ ] add tests for any new exact-name derivation helper if it lives in shared code.
- [ ] `src/renderer/src/lib/worktree-zellij-session-names.test.ts` or equivalent
  - [ ] derives names from `TerminalLayoutSnapshot.root` leaf IDs.
  - [ ] includes valid UUID keys from `ptyIdsByLeafId`.
  - [ ] ignores legacy/non-UUID leaf keys such as `pane:*`.
  - [ ] deduplicates names across layout sources.
- [ ] `src/renderer/src/store/slices/worktrees.test.ts`
  - [ ] when setting is enabled, worktree removal passes exact Zellij names and cleanup flag before the backend delete call.
  - [ ] when disabled, cleanup flag is false and no cleanup names are passed.
  - [ ] runtime/web deletion passes the same cleanup flag and names through `worktree.rm`.
- [ ] `src/renderer/src/components/settings/terminal-search.test.ts`
  - [ ] settings search finds the new Zellij cleanup control.
- [ ] `src/main/ipc/worktrees.test.ts`
  - [ ] local successful delete triggers post-success Zellij cleanup only when the setting is enabled.
  - [ ] SSH repo delete routes cleanup to the SSH host surface, not local `execFile`.
  - [ ] dirty/preflight-failed delete does not clean Zellij sessions.
  - [ ] cleanup failure does not undo worktree deletion metadata cleanup.
  - [ ] concurrent removals with different cleanup flags/names do not share the same in-flight promise.
- [ ] `src/main/runtime/orca-runtime.test.ts`
  - [ ] runtime removal mirrors local cleanup timing and setting behavior.
  - [ ] runtime in-flight removal keys include cleanup options.
- [ ] `src/main/runtime/rpc/methods/terminal.test.ts` or nearby RPC tests
  - [ ] `terminal.zellij.killMany` validates params and returns bulk result.
- [ ] `src/main/runtime/rpc/methods/worktree.test.ts` or nearby RPC tests
  - [ ] `worktree.rm` accepts cleanup flag plus `zellijSessionNames` and rejects malformed arrays.

## Validation Commands

```bash
pnpm test -- src/main/pty/zellij-session-control.test.ts src/shared/zellij-session-command.test.ts src/renderer/src/components/status-bar/zellij-session-display.test.ts
pnpm test -- src/renderer/src/lib/worktree-zellij-session-names.test.ts src/renderer/src/components/settings/terminal-search.test.ts
pnpm test -- src/main/ipc/worktrees.test.ts src/main/runtime/orca-runtime.test.ts src/main/runtime/rpc/methods/terminal.test.ts
pnpm run typecheck
```

Manual Linux validation:

1. Enable `terminalUseZellij`.
2. Create several terminal panes in one worktree and confirm `zellij list-sessions --no-formatting` shows multiple `orca-*` sessions.
3. Open the Resource Manager popover and delete selected, exited, and all sessions.
4. Recreate sessions, enable `terminalDeleteZellijSessionsOnWorktreeDelete`, delete the worktree, and confirm the derived sessions disappear from `zellij list-sessions --no-formatting`.
5. Repeat against an SSH/runtime workspace where the host has Zellij installed.

## Risks And Edge Cases

- [ ] Existing orphaned Zellij sessions for already-deleted worktrees cannot always be mapped back to a worktree because the current hash is not reversible. The new bulk Resource Manager controls are the cleanup path for those.
- [ ] If renderer state no longer has a leaf ID for a detached session, automatic cleanup cannot derive its exact name. Future-proofing option: persist a worktree-to-Zellij-session index when sessions are created, but that is larger than this feature needs.
- [ ] Remote cleanup must run on the runtime host. Calling local preload APIs from the web client would delete the wrong host's sessions.
- [ ] Desktop SSH cleanup must run on the SSH host. The existing SSH Git provider's `exec` surface is git-oriented; do not assume it can safely execute arbitrary `zellij` commands without an explicit relay/host-command design.
- [ ] Bulk deletion of live sessions will terminate attached processes. Confirmation copy should say "delete sessions," not "clean up inactive sessions," unless filtering to exited rows.
- [ ] Worktree deletion already has many success branches. The cleanup call should be centralized enough to avoid missing orphan/missing/folder success paths.
- [ ] Web/runtime settings are client-local. If backend cleanup is gated only on the runtime host's persisted settings, the browser toggle can appear enabled while cleanup never runs.
- [ ] Existing in-flight worktree deletion dedupe keys only include force/archive options. Cleanup fields must be part of the key or one concurrent request can accidentally inherit another request's cleanup behavior.
