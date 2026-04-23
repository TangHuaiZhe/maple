import { useSyncExternalStore } from 'react'
import type { Locale } from '../types/catalog'

const STORAGE_KEY = 'maple-mini-locale'

let localeState: Locale = 'zh'
let localeHydrated = false
const listeners = new Set<() => void>()

function getStoredLocale(): Locale {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {}
  return 'zh'
}

function ensureHydrated() {
  if (!localeHydrated) {
    localeState = getStoredLocale()
    localeHydrated = true
  }
}

function emitChange() {
  listeners.forEach(fn => fn())
}

function subscribeLocale(listener: () => void) {
  ensureHydrated()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getLocaleSnapshot(): Locale {
  ensureHydrated()
  return localeState
}

function setLocaleValue(locale: Locale) {
  localeState = locale
  try { wx.setStorageSync(STORAGE_KEY, locale) } catch {}
  emitChange()
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot)

  return {
    locale,
    setLocale: setLocaleValue,
    toggleLocale() {
      setLocaleValue(locale === 'zh' ? 'en' : 'zh')
    }
  }
}
