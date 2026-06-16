import { describe, expect, it } from 'vitest'
import { translate } from './i18n'
import { PRODUCT_DISPLAY_NAME } from '../../../shared/product-brand'

describe('translate brand seam', () => {
  it('brands the product name in the template', () => {
    expect(translate('__missing.brand.key', 'Welcome to Orca')).toBe(
      `Welcome to ${PRODUCT_DISPLAY_NAME}`
    )
  })

  it('does not brand interpolated user data', () => {
    // Why: a branch named `fix-Orca` must survive verbatim — branding the
    // resolved string (instead of the template) would corrupt it.
    expect(translate('__missing.interp.key', 'Deleted "{{value0}}".', { value0: 'fix-Orca' })).toBe(
      'Deleted "fix-Orca".'
    )
  })
})
