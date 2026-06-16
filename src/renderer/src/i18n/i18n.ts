import i18next, { type i18n as I18nInstance, type TOptions } from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import es from './locales/es.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'
import { isPseudoLocalizationLocale, pseudoLocalizeString } from './pseudo-localization'
import { applyProductBrand, brandResourceTree } from '../../../shared/product-brand'
import { DEFAULT_LOCALE, resolveUiLocale } from './supported-languages'
import type { UiLanguage } from '../../../shared/ui-language'

export const i18n: I18nInstance = i18next.createInstance()

void i18n.use(initReactI18next).init({
  fallbackLng: DEFAULT_LOCALE,
  lng: DEFAULT_LOCALE,
  // Why: brand templates at load time (ADR-0002) so interpolation runs on
  // already-branded strings — branding the resolved output would also rewrite
  // user-controlled interpolation values like a `fix-Orca` branch name.
  resources: {
    en: {
      translation: brandResourceTree(en)
    },
    zh: {
      translation: brandResourceTree(zh)
    },
    ko: {
      translation: brandResourceTree(ko)
    },
    ja: {
      translation: brandResourceTree(ja)
    },
    es: {
      translation: brandResourceTree(es)
    }
  },
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
})

export function translate(key: string, fallback: string, options?: TOptions): string {
  // Why: brand the template/default string BEFORE interpolation (ADR-0002) so
  // the word-boundary rule never touches interpolated user data (e.g. a
  // `fix-Orca` branch name). Catalog templates are pre-branded at init; the
  // call-time fallback is branded here. Pseudo-localize last so the rule runs
  // on real text, not accented pseudo glyphs.
  const value = i18n.t(key, { defaultValue: applyProductBrand(fallback), ...options })
  return isPseudoLocalizationLocale(i18n.language) ? pseudoLocalizeString(value) : value
}

export async function setRendererUiLanguage(language: UiLanguage): Promise<void> {
  const locale = resolveUiLocale(language)
  if (i18n.language !== locale) {
    await i18n.changeLanguage(locale)
  }
}
