import { describe, expect, it } from 'vitest'
import { buildZellijSpawnCommand, shouldApplyZellijSpawnWrap } from './zellij-spawn-command'

const LEAF = '11111111-1111-4111-8111-111111111111'
const WORKTREE = 'repo::/home/user/feature'

function baseCtx(overrides: Partial<Parameters<typeof shouldApplyZellijSpawnWrap>[0]> = {}) {
  return {
    useZellij: true,
    hostEnv: {} as Record<string, string | undefined>,
    worktreeId: WORKTREE,
    leafId: LEAF,
    connectionId: null,
    command: 'claude',
    sessionId: undefined,
    startupCommandDeliveredByRenderer: false,
    availability: 'known-present' as const,
    cwd: '/home/user/feature',
    paneEnv: { ORCA_PANE_KEY: `tab-1:${LEAF}` },
    shellCommand: '/bin/bash',
    ...overrides
  }
}

describe('zellij spawn wrap gate', () => {
  it('wraps an eligible local host launch', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx())).toBe(true)
    const command = buildZellijSpawnCommand(baseCtx())
    expect(command).toContain('zellij attach')
    expect(command).toContain('exec claude')
  })

  it('does not wrap when the setting is off', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ useZellij: false }))).toBe(false)
    expect(buildZellijSpawnCommand(baseCtx({ useZellij: false }))).toBeNull()
  })

  it('does not wrap when zellij is unavailable on the host', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ availability: null }))).toBe(false)
  })

  it('does not wrap SSH spawns (relay hint corruption)', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ connectionId: 'conn-1' }))).toBe(false)
  })

  it('does not wrap when the renderer delivers the startup command', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ startupCommandDeliveredByRenderer: true }))).toBe(
      false
    )
  })

  it('does not re-wrap a command that already invokes zellij', () => {
    expect(
      shouldApplyZellijSpawnWrap(baseCtx({ command: "zellij attach 'orca-feature-abc123'" }))
    ).toBe(false)
    expect(shouldApplyZellijSpawnWrap(baseCtx({ command: 'ORCA_X=1 zellij attach foo' }))).toBe(
      false
    )
  })

  it('does not wrap when already nested inside zellij', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ hostEnv: { ZELLIJ: '0' } }))).toBe(false)
    expect(shouldApplyZellijSpawnWrap(baseCtx({ hostEnv: { ZELLIJ_SESSION_NAME: 'outer' } }))).toBe(
      false
    )
  })

  it('rejects a renderer-local pane id that is not a stable leaf UUID', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ leafId: '7' }))).toBe(false)
    expect(buildZellijSpawnCommand(baseCtx({ leafId: '7' }))).toBeNull()
  })

  it('requires a worktree id', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ worktreeId: undefined }))).toBe(false)
  })

  it('wraps a blank fresh launch (no command, no session id)', () => {
    const ctx = baseCtx({ command: undefined, sessionId: undefined })
    expect(shouldApplyZellijSpawnWrap(ctx)).toBe(true)
    expect(buildZellijSpawnCommand(ctx)).toContain('zellij attach -c')
  })

  it('does not wrap a reattach (session id present, no fresh command)', () => {
    expect(shouldApplyZellijSpawnWrap(baseCtx({ command: undefined, sessionId: 'sess-1' }))).toBe(
      false
    )
  })

  it('produces identical deterministic session names for the same identity', () => {
    const a = buildZellijSpawnCommand(baseCtx())
    const b = buildZellijSpawnCommand(baseCtx({ command: 'codex' }))
    const nameA = a?.match(/zellij attach '([^']+)'/)?.[1]
    const nameB = b?.match(/zellij attach '([^']+)'/)?.[1]
    expect(nameA).toBeDefined()
    expect(nameA).toBe(nameB)
  })
})
