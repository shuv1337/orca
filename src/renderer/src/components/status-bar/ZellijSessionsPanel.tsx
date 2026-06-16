import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '../../store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import {
  countZellijSessionsByStatus,
  filterZellijSessionNamesBySelection,
  getAllZellijSessionNames,
  getExitedZellijSessionNames,
  shouldConfirmBulkZellijDelete,
  toZellijSessionDisplayRows,
  type ZellijSessionDisplayRow
} from './zellij-session-display'
import {
  summarizeZellijBulkDeleteResult,
  ZellijSessionsBulkDeleteDialog,
  ZellijSessionsBulkToolbar,
  type BulkDeleteKind,
  type ZellijBulkDeleteDialogState
} from './zellij-sessions-bulk-ui'

const ZELLIJ_SESSIONS_POLL_MS = 10_000

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
  const [selectedNames, setSelectedNames] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [pendingBulkDelete, setPendingBulkDelete] = useState<ZellijBulkDeleteDialogState>(null)

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

  useEffect(() => {
    setSelectedNames((prev) => {
      const next = new Set<string>()
      const rowNames = new Set(rows.map((row) => row.name))
      for (const name of prev) {
        if (rowNames.has(name)) {
          next.add(name)
        }
      }
      return next
    })
  }, [rows])

  const counts = useMemo(() => countZellijSessionsByStatus(rows), [rows])
  const allSelected = rows.length > 0 && selectedNames.size === rows.length

  const toggleSelected = useCallback((name: string, checked: boolean): void => {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(name)
      } else {
        next.delete(name)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((): void => {
    setSelectedNames((prev) => {
      if (rows.length === 0) {
        return prev
      }
      if (prev.size === rows.length) {
        return new Set()
      }
      return new Set(rows.map((row) => row.name))
    })
  }, [rows])

  const runBulkDelete = useCallback(
    async (names: string[]): Promise<void> => {
      if (names.length === 0 || bulkDeleting) {
        return
      }
      setBulkDeleting(true)
      setRows((prev) => prev.filter((row) => !names.includes(row.name)))
      setSelectedNames((prev) => {
        const next = new Set(prev)
        for (const name of names) {
          next.delete(name)
        }
        return next
      })
      try {
        const result = await window.api.pty.killZellijSessions(names)
        const summary = summarizeZellijBulkDeleteResult(result)
        if (summary?.kind === 'success') {
          toast.success(
            translate(
              'auto.components.status.bar.ZellijSessionsPanel.bulk_delete_success',
              'Deleted {{count}} Zellij session(s).',
              { count: summary.deleted }
            )
          )
        } else if (summary?.kind === 'error') {
          toast.error(
            translate(
              'auto.components.status.bar.ZellijSessionsPanel.bulk_delete_failed',
              'Failed to delete {{count}} Zellij session(s).',
              { count: summary.failed }
            )
          )
        } else if (summary?.kind === 'warning') {
          toast.warning(
            translate(
              'auto.components.status.bar.ZellijSessionsPanel.bulk_delete_partial',
              'Deleted {{deleted}} session(s); {{failed}} failed.',
              { deleted: summary.deleted, failed: summary.failed }
            )
          )
        }
      } catch {
        toast.error(
          translate(
            'auto.components.status.bar.ZellijSessionsPanel.bulk_delete_failed',
            'Failed to delete {{count}} Zellij session(s).',
            { count: names.length }
          )
        )
      } finally {
        setBulkDeleting(false)
        void refresh()
      }
    },
    [bulkDeleting, refresh]
  )

  const requestBulkDelete = useCallback(
    (kind: BulkDeleteKind): void => {
      const names =
        kind === 'selected'
          ? filterZellijSessionNamesBySelection(rows, selectedNames)
          : kind === 'exited'
            ? getExitedZellijSessionNames(rows)
            : getAllZellijSessionNames(rows)
      if (names.length === 0) {
        return
      }
      if (
        shouldConfirmBulkZellijDelete({
          targetNames: names,
          rows,
          deleteAllIncludesRunning: kind === 'all'
        })
      ) {
        setPendingBulkDelete({ kind, names })
        return
      }
      void runBulkDelete(names)
    },
    [rows, runBulkDelete, selectedNames]
  )

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
      setSelectedNames((prev) => {
        const next = new Set(prev)
        next.delete(row.name)
        return next
      })
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

  if (loaded && rows.length === 0) {
    return null
  }

  const pendingDeleteCounts =
    pendingBulkDelete === null
      ? null
      : countZellijSessionsByStatus(
          rows.filter((row) => pendingBulkDelete.names.includes(row.name))
        )

  return (
    <div className="border-t border-border/50 bg-muted/10">
      <div className="flex items-center justify-between gap-2 px-3 py-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Boxes className="size-3 shrink-0" />
          <span className="truncate">
            {translate('auto.components.status.bar.ZellijSessionsPanel.title', 'Zellij sessions')}
          </span>
          <span className="font-mono tabular-nums">{rows.length}</span>
        </div>
        <ZellijSessionsBulkToolbar
          rowCount={rows.length}
          allSelected={allSelected}
          selectedCount={selectedNames.size}
          exitedCount={counts.exited}
          loading={loading}
          bulkDeleting={bulkDeleting}
          onToggleSelectAll={toggleSelectAll}
          onRefresh={() => void refresh()}
          onRequestBulkDelete={requestBulkDelete}
        />
      </div>
      <div className="pb-1">
        {rows.map((row) => (
          <div
            key={row.name}
            className="group/zsess grid grid-cols-[1rem_0.5rem_minmax(4.5rem,0.45fr)_minmax(0,1fr)_3.75rem] items-center gap-2 px-3 py-1 text-[11px] hover:bg-accent/40"
          >
            <Checkbox
              checked={selectedNames.has(row.name)}
              onCheckedChange={(checked) => toggleSelected(row.name, checked === true)}
              disabled={bulkDeleting}
              aria-label={translate(
                'auto.components.status.bar.ZellijSessionsPanel.select_row',
                'Select {{value0}}',
                { value0: row.label }
              )}
              className="size-3.5"
            />
            <span
              className={cn(
                'size-1.5 rounded-full',
                row.exited ? 'bg-muted-foreground/40' : 'bg-emerald-500'
              )}
              aria-hidden
            />
            <span className="truncate font-medium text-foreground">{row.label}</span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {row.name} · {row.statusLabel}
            </span>
            <span className="flex justify-end gap-0.5">
              <button
                type="button"
                onClick={() => handleResume(row)}
                aria-label={translate(
                  'auto.components.status.bar.ZellijSessionsPanel.resume',
                  'Resume {{value0}}',
                  { value0: row.label }
                )}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/zsess:opacity-100 focus-visible:opacity-100"
              >
                <ExternalLink className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => void handleKill(row)}
                disabled={killingName === row.name || bulkDeleting}
                aria-label={translate(
                  'auto.components.status.bar.ZellijSessionsPanel.delete',
                  'Delete {{value0}}',
                  { value0: row.label }
                )}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/zsess:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
              >
                {killingName === row.name ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
              </button>
            </span>
          </div>
        ))}
      </div>

      <ZellijSessionsBulkDeleteDialog
        pendingBulkDelete={pendingBulkDelete}
        pendingDeleteCounts={pendingDeleteCounts}
        bulkDeleting={bulkDeleting}
        onClose={() => setPendingBulkDelete(null)}
        onConfirm={(names) => {
          setPendingBulkDelete(null)
          void runBulkDelete(names)
        }}
      />
    </div>
  )
}
