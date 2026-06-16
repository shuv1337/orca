import type { SshChannelMultiplexer } from './ssh-channel-multiplexer'
import type { DetectedPort } from '../../shared/ssh-types'

const POLL_INTERVAL_MS = 3_000

type ScanHandle = {
  timer: ReturnType<typeof setInterval>
  // Why: keyed by "host:port" (not just port) so that host-distinct listeners
  // on the same port (e.g. 127.0.0.1:3000 + 0.0.0.0:3000) are tracked separately.
  previousPorts: Map<string, DetectedPort>
  // Why: ports detected on the first scan are pre-existing services (sshd, system
  // daemons) that the user didn't just start. VS Code calls these "initialCandidates"
  // and excludes them from auto-forward suggestions (Phase 3).
  initialPorts: Set<string> | null
}

export class PortScanner {
  private handles = new Map<string, ScanHandle>()

  startScanning(
    targetId: string,
    mux: SshChannelMultiplexer,
    onChanged: (targetId: string, ports: DetectedPort[], platform: string) => void
  ): void {
    this.stopScanning(targetId)

    const handle: ScanHandle = {
      timer: null!,
      previousPorts: new Map(),
      initialPorts: null
    }

    // Why: guard against overlapping scans. On slow remotes, /proc/*/fd walks
    // can take longer than POLL_INTERVAL_MS. Without this guard, setInterval
    // would stack up concurrent requests on the shared SSH multiplexer.
    let polling = false
    const poll = async (): Promise<void> => {
      if (polling) {
        return
      }
      polling = true
      try {
        const result = (await mux.request('ports.detect')) as {
          ports: DetectedPort[]
          platform: string
        }

        if (!this.handles.has(targetId)) {
          return
        }

        const currentPorts = new Map<string, DetectedPort>()
        for (const p of result.ports) {
          currentPorts.set(`${p.host}:${p.port}`, p)
        }

        if (handle.initialPorts === null) {
          handle.initialPorts = new Set(currentPorts.keys())
        }

        if (!portsEqual(handle.previousPorts, currentPorts)) {
          handle.previousPorts = currentPorts
          onChanged(targetId, result.ports, result.platform)
        } else {
          // Why: a racy /proc read on the remote can momentarily drop a port's
          // pid/processName, which portsEqual now treats as unchanged. Fold any
          // newly-resolved metadata into the baseline so a later *genuine* pid
          // change is still detected — without re-emitting on the flicker.
          mergeKnownMetadata(handle.previousPorts, currentPorts)
        }
      } catch {
        // Relay disconnected or request timed out — retry on next interval
      } finally {
        polling = false
      }
    }

    handle.timer = setInterval(() => void poll(), POLL_INTERVAL_MS)
    this.handles.set(targetId, handle)

    void poll()
  }

  getDetectedPorts(targetId: string): DetectedPort[] {
    const handle = this.handles.get(targetId)
    if (!handle) {
      return []
    }
    return Array.from(handle.previousPorts.values())
  }

  stopScanning(targetId: string): void {
    const handle = this.handles.get(targetId)
    if (!handle) {
      return
    }
    clearInterval(handle.timer)
    this.handles.delete(targetId)
  }

  dispose(): void {
    for (const [targetId] of this.handles) {
      this.stopScanning(targetId)
    }
  }
}

// Why: the remote relay derives pid/processName from a /proc inode→pid walk
// that is racy on a busy box — the same listener comes back with its pid one
// poll and `undefined` the next. Counting that as a change made the 3s poll
// re-emit `detected-ports-changed` continuously, flapping the workspace port
// UI. A field only counts as changed when *both* sides are known and differ; a
// missing value on either side is a transient read gap, not a real change.
function definiteFieldChange<T>(a: T | undefined, b: T | undefined): boolean {
  return a !== undefined && b !== undefined && a !== b
}

export function portsEqual(a: Map<string, DetectedPort>, b: Map<string, DetectedPort>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const [key, entryA] of a) {
    const entryB = b.get(key)
    if (!entryB) {
      return false
    }
    if (
      definiteFieldChange(entryA.pid, entryB.pid) ||
      definiteFieldChange(entryA.processName, entryB.processName)
    ) {
      return false
    }
  }
  return true
}

/** Fold newly-resolved pid/processName from a later poll into the baseline
 *  without emitting a change. Only fills unknown fields — never downgrades a
 *  known value back to `undefined` (that downgrade is the flicker we suppress),
 *  so a genuine pid change later still diffs against a known baseline. */
export function mergeKnownMetadata(
  baseline: Map<string, DetectedPort>,
  current: Map<string, DetectedPort>
): void {
  for (const [key, base] of baseline) {
    const cur = current.get(key)
    if (!cur) {
      continue
    }
    const pid = base.pid ?? cur.pid
    const processName = base.processName ?? cur.processName
    if (pid !== base.pid || processName !== base.processName) {
      baseline.set(key, { ...base, pid, processName })
    }
  }
}
