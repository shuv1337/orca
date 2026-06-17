import { ChevronDown, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ZellijSessionDisplayRow } from './zellij-session-display'

type BulkDeleteKind = 'selected' | 'all' | 'exited'

export type ZellijBulkDeleteDialogState = {
  kind: BulkDeleteKind
  names: string[]
} | null

type ZellijSessionsBulkToolbarProps = {
  rowCount: number
  allSelected: boolean
  selectedCount: number
  exitedCount: number
  loading: boolean
  bulkDeleting: boolean
  onToggleSelectAll: () => void
  onRefresh: () => void
  onRequestBulkDelete: (kind: BulkDeleteKind) => void
}

export function ZellijSessionsBulkToolbar({
  rowCount,
  allSelected,
  selectedCount,
  exitedCount,
  loading,
  bulkDeleting,
  onToggleSelectAll,
  onRefresh,
  onRequestBulkDelete
}: ZellijSessionsBulkToolbarProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onToggleSelectAll}
        disabled={rowCount === 0 || bulkDeleting}
        aria-label={
          allSelected
            ? translate(
                'auto.components.status.bar.ZellijSessionsPanel.clear_selection',
                'Clear selection'
              )
            : translate(
                'auto.components.status.bar.ZellijSessionsPanel.select_all_sessions',
                'Select all Zellij sessions'
              )
        }
        className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        {allSelected
          ? translate('auto.components.status.bar.ZellijSessionsPanel.clear', 'Clear')
          : translate('auto.components.status.bar.ZellijSessionsPanel.select_all', 'All')}
      </button>
      <button
        type="button"
        onClick={() => onRequestBulkDelete('selected')}
        disabled={selectedCount === 0 || bulkDeleting}
        aria-label={translate(
          'auto.components.status.bar.ZellijSessionsPanel.delete_selected',
          'Delete selected Zellij sessions'
        )}
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
      >
        {bulkDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={rowCount === 0 || bulkDeleting}
            aria-label={translate(
              'auto.components.status.bar.ZellijSessionsPanel.more_actions',
              'More Zellij session actions'
            )}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem
            disabled={exitedCount === 0}
            onSelect={() => onRequestBulkDelete('exited')}
          >
            {translate(
              'auto.components.status.bar.ZellijSessionsPanel.delete_exited',
              'Delete exited'
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onRequestBulkDelete('all')}>
            {translate('auto.components.status.bar.ZellijSessionsPanel.delete_all', 'Delete all')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        aria-label={translate(
          'auto.components.status.bar.ZellijSessionsPanel.refresh',
          'Refresh Zellij sessions'
        )}
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
      </button>
    </div>
  )
}

export function ZellijSessionsBulkDeleteDialog({
  pendingBulkDelete,
  pendingDeleteCounts,
  bulkDeleting,
  onClose,
  onConfirm
}: {
  pendingBulkDelete: ZellijBulkDeleteDialogState
  pendingDeleteCounts: { total: number; running: number; exited: number } | null
  bulkDeleting: boolean
  onClose: () => void
  onConfirm: (names: string[]) => void
}): React.JSX.Element {
  return (
    <Dialog
      open={pendingBulkDelete !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.status.bar.ZellijSessionsPanel.confirm_title',
              'Delete Zellij sessions?'
            )}
          </DialogTitle>
          <DialogDescription>
            {pendingBulkDelete === null || pendingDeleteCounts === null
              ? null
              : translate(
                  'auto.components.status.bar.ZellijSessionsPanel.confirm_body',
                  'This will delete {{count}} Orca-managed session(s) ({{running}} running, {{exited}} exited). Attached processes in live sessions will be terminated.',
                  {
                    count: pendingDeleteCounts.total,
                    running: pendingDeleteCounts.running,
                    exited: pendingDeleteCounts.exited
                  }
                )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {translate('auto.components.status.bar.ZellijSessionsPanel.cancel', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={bulkDeleting || pendingBulkDelete === null}
            onClick={() => {
              const names = pendingBulkDelete?.names ?? []
              onConfirm(names)
            }}
          >
            {translate(
              'auto.components.status.bar.ZellijSessionsPanel.confirm_delete',
              'Delete sessions'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function summarizeZellijBulkDeleteResult(result: {
  deleted: string[]
  failed: { name: string; error: string }[]
}): { kind: 'success' | 'error' | 'warning'; deleted: number; failed: number } | null {
  const deletedCount = result.deleted.length
  const failedCount = result.failed.length
  if (deletedCount === 0 && failedCount === 0) {
    return null
  }
  if (failedCount === 0) {
    return { kind: 'success', deleted: deletedCount, failed: 0 }
  }
  if (deletedCount === 0) {
    return { kind: 'error', deleted: 0, failed: failedCount }
  }
  return { kind: 'warning', deleted: deletedCount, failed: failedCount }
}

export type { BulkDeleteKind, ZellijSessionDisplayRow }
