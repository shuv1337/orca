// Why: the Resource Manager lists and kills Orca-spawned Zellij sessions. These
// sessions live in the Zellij server (independent of Orca's PTY daemon), so they
// must be queried/controlled via the `zellij` binary itself rather than the PTY
// registry. Kept separate from pty.ts so the process-spawning surface stays small.
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  isOrcaManagedZellijSessionName,
  parseZellijSessionList,
  type ZellijSessionInfo
} from '../../shared/zellij-session-list'

const execFileAsync = promisify(execFile)
const ZELLIJ_COMMAND_TIMEOUT_MS = 5_000

export async function listZellijSessions(): Promise<ZellijSessionInfo[]> {
  try {
    const { stdout } = await execFileAsync('zellij', ['list-sessions', '--no-formatting'], {
      timeout: ZELLIJ_COMMAND_TIMEOUT_MS
    })
    return parseZellijSessionList(stdout)
  } catch (error) {
    // Why: zellij exits non-zero with "No active zellij sessions found." when the
    // server is empty. Treat that as an empty list, not an error.
    const stdout = (error as { stdout?: string })?.stdout ?? ''
    const stderr = (error as { stderr?: string })?.stderr ?? ''
    if (/No active zellij sessions/i.test(stdout) || /No active zellij sessions/i.test(stderr)) {
      return []
    }
    throw error
  }
}

export async function killZellijSession(name: string): Promise<void> {
  // Why: only Orca-managed sessions are killable from this surface so a stray
  // arg can never tear down a user's hand-made session.
  if (!isOrcaManagedZellijSessionName(name)) {
    throw new Error(`Refusing to kill non-Orca Zellij session: ${name}`)
  }
  // `delete-session --force` removes both live and EXITED (resurrectable)
  // sessions; `kill-session` only stops a running one and leaves the corpse.
  await execFileAsync('zellij', ['delete-session', '--force', name], {
    timeout: ZELLIJ_COMMAND_TIMEOUT_MS
  })
}
