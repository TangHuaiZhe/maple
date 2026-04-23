import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'maple-mini-favorites'

let favoriteIds: string[] = []
let hydrated = false
const listeners = new Set<() => void>()

function normalizeFavoriteIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(String).filter(Boolean))]
}

function getStoredFavorites(): string[] {
  try {
    return normalizeFavoriteIds(wx.getStorageSync(STORAGE_KEY))
  } catch {
    return []
  }
}

function ensureHydrated() {
  if (!hydrated) {
    favoriteIds = getStoredFavorites()
    hydrated = true
  }
}

function emitChange() {
  listeners.forEach(fn => fn())
}

function subscribeFavorites(listener: () => void) {
  ensureHydrated()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getFavoritesSnapshot(): string[] {
  ensureHydrated()
  return favoriteIds
}

function setFavoriteIdsState(ids: string[]) {
  favoriteIds = ids
  try { wx.setStorageSync(STORAGE_KEY, ids) } catch {}
  emitChange()
}

export function useFavorites() {
  const ids = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot)

  return {
    favoriteIds: ids,
    isFavorite(id: string) {
      return ids.includes(String(id))
    },
    toggleFavorite(id: string) {
      const sid = String(id)
      const next = ids.includes(sid)
        ? ids.filter(i => i !== sid)
        : [...ids, sid]
      setFavoriteIdsState(next)
    }
  }
}
