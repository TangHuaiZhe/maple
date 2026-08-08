import type { CatalogItem, MetaData, ThumbnailManifest } from '../types/catalog'
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

export function fetchThumbnailManifest() {
  return requestJsonCached<ThumbnailManifest>('/data/image-thumbs.json').catch(() => ({}))
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

export function getCachedThumbnailManifest() {
  return peekCachedJson<ThumbnailManifest>('/data/image-thumbs.json')
}
