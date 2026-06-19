import { describe, expect, it } from 'vitest'

import {
  applyProductBrand,
  COMPANION_APP_NAME,
  FORK_GITHUB_REPO_SLUG,
  PRODUCT_DISPLAY_NAME
} from './product-brand'

describe('mobile product brand', () => {
  it('exposes the fork display name and repo slug', () => {
    expect(PRODUCT_DISPLAY_NAME).toBe('shuvorca')
    expect(COMPANION_APP_NAME).toBe('shuvorca')
    expect(FORK_GITHUB_REPO_SLUG).toBe('shuv1337/orca')
  })

  it('rebrands the standalone brand word', () => {
    expect(applyProductBrand('Open Orca desktop')).toBe('Open shuvorca desktop')
  })

  it('rebrands "Orca Mobile" (no D4 exemption on the fork)', () => {
    expect(applyProductBrand('Update Orca Mobile')).toBe('Update shuvorca Mobile')
  })

  it('maps the curated worktree and plural exceptions', () => {
    expect(applyProductBrand('Non-Orca worktrees')).toBe('Other worktrees')
    expect(applyProductBrand('Orcas')).toBe('shuvorca')
  })

  it('leaves identifiers and unrelated strings untouched', () => {
    expect(applyProductBrand('stablyai/orca')).toBe('stablyai/orca')
    expect(applyProductBrand('orca://pair')).toBe('orca://pair')
    expect(applyProductBrand('no brand here')).toBe('no brand here')
  })
})
