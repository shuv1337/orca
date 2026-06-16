import { describe, expect, it } from 'vitest'
import { getLocalExecutionHostLabel } from '../../../../shared/execution-host'
import { getProviderAccountScope, getProviderRateLimitScope } from './provider-account-scope'

// Why: the local label is OS-derived now, so assert against the helper output
// instead of a hardcoded "Local Mac" that only holds on macOS.
const LOCAL_LABEL = getLocalExecutionHostLabel()

describe('getProviderAccountScope', () => {
  it('describes provider accounts as client-owned without an active runtime', () => {
    expect(getProviderAccountScope({ activeRuntimeEnvironmentId: null })).toEqual({
      label: LOCAL_LABEL,
      description:
        'Credentials and account checks for this provider are owned by this desktop client. Use Settings > Remote shuvorca Servers > Advanced to edit server-owned credentials.'
    })
  })

  it('describes provider accounts as remote-server-owned with an active runtime', () => {
    expect(getProviderAccountScope({ activeRuntimeEnvironmentId: ' env-1 ' })).toEqual({
      label: 'Remote server: env-1',
      description:
        'Credentials and account checks for this provider are owned by this remote server. Use Settings > Remote shuvorca Servers > Advanced to edit another default runtime scope.'
    })
  })

  it('describes provider API budgets as host-scoped', () => {
    expect(getProviderRateLimitScope({ activeRuntimeEnvironmentId: null }, 'GitHub')).toEqual({
      label: LOCAL_LABEL,
      description:
        'GitHub API budget is fetched from the CLI on this desktop client. Use Settings > Remote shuvorca Servers > Advanced to view server-owned budgets.'
    })
    expect(getProviderRateLimitScope({ activeRuntimeEnvironmentId: ' env-1 ' }, 'GitLab')).toEqual({
      label: 'Remote server: env-1',
      description:
        'GitLab API budget is fetched from the CLI on this remote server. Use Settings > Remote shuvorca Servers > Advanced to view another default runtime budget.'
    })
  })
})
