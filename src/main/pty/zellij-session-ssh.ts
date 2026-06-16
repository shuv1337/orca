// Why: SSH-hosted Zellij sessions live on the remote host; worktree deletion must
// run `zellij delete-session` there instead of on the local desktop binary.
import { quotePosixShell } from '../../shared/wsl-login-shell-command'
import { getSshConnectionManager } from '../ipc/ssh'
import { execCommand } from '../ssh/ssh-relay-deploy-helpers'
import type { ZellijSessionExecutor } from './zellij-session-control'

const ZELLIJ_COMMAND_TIMEOUT_MS = 5_000

export function createSshZellijSessionExecutor(connectionId: string): ZellijSessionExecutor | null {
  const conn = getSshConnectionManager()?.getConnection(connectionId)
  if (!conn) {
    return null
  }
  return {
    deleteSession: async (name: string): Promise<void> => {
      const quotedName = quotePosixShell(name)
      await execCommand(conn, `zellij delete-session --force ${quotedName}`, {
        timeoutMs: ZELLIJ_COMMAND_TIMEOUT_MS
      })
    }
  }
}
