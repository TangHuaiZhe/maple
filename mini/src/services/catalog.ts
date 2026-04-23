import type { CatalogItem, MetaData } from '../types/catalog'
import { peekCachedJson, requestJsonCached } from './api'

export function fetchCatalog() {
  return requestJsonCached<CatalogItem[]>('/data/catalog.json')
}

export function fetchMeta() {
  return requestJsonCached<MetaData>('/data/meta.json')
}

export function fetchAwards() {
  return requestJsonCached<CatalogItem[]>('/data/awards.json')
}

export function fetchPopularIds() {
  return requestJsonCached<string[]>('/data/popular-ids.json')
}

export function getCachedPopularIds() {
  return peekCachedJson<string[]>('/data/popular-ids.json')
}

export function getCachedCatalog() {
  return peekCachedJson<CatalogItem[]>('/data/catalog.json')
}

export function getCachedMeta() {
  return peekCachedJson<MetaData>('/data/meta.json')
}

export function getCachedAwards() {
  return peekCachedJson<CatalogItem[]>('/data/awards.json')
}
