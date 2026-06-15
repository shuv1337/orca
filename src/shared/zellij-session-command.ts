import { quotePosixShell } from './wsl-login-shell-command'
import { getWorktreePathBasenameFromId } from './worktree-id'

export type ZellijCommandAvailability = 'known-present' | 'guarded'

export type ZellijSessionIdentity = {
  worktreeId: string
  stableLeafId: string
}

export type ZellijWrapOptions = {
  originalCommand?: string
  sessionName: string
  cwd?: string
  env?: Record<string, string> | null
  availability: ZellijCommandAvailability
  shellCommand?: string
}

export const ZELLIJ_PANE_ENV_KEYS = [
  'ORCA_PANE_KEY',
  'ORCA_TAB_ID',
  'ORCA_WORKTREE_ID',
  'ORCA_AGENT_HOOK_PORT',
  'ORCA_AGENT_HOOK_TOKEN',
  'ORCA_AGENT_HOOK_ENV',
  'ORCA_AGENT_HOOK_VERSION',
  'ORCA_FEATURE_REMOTE_AGENT_HOOKS',
  'ORCA_TERMINAL_HANDLE',
  'ORCA_AGENT_TEAMS_TEAM_ID',
  'ORCA_PI_PREFILL',
  'ORCA_OMP_PREFILL'
] as const

const ZELLIJ_ENV_KEY_SET = new Set<string>(ZELLIJ_PANE_ENV_KEYS)
const SHELL_VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const SESSION_LABEL_MAX = 24

export function shouldWrapWithZellij(env: Record<string, string | undefined> = {}): boolean {
  return !('ZELLIJ' in env) && !('ZELLIJ_SESSION_NAME' in env)
}

export function buildZellijSessionName({
  worktreeId,
  stableLeafId
}: ZellijSessionIdentity): string {
  const label = sanitizeZellijNamePart(getWorktreePathBasenameFromId(worktreeId) ?? 'workspace')
    .slice(0, SESSION_LABEL_MAX)
    .replace(/-+$/g, '')
  const hash = shortStableHash(`${worktreeId}\0${stableLeafId}`)
  return `orca-${label || 'workspace'}-${hash}`
}

export function wrapLaunchCommandWithZellij(options: ZellijWrapOptions): string {
  const zellijCommand = buildAttachOrCreateCommand(options)
  if (options.availability === 'known-present') {
    return zellijCommand
  }
  const fallback = options.originalCommand?.trim()
  if (!fallback) {
    return `if command -v zellij >/dev/null 2>&1; then ${zellijCommand}; fi`
  }
  return `if command -v zellij >/dev/null 2>&1; then ${zellijCommand}; else ${fallback}; fi`
}

export function filterZellijPaneEnv(
  env: Record<string, string> | null | undefined
): Record<string, string> {
  const filtered: Record<string, string> = {}
  if (!env) {
    return filtered
  }
  for (const [key, value] of Object.entries(env)) {
    if (!ZELLIJ_ENV_KEY_SET.has(key) || !SHELL_VARIABLE_NAME_RE.test(key)) {
      continue
    }
    filtered[key] = value
  }
  return filtered
}

export function kdlStringEscape(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`
}

function buildAttachOrCreateCommand(options: ZellijWrapOptions): string {
  const sessionName = quotePosixShell(options.sessionName)
  const originalCommand = options.originalCommand?.trim()
  if (!originalCommand) {
    return `zellij attach -c ${sessionName}`
  }
  // Why: zellij 0.44 only honors a custom layout on session CREATE through
  // `--new-session-with-layout <file>` — `-s NAME --layout-string` errors with
  // "session not found" because that flag means "add a tab to an existing
  // session". The layout therefore has to live in a real file; we stage it in a
  // throwaway dir whose basename ends in `.kdl` so zellij treats it as a path
  // rather than a named layout, then attach-or-create. Single-line KDL keeps the
  // typed/pasted command free of embedded newlines on the SSH + paste paths.
  const layout = quotePosixShell(buildZellijLayoutString(options))
  const createCommand =
    `d=$(mktemp -d) && printf '%s' ${layout} > "$d/layout.kdl" && ` +
    `zellij -s ${sessionName} -n "$d/layout.kdl"`
  // Why: zellij reads the staged layout only at session-create time, so drop the
  // temp dir once the create command returns (on detach). Best-effort cleanup —
  // a daemon kill before detach leaves it for the OS tmp reaper. `rm -rf ""` is
  // a no-op under `-f` if `mktemp` failed before `$d` was assigned.
  return `zellij attach ${sessionName} 2>/dev/null || { ${createCommand}; rm -rf "$d"; }`
}

function buildZellijLayoutString({
  originalCommand,
  cwd,
  env,
  // Why: `sh` is a deliberate POSIX bootstrap whose only job is to apply the
  // allowlisted ORCA_* env and then `exec` the real command (which becomes its
  // own process). Callers thread the user's resolved shell through
  // `shellCommand` so a login shell (bash/zsh) sources the user's profile chain
  // — typically pulling in PATH/NODE_OPTIONS from `.bashrc`/`.zshrc` — before
  // the `exec`. Blank panes never reach here; they use Zellij's own default
  // shell via `zellij attach -c`.
  shellCommand = 'sh'
}: ZellijWrapOptions): string {
  const command = originalCommand?.trim()
  if (!command) {
    throw new Error('Zellij command layout requires a command')
  }
  const exports = Object.entries(filterZellijPaneEnv(env))
    .map(([key, value]) => `export ${key}=${quotePosixShell(value)};`)
    .join(' ')
  const innerCommand = `${exports ? `${exports} ` : ''}exec ${command}`
  const cwdLine = cwd ? ` cwd=${kdlStringEscape(cwd)}` : ''
  // Single-line KDL: pane/args nodes terminated with `;` so the layout has no
  // newlines to corrupt the typed launch command.
  return (
    `layout { pane${cwdLine} command=${kdlStringEscape(shellCommand)} ` +
    `{ args ${kdlStringEscape('-lc')} ${kdlStringEscape(innerCommand)}; }; }`
  )
}

function sanitizeZellijNamePart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^[_.-]+/g, '')
      .replace(/-+/g, '-')
      .replace(/[_.-]+$/g, '') || 'workspace'
  )
}

function shortStableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).padStart(7, '0')
}
