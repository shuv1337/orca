// Why: `zellij list-sessions --no-formatting` is parsed in both the main process
// (local host) and over runtime RPC (remote Orca client) to populate the
// Resource Manager. Keeping the parser and the Orca-ownership predicate pure and
// shared guarantees both surfaces agree on which sessions are Orca-managed.
import { buildZellijSessionName } from './zellij-session-command'

export type ZellijSessionInfo = {
  /** Raw zellij session name. */
  name: string
  /** zellij's "Created ... ago" label, when present. */
  createdLabel: string | null
  /** True when zellij reports the session as EXITED (resurrectable). */
  exited: boolean
  /** True when this session is the one the listing client is attached to. */
  current: boolean
  /** True when the name matches Orca's deterministic session-name scheme. */
  orcaManaged: boolean
}

// Orca session names are `orca-<sanitized-label>-<base36hash>`; the label is
// lowercased and uses only [a-z0-9_.-]. The bare `orca` session a user may have
// created by hand is intentionally excluded by requiring the label+hash shape.
const ORCA_SESSION_NAME_RE = /^orca-[a-z0-9_.-]+-[a-z0-9]{7}$/

export function isOrcaManagedZellijSessionName(name: string): boolean {
  return ORCA_SESSION_NAME_RE.test(name)
}

export function zellijSessionNameMatchesIdentity(
  name: string,
  identity: { worktreeId: string; stableLeafId: string }
): boolean {
  return name === buildZellijSessionName(identity)
}

const SESSION_LINE_RE = /^(\S+)(?:\s+\[Created\s+(.+?)\s+ago\])?(.*)$/

export function parseZellijSessionList(stdout: string): ZellijSessionInfo[] {
  const sessions: ZellijSessionInfo[] = []
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }
    const match = SESSION_LINE_RE.exec(line)
    if (!match) {
      continue
    }
    const name = match[1]
    const createdLabel = match[2]?.trim() || null
    const trailer = match[3] ?? ''
    sessions.push({
      name,
      createdLabel,
      exited: /\bEXITED\b/.test(trailer),
      current: /\(current\)/.test(trailer),
      orcaManaged: isOrcaManagedZellijSessionName(name)
    })
  }
  return sessions
}
