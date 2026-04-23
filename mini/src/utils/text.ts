import type { CatalogItem } from '../types/catalog'

export function hasContent(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizeKeyword(value: string) {
  return (value || '').trim().toLowerCase()
}

export function matchesCatalogKeyword(item: CatalogItem, keyword: string): boolean {
  if (!keyword) return true
  const kw = normalizeKeyword(keyword)
  if (!kw) return true

  if (item.search_index) {
    return item.search_index.toLowerCase().includes(kw)
  }

  const haystack = [
    item.canonical_name,
    item.display_name,
    item.chinese_name,
    item.scientific_name,
    ...(item.aliases || []),
    ...(item.search_terms || [])
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()

  return haystack.includes(kw)
}

export function buildSummary(text: string | undefined | null, maxLength = 180): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  const cut = trimmed.slice(0, maxLength)
  const lastSentence = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('. '), cut.lastIndexOf('！'))
  if (lastSentence > maxLength * 0.4) {
    return cut.slice(0, lastSentence + 1)
  }
  return cut + '…'
}

export function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)]
}
