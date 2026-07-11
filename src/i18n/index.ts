import { useCallback, useEffect, useState } from 'react'
import { en, type Dict } from './locales/en'
import { fr } from './locales/fr'
import { es } from './locales/es'
import { it } from './locales/it'
import { de } from './locales/de'
import { ja } from './locales/ja'
import { ko } from './locales/ko'
import { ru } from './locales/ru'
import { zhCN } from './locales/zh-CN'
import { zhTW } from './locales/zh-TW'

export type Lang = 'en' | 'fr' | 'es' | 'it' | 'de' | 'ja' | 'ko' | 'ru' | 'zh-CN' | 'zh-TW'
export type TKey = keyof Dict

const DICTS: Record<Lang, Dict> = {
  en,
  fr,
  es,
  it,
  de,
  ja,
  ko,
  ru,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}

/** Language menu, each labelled in its own language. */
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
]

const STORAGE_KEY = 'screenshot-studio:lang'

/**
 * Map a BCP-47 tag from the browser onto one of our locales.
 *
 * Chinese needs care: the script matters more than the region, so zh-Hant / zh-HK / zh-MO
 * are Traditional, and everything else under zh falls back to Simplified.
 */
export function matchLang(tag: string): Lang | null {
  const t = tag.toLowerCase()
  if (t.startsWith('zh')) {
    const traditional = /hant|tw|hk|mo/.test(t)
    return traditional ? 'zh-TW' : 'zh-CN'
  }
  const base = t.split('-')[0]
  const hit = LANGUAGES.find((l) => l.code.toLowerCase() === base)
  return hit ? hit.code : null
}

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in DICTS) return saved as Lang
  } catch {
    // Storage unavailable; fall through to the browser's preference.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const hit = matchLang(tag)
    if (hit) return hit
  }
  return 'en'
}

export function useI18n() {
  const [lang, setLangState] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: the choice just won't survive a reload.
    }
  }, [])

  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) => {
      // Fall back to English for any key a locale somehow lacks (TypeScript makes that
      // near-impossible, but a hand-edited locale file shouldn't blank the UI).
      let s: string = DICTS[lang][key] ?? en[key]
      if (params) {
        for (const [k, v] of Object.entries(params)) s = s.replace(`{{${k}}}`, String(v))
      }
      return s
    },
    [lang],
  )

  return { lang, setLang, t }
}
