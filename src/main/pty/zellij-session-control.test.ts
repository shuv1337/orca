import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const execFileAsyncMock = vi.fn()

vi.mock('child_process', () => ({
  execFile: vi.fn()
}))

vi.mock('util', () => ({
  promisify: () => execFileAsyncMock
}))

describe('killZellijSessions', () => {
  beforeEach(() => {
    execFileAsyncMock.mockReset()
    execFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deduplicates names before deletion', async () => {
    const { killZellijSessions } = await import('./zellij-session-control')
    const result = await killZellijSessions([
      'orca-feature-abc1234',
      'orca-feature-abc1234',
      'orca-other-def5678'
    ])
    expect(result.deleted).toEqual(['orca-feature-abc1234', 'orca-other-def5678'])
    expect(execFileAsyncMock).toHaveBeenCalledTimes(2)
  })

  it('reports non-Orca names without invoking zellij for those names', async () => {
    const { killZellijSessions } = await import('./zellij-session-control')
    const result = await killZellijSessions(['bare-session', 'orca-feature-abc1234'])
    expect(result.deleted).toEqual(['orca-feature-abc1234'])
    expect(result.failed).toEqual([
      {
        name: 'bare-session',
        error: 'Refusing to kill non-Orca Zellij session: bare-session'
      }
    ])
    expect(execFileAsyncMock).toHaveBeenCalledTimes(1)
  })

  it('returns partial failures without skipping later valid names', async () => {
    execFileAsyncMock
      .mockRejectedValueOnce(new Error('first failed'))
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
    const { killZellijSessions } = await import('./zellij-session-control')
    const result = await killZellijSessions(['orca-first-abc1234', 'orca-second-def5678'])
    expect(result.deleted).toEqual(['orca-second-def5678'])
    expect(result.failed).toEqual([{ name: 'orca-first-abc1234', error: 'first failed' }])
    expect(execFileAsyncMock).toHaveBeenCalledTimes(2)
  })
})
