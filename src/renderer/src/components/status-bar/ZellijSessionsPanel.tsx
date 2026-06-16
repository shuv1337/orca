import { useCallback, useEffect, useState } from 'react'
import { Boxes, ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '../../store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { toZellijSessionDisplayRows, type ZellijSessionDisplayRow } from './zellij-session-display'

const ZELLIJ_SESSIONS_POLL_MS = 10_000

// Why: resuming a Zellij session opens a terminal tab that runs `zellij attach`.
// The pty-connection guard (commandAlreadyInvokesZellij) prevents Orca from
// re-wrapping this into a nested session.
function attachZellijSession(attachCommand: string): boolean {
  const state = useAppStore.getState()
  const worktreeId = state.activeWorktreeId
  if (!worktreeId) {
    toast.error(
      translate(
        'auto.components.status.bar.ZellijSessionsPanel.no_active_worktree',
        'Open a workspace first to resume a Zellij session.'
      )
    )
    return false
  }
  const groupId = state.activeGroupIdByWorktree[worktreeId] ?? undefined
  const tab = state.createTab(worktreeId, groupId)
  state.queueTabStartupCommand(tab.id, { command: attachCommand })
  state.setActiveTabType('terminal')
  return true
}

export function ZellijSessionsPanel({
  onResumed
}: {
  onResumed?: () => void
}): React.JSX.Element | null {
  const [rows, setRows] = useState<ZellijSessionDisplayRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [killingName, setKillingName] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const sessions = await window.api.pty.listZellijSessions()
      setRows(toZellijSessionDisplayRows(sessions))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), ZELLIJ_SESSIONS_POLL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const handleResume = useCallback(
    (row: ZellijSessionDisplayRow): void => {
      if (attachZellijSession(row.attachCommand)) {
        onResumed?.()
      }
    },
    [onResumed]
  )

  const handleKill = useCallback(
    async (row: ZellijSessionDisplayRow): Promise<void> => {
      setKillingName(row.name)
      // Why: optimistic removal so the row disappears immediately rather than
      // lingering until the next poll reconciles the deleted session.
      setRows((prev) => prev.filter((r) => r.name !== row.name))
      try {
        await window.api.pty.killZellijSession(row.name)
      } catch {
        toast.error(
          translate(
            'auto.components.status.bar.ZellijSessionsPanel.kill_failed',
            'Failed to delete Zellij session.'
          )
        )
      } finally {
        setKillingName(null)
        void refresh()
      }
    },
    [refresh]
  )

  // Why: keep the panel out of the popover entirely when there are no
  // Orca-managed Zellij sessions, so non-Zellij users see no extra chrome.
  if (loaded && rows.length === 0) {
    return null
  }

  return (
    <div className="border-t border-border/50 bg-muted/15">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-foreground">
          <Boxes className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {translate('auto.components.status.bar.ZellijSessionsPanel.title', 'Zellij sessions')}
          </span>
          <span className="text-muted-foreground">{rows.length}</span>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label={translate(
            'auto.components.status.bar.ZellijSessionsPanel.refresh',
            'Refresh Zellij sessions'
          )}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto scrollbar-sleek pb-1">
        {rows.map((row) => (
          <div
            key={row.name}
            className="group/zsess flex items-center gap-2 px-3 py-1.5 hover:bg-accent/40"
          >
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                row.exited ? 'bg-muted-foreground/40' : 'bg-emerald-500'
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-medium text-foreground">{row.label}</div>
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {row.name} · {row.statusLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleResume(row)}
              aria-label={translate(
                'auto.components.status.bar.ZellijSessionsPanel.resume',
                'Resume {{value0}}',
                { value0: row.label }
              )}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/zsess:opacity-100 focus-visible:opacity-100"
            >
              <ExternalLink className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => void handleKill(row)}
              disabled={killingName === row.name}
              aria-label={translate(
                'auto.components.status.bar.ZellijSessionsPanel.delete',
                'Delete {{value0}}',
                { value0: row.label }
              )}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/zsess:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
            >
              {killingName === row.name ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
