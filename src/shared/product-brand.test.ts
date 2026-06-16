import { describe, expect, it } from 'vitest'
import { applyProductBrand, brandResourceTree, PRODUCT_DISPLAY_NAME } from './product-brand'

describe('applyProductBrand', () => {
  it('brands the standalone product name', () => {
    expect(applyProductBrand('Welcome to Orca')).toBe(`Welcome to ${PRODUCT_DISPLAY_NAME}`)
  })

  it('leaves identifiers and env vars untouched', () => {
    expect(applyProductBrand('onorca.dev ORCA_PANE_KEY orca-ide')).toBe(
      'onorca.dev ORCA_PANE_KEY orca-ide'
    )
  })

  it('preserves the Orca Mobile upstream brand', () => {
    expect(applyProductBrand('Open Orca Mobile')).toBe('Open Orca Mobile')
  })
})

describe('brandResourceTree', () => {
  it('brands every string leaf without mutating shape', () => {
    const input = {
      title: 'Orca',
      nested: { body: 'Run Orca now', list: ['Orca one', 'no brand here'] }
    }
    expect(brandResourceTree(input)).toEqual({
      title: PRODUCT_DISPLAY_NAME,
      nested: {
        body: `Run ${PRODUCT_DISPLAY_NAME} now`,
        list: [`${PRODUCT_DISPLAY_NAME} one`, 'no brand here']
      }
    })
  })

  it('returns a fresh tree so the source catalog stays byte-identical', () => {
    const input = { title: 'Orca' }
    const result = brandResourceTree(input)
    expect(result).not.toBe(input)
    expect(input.title).toBe('Orca')
  })
})
