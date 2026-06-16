import { afterEach, describe, expect, it, vi } from 'vitest'
import { printHelp } from './help'

function withPlatform<T>(platform: NodeJS.Platform, fn: () => T): T {
  const original = process.platform
  Object.defineProperty(process, 'platform', { configurable: true, value: platform })
  try {
    return fn()
  } finally {
    Object.defineProperty(process, 'platform', { configurable: true, value: original })
  }
}

function captureRootHelp(platform: NodeJS.Platform): string {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  withPlatform(platform, () => printHelp([]))
  const output = logSpy.mock.calls.map((call) => call[0]).join('\n')
  logSpy.mockRestore()
  return output
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('brandHelp via printHelp', () => {
  it('rewrites the Linux command only in command positions', () => {
    const output = captureRootHelp('linux')
    // Command invocations resolve to the Linux binary name.
    expect(output).toContain('$ orca-ide open')
    expect(output).toContain('Usage: orca-ide <command>')
    // Selector values and URL schemes are NOT commands and must stay `orca`.
    expect(output).toContain('--repo name:orca ')
    expect(output).toContain('orca://pair')
    // The Linux binary name itself must not be double-rewritten.
    expect(output).not.toContain('orca-ide-ide')
  })

  it('keeps the macOS command as orca and brands the product name', () => {
    const output = captureRootHelp('darwin')
    expect(output).toContain('$ orca open')
    // Product-name prose is branded regardless of platform.
    expect(output).toContain('running shuvorca runtime')
    expect(output).not.toMatch(/\bOrca\b/)
  })
})
