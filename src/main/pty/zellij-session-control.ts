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
import type { ZellijSessionDeleteResult } from '../../shared/zellij-session-delete'

const execFileAsync = promisify(execFile)
const ZELLIJ_COMMAND_TIMEOUT_MS = 5_000

export type ZellijSessionExecutor = {
  deleteSession: (name: string) => Promise<void>
}

const localZellijExecutor: ZellijSessionExecutor = {
  deleteSession: async (name: string): Promise<void> => {
    await execFileAsync('zellij', ['delete-session', '--force', name], {
      timeout: ZELLIJ_COMMAND_TIMEOUT_MS
    })
  }
}

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
  await localZellijExecutor.deleteSession(name)
}

export async function killZellijSessions(
  names: readonly string[],
  executor: ZellijSessionExecutor = localZellijExecutor
): Promise<ZellijSessionDeleteResult> {
  const deleted: string[] = []
  const failed: { name: string; error: string }[] = []
  const seen = new Set<string>()

  for (const rawName of names) {
    const name = rawName.trim()
    if (!name || seen.has(name)) {
      continue
    }
    seen.add(name)

    if (!isOrcaManagedZellijSessionName(name)) {
      failed.push({ name, error: `Refusing to kill non-Orca Zellij session: ${name}` })
      continue
    }

    try {
      await executor.deleteSession(name)
      deleted.push(name)
    } catch (error) {
      failed.push({
        name,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return { deleted, failed }
}

export async function cleanupZellijSessionsAfterWorktreeRemoval(args: {
  deleteZellijSessionsOnSuccess?: boolean
  zellijSessionNames?: readonly string[]
  connectionId?: string | null
  createSshExecutor?: (connectionId: string) => ZellijSessionExecutor | null
}): Promise<string | undefined> {
  if (args.deleteZellijSessionsOnSuccess !== true) {
    return undefined
  }
  const names = args.zellijSessionNames ?? []
  if (names.length === 0) {
    return undefined
  }

  let executor: ZellijSessionExecutor | null = localZellijExecutor
  if (args.connectionId) {
    const createSshExecutor = args.createSshExecutor
    executor = createSshExecutor ? createSshExecutor(args.connectionId) : null
    if (!executor) {
      return 'Zellij session cleanup skipped: SSH connection unavailable'
    }
  } else if (process.platform !== 'linux') {
    return undefined
  }

  const result = await killZellijSessions(names, executor)
  if (result.failed.length === 0) {
    return undefined
  }
  const deletedCount = result.deleted.length
  const failedCount = result.failed.length
  console.warn(
    `[zellij-cleanup] partial failure: deleted=${deletedCount} failed=${failedCount}`,
    result.failed
  )
  return `Deleted ${deletedCount} Orca Zellij session(s); ${failedCount} failed`
}
