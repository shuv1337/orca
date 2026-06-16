// Why: worktree deletion must pass exact Orca Zellij session names derived from
// terminal layout state — the hash is not reversible from session labels alone.
import { buildZellijSessionName } from '../../../shared/zellij-session-command'
import { isTerminalLeafId } from '../../../shared/stable-pane-id'
import type { TerminalLayoutSnapshot, TerminalPaneLayoutNode } from '../../../shared/types'

function collectLayoutLeafIds(root: TerminalPaneLayoutNode | null): string[] {
  if (!root) {
    return []
  }
  const leafIds: string[] = []
  const visit = (node: TerminalPaneLayoutNode): void => {
    if (node.type === 'leaf') {
      leafIds.push(node.leafId)
      return
    }
    visit(node.first)
    visit(node.second)
  }
  visit(root)
  return leafIds
}

export function collectWorktreeZellijSessionNames(args: {
  worktreeId: string
  tabs: readonly { id: string }[]
  terminalLayoutsByTabId: Readonly<Record<string, TerminalLayoutSnapshot>>
}): string[] {
  const names = new Set<string>()
  for (const tab of args.tabs) {
    const layout = args.terminalLayoutsByTabId[tab.id]
    if (!layout) {
      continue
    }
    const leafIds = new Set<string>()
    for (const leafId of collectLayoutLeafIds(layout.root)) {
      if (isTerminalLeafId(leafId)) {
        leafIds.add(leafId)
      }
    }
    for (const leafId of Object.keys(layout.ptyIdsByLeafId ?? {})) {
      if (isTerminalLeafId(leafId)) {
        leafIds.add(leafId)
      }
    }
    for (const leafId of leafIds) {
      names.add(buildZellijSessionName({ worktreeId: args.worktreeId, stableLeafId: leafId }))
    }
  }
  return [...names]
}
