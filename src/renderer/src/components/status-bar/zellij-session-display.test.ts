import { describe, expect, it } from 'vitest'
import {
  buildZellijAttachCommand,
  deriveZellijSessionLabel,
  toZellijSessionDisplayRows,
  zellijSessionStatusLabel
} from './zellij-session-display'
import type { ZellijSessionInfo } from '../../../../shared/zellij-session-list'

function session(overrides: Partial<ZellijSessionInfo>): ZellijSessionInfo {
  return {
    name: 'orca-feature-abc123',
    createdLabel: '1h ago',
    exited: false,
    current: false,
    orcaManaged: true,
    ...overrides
  }
}

describe('zellij session display', () => {
  it('derives a readable label from the Orca name scheme', () => {
    expect(deriveZellijSessionLabel('orca-latitudes-gateway-0te0s1u')).toBe('latitudes gateway')
    expect(deriveZellijSessionLabel('weird-name')).toBe('weird-name')
  })

  it('labels status by current/exited/running', () => {
    expect(zellijSessionStatusLabel(session({ current: true }))).toBe('Attached')
    expect(zellijSessionStatusLabel(session({ exited: true }))).toBe('Exited')
    expect(zellijSessionStatusLabel(session({}))).toBe('Running')
  })

  it('builds a safely quoted attach command', () => {
    expect(buildZellijAttachCommand('orca-feature-abc123')).toBe(
      "zellij attach 'orca-feature-abc123'"
    )
  })

  it('filters to Orca-managed sessions and sorts running before exited', () => {
    const rows = toZellijSessionDisplayRows([
      session({ name: 'orca-zeta-111', exited: true }),
      session({ name: 'bare', orcaManaged: false }),
      session({ name: 'orca-alpha-222' }),
      session({ name: 'orca-beta-333' })
    ])
    expect(rows.map((row) => row.name)).toEqual([
      'orca-alpha-222',
      'orca-beta-333',
      'orca-zeta-111'
    ])
  })
})
