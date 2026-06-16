import { describe, expect, it } from 'vitest'
import { collectWorktreeZellijSessionNames } from './worktree-zellij-session-names'
import type { TerminalLayoutSnapshot } from '../../../shared/types'

const LEAF_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LEAF_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const LEAF_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function makeLayout(overrides: Partial<TerminalLayoutSnapshot> = {}): TerminalLayoutSnapshot {
  return {
    root: {
      type: 'split',
      direction: 'horizontal',
      first: { type: 'leaf', leafId: LEAF_A },
      second: { type: 'leaf', leafId: LEAF_B }
    },
    activeLeafId: LEAF_A,
    expandedLeafId: null,
    ...overrides
  }
}

describe('collectWorktreeZellijSessionNames', () => {
  it('derives names from layout root leaf IDs and valid ptyIdsByLeafId keys', () => {
    const names = collectWorktreeZellijSessionNames({
      worktreeId: 'repo1::/path/feature',
      tabs: [{ id: 'tab-1' }],
      terminalLayoutsByTabId: {
        'tab-1': makeLayout({
          ptyIdsByLeafId: {
            [LEAF_C]: 'pty-1',
            'pane:legacy': 'pty-2'
          }
        })
      }
    })
    expect(names).toHaveLength(3)
    expect(names.every((name) => name.startsWith('orca-'))).toBe(true)
    expect(names.every((name) => name.includes('feature'))).toBe(true)
  })

  it('deduplicates names across tabs and layout sources', () => {
    const names = collectWorktreeZellijSessionNames({
      worktreeId: 'repo1::/path/feature',
      tabs: [{ id: 'tab-1' }, { id: 'tab-2' }],
      terminalLayoutsByTabId: {
        'tab-1': makeLayout(),
        'tab-2': makeLayout({
          root: { type: 'leaf', leafId: LEAF_A }
        })
      }
    })
    expect(new Set(names).size).toBe(names.length)
  })
})
