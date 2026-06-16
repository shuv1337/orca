import { describe, expect, it } from 'vitest'
import {
  countZellijSessionsByStatus,
  filterZellijSessionNamesBySelection,
  getAllZellijSessionNames,
  getExitedZellijSessionNames,
  shouldConfirmBulkZellijDelete,
  type ZellijSessionDisplayRow
} from './zellij-session-display'

function row(name: string, exited = false): ZellijSessionDisplayRow {
  return {
    name,
    label: name,
    statusLabel: exited ? 'Exited' : 'Running',
    exited,
    current: false,
    attachCommand: `zellij attach '${name}'`
  }
}

describe('zellij session bulk helpers', () => {
  const rows = [row('orca-a-111'), row('orca-b-222', true), row('orca-c-333')]

  it('filters selected/all/exited names', () => {
    const selected = new Set(['orca-a-111', 'orca-c-333'])
    expect(filterZellijSessionNamesBySelection(rows, selected)).toEqual([
      'orca-a-111',
      'orca-c-333'
    ])
    expect(getAllZellijSessionNames(rows)).toEqual(['orca-a-111', 'orca-b-222', 'orca-c-333'])
    expect(getExitedZellijSessionNames(rows)).toEqual(['orca-b-222'])
  })

  it('counts running and exited sessions', () => {
    expect(countZellijSessionsByStatus(rows)).toEqual({
      total: 3,
      running: 2,
      exited: 1
    })
  })

  it('requires confirmation for multi-delete and delete-all with running sessions', () => {
    expect(
      shouldConfirmBulkZellijDelete({
        targetNames: ['orca-a-111', 'orca-c-333'],
        rows
      })
    ).toBe(true)
    expect(
      shouldConfirmBulkZellijDelete({
        targetNames: ['orca-b-222'],
        rows,
        deleteAllIncludesRunning: true
      })
    ).toBe(false)
    expect(
      shouldConfirmBulkZellijDelete({
        targetNames: ['orca-a-111'],
        rows,
        deleteAllIncludesRunning: true
      })
    ).toBe(true)
  })
})
