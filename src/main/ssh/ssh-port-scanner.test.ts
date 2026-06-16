import { describe, expect, it } from 'vitest'
import type { DetectedPort } from '../../shared/ssh-types'
import { mergeKnownMetadata, portsEqual } from './ssh-port-scanner'

function portMap(ports: DetectedPort[]): Map<string, DetectedPort> {
  const map = new Map<string, DetectedPort>()
  for (const p of ports) {
    map.set(`${p.host}:${p.port}`, p)
  }
  return map
}

describe('portsEqual', () => {
  it('treats a transient pid flicker (present -> undefined) as unchanged', () => {
    const withPid = portMap([{ host: '127.0.0.1', port: 3000, pid: 42, processName: 'node' }])
    const withoutPid = portMap([{ host: '127.0.0.1', port: 3000, processName: 'node' }])
    expect(portsEqual(withPid, withoutPid)).toBe(true)
    expect(portsEqual(withoutPid, withPid)).toBe(true)
  })

  it('treats a transient processName flicker as unchanged', () => {
    const named = portMap([{ host: '127.0.0.1', port: 3000, pid: 42, processName: 'node' }])
    const unnamed = portMap([{ host: '127.0.0.1', port: 3000, pid: 42 }])
    expect(portsEqual(named, unnamed)).toBe(true)
  })

  it('detects a genuine pid change (both known, differ)', () => {
    const a = portMap([{ host: '127.0.0.1', port: 3000, pid: 42 }])
    const b = portMap([{ host: '127.0.0.1', port: 3000, pid: 99 }])
    expect(portsEqual(a, b)).toBe(false)
  })

  it('detects a port appearing or disappearing', () => {
    const two = portMap([
      { host: '127.0.0.1', port: 3000, pid: 42 },
      { host: '127.0.0.1', port: 3001, pid: 43 }
    ])
    const one = portMap([{ host: '127.0.0.1', port: 3000, pid: 42 }])
    expect(portsEqual(two, one)).toBe(false)
    expect(portsEqual(one, two)).toBe(false)
  })

  it('distinguishes host-specific listeners on the same port', () => {
    const a = portMap([{ host: '127.0.0.1', port: 3000, pid: 42 }])
    const b = portMap([{ host: '0.0.0.0', port: 3000, pid: 42 }])
    expect(portsEqual(a, b)).toBe(false)
  })
})

describe('mergeKnownMetadata', () => {
  it('fills an unknown pid in the baseline from a later resolved poll', () => {
    const baseline = portMap([{ host: '127.0.0.1', port: 3000, processName: 'node' }])
    const resolved = portMap([{ host: '127.0.0.1', port: 3000, pid: 42, processName: 'node' }])
    mergeKnownMetadata(baseline, resolved)
    expect(baseline.get('127.0.0.1:3000')?.pid).toBe(42)
  })

  it('never downgrades a known pid back to undefined on a flickering poll', () => {
    const baseline = portMap([{ host: '127.0.0.1', port: 3000, pid: 42, processName: 'node' }])
    const flickered = portMap([{ host: '127.0.0.1', port: 3000 }])
    mergeKnownMetadata(baseline, flickered)
    expect(baseline.get('127.0.0.1:3000')?.pid).toBe(42)
    expect(baseline.get('127.0.0.1:3000')?.processName).toBe('node')
  })

  it('lets a genuine pid change still be detected after a flicker is absorbed', () => {
    // Baseline learns pid 42, a flicker poll drops it (absorbed, not emitted),
    // then a different process (pid 99) takes the port — that must read as changed.
    const baseline = portMap([{ host: '127.0.0.1', port: 3000, processName: 'node' }])
    mergeKnownMetadata(baseline, portMap([{ host: '127.0.0.1', port: 3000, pid: 42 }]))
    expect(portsEqual(baseline, portMap([{ host: '127.0.0.1', port: 3000 }]))).toBe(true)
    expect(portsEqual(baseline, portMap([{ host: '127.0.0.1', port: 3000, pid: 99 }]))).toBe(false)
  })
})
