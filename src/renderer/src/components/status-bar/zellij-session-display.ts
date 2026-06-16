// Why: the Resource Manager's Zellij panel renders Orca-spawned sessions. The
// pure shaping/labeling lives here so it can be unit-tested independent of React
// and shared between the local and runtime-host code paths.
import type { ZellijSessionInfo } from '../../../../shared/zellij-session-list'

export type ZellijSessionDisplayRow = {
  name: string
  /** Worktree-ish label derived from the Orca session name, for readability. */
  label: string
  statusLabel: string
  exited: boolean
  current: boolean
  attachCommand: string
}

// Orca names are `orca-<label>-<hash>`; show the label portion for readability.
const ORCA_NAME_RE = /^orca-(.+)-[a-z0-9]+$/

export function deriveZellijSessionLabel(name: string): string {
  const match = ORCA_NAME_RE.exec(name)
  if (!match) {
    return name
  }
  return match[1].replace(/-/g, ' ')
}

export function zellijSessionStatusLabel(session: ZellijSessionInfo): string {
  if (session.current) {
    return 'Attached'
  }
  if (session.exited) {
    return 'Exited'
  }
  return 'Running'
}

export function buildZellijAttachCommand(name: string): string {
  // Single-quote the name for POSIX safety; Orca names are already a safe
  // charset but this keeps the typed command robust.
  return `zellij attach '${name.replace(/'/g, "'\\''")}'`
}

export function toZellijSessionDisplayRows(
  sessions: readonly ZellijSessionInfo[]
): ZellijSessionDisplayRow[] {
  return sessions
    .filter((session) => session.orcaManaged)
    .map((session) => ({
      name: session.name,
      label: deriveZellijSessionLabel(session.name),
      statusLabel: zellijSessionStatusLabel(session),
      exited: session.exited,
      current: session.current,
      attachCommand: buildZellijAttachCommand(session.name)
    }))
    .sort((a, b) => {
      // Running first, then exited; alphabetical within a group.
      if (a.exited !== b.exited) {
        return a.exited ? 1 : -1
      }
      return a.label.localeCompare(b.label)
    })
}
