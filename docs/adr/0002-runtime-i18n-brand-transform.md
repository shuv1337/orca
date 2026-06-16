# Brand reaches i18n strings via a runtime transform, not catalog replacement

**Status:** accepted

The user-visible brand (`Orca` → `shuvorca`) is applied to localized strings at
runtime by a whole-word `\bOrca\b → shuvorca` transform inserted at the two
translate seams — renderer `translate()` (`src/renderer/src/i18n/i18n.ts`) and
main `translateMain()` (`src/main/i18n/main-i18n.ts`), right beside the existing
`pseudoLocalizeString` post-processing — instead of editing the ~336×5 `Orca`
occurrences across `en/es/ja/zh/ko.json`. We chose this because the locale files
are the worst upstream-merge-conflict surface in the fork, and a runtime
transform keeps them byte-identical to upstream (zero locale merge churn) while
covering all five languages and any future upstream strings automatically. The
capital-`O` word boundary intentionally skips internal identifiers
(`onorca.dev`, `orca-first`, `ORCA_*`, `orca_disabled`).

## Considered options

- **Static catalog replacement** (the original plan) — rejected: ~336×5 edits,
  a permanent merge-conflict surface on every upstream string change, and risk
  of corrupting enum/data values.

## Consequences

- The locale JSON still reads `Orca` while the UI renders `shuvorca`; this is
  intentional and the localization verifier/coverage gates stay green with no
  churn.
- A small **curated-exception list** is maintained for strings needing human
  judgment, implemented in `applyProductBrand` via a `\bOrca\b(?! Mobile)`
  negative lookahead plus explicit replacements:
  - **"Orca Mobile"** is preserved verbatim (not rebranded to "shuvorca Mobile")
    because the fork ships no mobile app — the distinct name signals the separate
    upstream product (D4). An earlier idea to append "(upstream)" was dropped: it
    read poorly in nav buttons and the value-based transform can't tell a button
    from a description.
  - `Non-Orca worktrees` → `Other worktrees`.
  - Spanish `Orcas` (a mistranslation of the singular brand) → the brand.
- Both translate seams (renderer + main) must apply the transform; any new
  translate entry point must route through them.
