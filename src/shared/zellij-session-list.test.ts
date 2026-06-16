import { describe, expect, it } from 'vitest'
import {
  isOrcaManagedZellijSessionName,
  parseZellijSessionList,
  zellijSessionNameMatchesIdentity
} from './zellij-session-list'
import { buildZellijSessionName } from './zellij-session-command'

const SAMPLE = `cua [Created 5days 18h 36m 54s ago] (EXITED - attach to resurrect)
orca [Created 12h 39m 36s ago] 
orca-dotfiles-1ggqnyf [Created 2h 55m 41s ago] (EXITED - attach to resurrect)
orca-latitudes-gateway-0te0s1u [Created 1h 15m 14s ago] `

describe('parseZellijSessionList', () => {
  it('parses names, created labels, and exited/orca flags', () => {
    const sessions = parseZellijSessionList(SAMPLE)
    expect(sessions).toHaveLength(4)

    const cua = sessions[0]
    expect(cua.name).toBe('cua')
    expect(cua.createdLabel).toBe('5days 18h 36m 54s')
    expect(cua.exited).toBe(true)
    expect(cua.orcaManaged).toBe(false)

    const bareOrca = sessions[1]
    expect(bareOrca.name).toBe('orca')
    // Why: a hand-made "orca" session is not Orca-managed; only the
    // label+hash scheme counts.
    expect(bareOrca.orcaManaged).toBe(false)
    expect(bareOrca.exited).toBe(false)

    const dotfiles = sessions[2]
    expect(dotfiles.name).toBe('orca-dotfiles-1ggqnyf')
    expect(dotfiles.orcaManaged).toBe(true)
    expect(dotfiles.exited).toBe(true)

    const gateway = sessions[3]
    expect(gateway.name).toBe('orca-latitudes-gateway-0te0s1u')
    expect(gateway.orcaManaged).toBe(true)
    expect(gateway.exited).toBe(false)
  })

  it('detects the (current) marker', () => {
    const [session] = parseZellijSessionList('orca-feature-abc1234 [Created 1m ago] (current)')
    expect(session.current).toBe(true)
  })

  it('ignores blank lines and noise', () => {
    expect(parseZellijSessionList('\n\n   \n')).toEqual([])
  })

  it('matches the deterministic Orca name scheme', () => {
    expect(isOrcaManagedZellijSessionName('orca-feature-abc1234')).toBe(true)
    expect(isOrcaManagedZellijSessionName('orca-feature-abc123')).toBe(false)
    expect(isOrcaManagedZellijSessionName('orca')).toBe(false)
    expect(isOrcaManagedZellijSessionName('feature-abc123')).toBe(false)
  })

  it('matches a session name to a pane identity', () => {
    const identity = {
      worktreeId: 'repo::/home/user/feature',
      stableLeafId: '11111111-1111-4111-8111-111111111111'
    }
    const name = buildZellijSessionName(identity)
    expect(zellijSessionNameMatchesIdentity(name, identity)).toBe(true)
    expect(zellijSessionNameMatchesIdentity('orca-other-zzz', identity)).toBe(false)
  })
})
