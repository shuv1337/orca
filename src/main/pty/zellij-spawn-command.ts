// Why: both PTY spawn chokepoints — the renderer-driven `pty:spawn` handler and
// the main-owned runtime `ptyController.spawn` callback that serves remote Orca
// clients — must make the identical Zellij wrap decision. Centralizing the gate
// here keeps host-side (remote client) launches consistent with local launches
// so a remote pane is never left as an unwrapped, hung blank shell.
import {
  buildZellijSessionName,
  commandAlreadyInvokesZellij,
  shouldWrapWithZellij,
  wrapLaunchCommandWithZellij,
  type ZellijCommandAvailability
} from '../../shared/zellij-session-command'
import { isTerminalLeafId } from '../../shared/stable-pane-id'

export type ZellijSpawnWrapContext = {
  /** `terminalUseZellij` from settings. */
  useZellij: boolean
  /** The spawning process env, used only for the nesting guard. */
  hostEnv: Record<string, string | undefined>
  worktreeId?: string
  /** Stable terminal leaf id; validated here so callers cannot pass a renderer-local pane id. */
  leafId?: string | null
  connectionId?: string | null
  command?: string
  sessionId?: string
  /**
   * Why: true when the renderer types the startup command into the shell after
   * shell-ready (terminal-paste / SSH cold-restore). Those paths are wrapped by
   * the renderer; wrapping here too would nest a second `zellij attach`.
   */
  startupCommandDeliveredByRenderer?: boolean
  availability: ZellijCommandAvailability | null
  cwd?: string
  paneEnv?: Record<string, string> | null
  shellCommand: string
}

export function shouldApplyZellijSpawnWrap(ctx: ZellijSpawnWrapContext): boolean {
  return (
    ctx.useZellij &&
    Boolean(ctx.worktreeId) &&
    typeof ctx.leafId === 'string' &&
    isTerminalLeafId(ctx.leafId) &&
    shouldWrapWithZellij(ctx.hostEnv) &&
    // Why: never re-wrap a command that already calls zellij (e.g. an explicit
    // `zellij attach` resume) — that would nest a second attach and hang.
    !commandAlreadyInvokesZellij(ctx.command) &&
    ctx.availability !== null &&
    // Why: SSH spawns pass `command` to the relay as an overlay-resolution hint
    // that the relay never executes — the renderer wraps those instead. Wrapping
    // here would corrupt the hint.
    !ctx.connectionId &&
    !ctx.startupCommandDeliveredByRenderer &&
    // Why: only wrap spawns the provider actually executes. A reattach carries a
    // sessionId with no fresh command; blank fresh launches have neither.
    (ctx.command !== undefined || ctx.sessionId === undefined)
  )
}

export function buildZellijSpawnCommand(ctx: ZellijSpawnWrapContext): string | null {
  if (!shouldApplyZellijSpawnWrap(ctx) || !ctx.worktreeId || !isTerminalLeafId(ctx.leafId ?? '')) {
    return null
  }
  return wrapLaunchCommandWithZellij({
    originalCommand: ctx.command,
    sessionName: buildZellijSessionName({
      worktreeId: ctx.worktreeId,
      stableLeafId: ctx.leafId as string
    }),
    cwd: ctx.cwd,
    env: ctx.paneEnv,
    availability: ctx.availability as ZellijCommandAvailability,
    shellCommand: ctx.shellCommand
  })
}
