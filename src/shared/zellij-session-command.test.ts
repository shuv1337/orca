import { describe, expect, it } from 'vitest'
import {
  buildZellijSessionName,
  filterZellijPaneEnv,
  kdlStringEscape,
  shouldWrapWithZellij,
  wrapLaunchCommandWithZellij
} from './zellij-session-command'

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'
const WORKTREE_ID = 'repo::/home/user/Feature Branch'

describe('zellij session command', () => {
  it('builds stable readable session names from durable worktree and leaf identity', () => {
    const first = buildZellijSessionName({ worktreeId: WORKTREE_ID, stableLeafId: LEAF_A })
    const second = buildZellijSessionName({ worktreeId: WORKTREE_ID, stableLeafId: LEAF_A })

    expect(first).toBe(second)
    expect(first).toMatch(/^orca-feature-branch-[a-z0-9]+$/)
  })

  it('keeps split panes distinct by stable leaf id', () => {
    const first = buildZellijSessionName({ worktreeId: WORKTREE_ID, stableLeafId: LEAF_A })
    const second = buildZellijSessionName({ worktreeId: WORKTREE_ID, stableLeafId: LEAF_B })

    expect(first).not.toBe(second)
  })

  it('detects existing Zellij nesting even when ZELLIJ is 0', () => {
    expect(shouldWrapWithZellij({})).toBe(true)
    expect(shouldWrapWithZellij({ ZELLIJ: '0' })).toBe(false)
    expect(shouldWrapWithZellij({ ZELLIJ_SESSION_NAME: 'outer' })).toBe(false)
  })

  it('filters pane env to the explicit Orca allowlist', () => {
    expect(
      filterZellijPaneEnv({
        ORCA_PANE_KEY: 'tab:leaf',
        ORCA_AGENT_HOOK_TOKEN: 'secret',
        PATH: '/tmp/bin',
        HOME: '/home/user',
        ORCA_UNKNOWN: 'ignored'
      })
    ).toEqual({
      ORCA_PANE_KEY: 'tab:leaf',
      ORCA_AGENT_HOOK_TOKEN: 'secret'
    })
  })

  it('escapes KDL string content separately from shell quoting', () => {
    expect(kdlStringEscape('a"b\\c\nnext')).toBe('"a\\"b\\\\c\\nnext"')
  })

  it('stages the layout in a temp .kdl file and creates via --new-session-with-layout', () => {
    const command = wrapLaunchCommandWithZellij({
      originalCommand: "claude 'say hi'",
      sessionName: 'orca-feature-abc123',
      cwd: '/repo/feature',
      env: {
        ORCA_PANE_KEY: 'tab-1:11111111-1111-4111-8111-111111111111',
        ORCA_AGENT_HOOK_TOKEN: "tok'en"
      },
      availability: 'known-present'
    })

    // Why: zellij 0.44 only honors a custom layout on create through `-n <file>`,
    // so the create branch must stage the KDL in a real .kdl path, not pass it
    // inline via --layout-string (which errors with "session not found").
    expect(command).toContain("zellij attach 'orca-feature-abc123' 2>/dev/null || {")
    expect(command).toContain("d=$(mktemp -d) && printf '%s' ")
    expect(command).toContain('> "$d/layout.kdl" &&')
    expect(command).toContain('zellij -s \'orca-feature-abc123\' -n "$d/layout.kdl"')
    expect(command).not.toContain('--layout-string')
    // Single-line KDL keeps the typed command newline-free.
    expect(command).not.toContain('\n')
    expect(command).toContain('pane cwd="/repo/feature" command="sh"')
    expect(command).toContain('export ORCA_PANE_KEY=')
    expect(command).toContain('tab-1:11111111-1111-4111-8111-111111111111')
    expect(command).toContain('export ORCA_AGENT_HOOK_TOKEN=')
    expect(command).toContain('tok')
    expect(command).toContain('en')
    expect(command).toContain("exec claude '\\''say hi'\\''")
    expect(command).not.toContain("else claude 'say hi'")
  })

  it('guards remote commands so only a missing binary falls back to the original command', () => {
    const command = wrapLaunchCommandWithZellij({
      originalCommand: 'codex resume abc',
      sessionName: 'orca-feature-abc123',
      cwd: '/repo',
      env: null,
      availability: 'guarded'
    })

    expect(command).toMatch(/^if command -v zellij >\/dev\/null 2>&1; then /)
    expect(command).toContain(
      " zellij attach 'orca-feature-abc123' 2>/dev/null || { d=$(mktemp -d) &&"
    )
    expect(command).toContain('zellij -s \'orca-feature-abc123\' -n "$d/layout.kdl"')
    expect(command).toContain('; else codex resume abc; fi')
  })

  it('builds blank-terminal attach commands without a fallback command', () => {
    expect(
      wrapLaunchCommandWithZellij({
        sessionName: 'orca-feature-abc123',
        availability: 'known-present'
      })
    ).toBe("zellij attach -c 'orca-feature-abc123'")

    expect(
      wrapLaunchCommandWithZellij({
        sessionName: 'orca-feature-abc123',
        availability: 'guarded'
      })
    ).toBe("if command -v zellij >/dev/null 2>&1; then zellij attach -c 'orca-feature-abc123'; fi")
  })
})
