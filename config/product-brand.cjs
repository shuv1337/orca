// CommonJS mirror of src/shared/product-brand.ts for electron-builder, which
// cannot import the TS module. Keep these values in sync with that file.
// See docs/adr/0001-v1-preserves-orca-os-identity.md.

// User-visible product name / installer label (bundle becomes shuvorca.app).
const PRODUCT_DISPLAY_NAME = 'shuvorca'

// Packaged macOS executable name — pinned to the legacy value so the bundle is
// shuvorca.app while the binary stays Contents/MacOS/Orca and the public
// resources/darwin/bin/orca launcher keeps working (D7).
const LEGACY_PACKAGED_EXECUTABLE_NAME = 'Orca'

module.exports = { PRODUCT_DISPLAY_NAME, LEGACY_PACKAGED_EXECUTABLE_NAME }
