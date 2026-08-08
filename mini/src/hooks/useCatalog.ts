import { useState, useEffect } from 'react'
import type { CatalogItem, MetaData, ThumbnailManifest } from '../types/catalog'
import {
  fetchCatalog,
  fetchMeta,
  fetchThumbnailManifest,
  getCachedCatalog,
  getCachedMeta,
  getCachedThumbnailManifest
} from '../services/catalog'

export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[]>(() => getCachedCatalog() || [])
  const [meta, setMeta] = useState<MetaData | null>(() => getCachedMeta())
  const [thumbnailManifest, setThumbnailManifest] = useState<ThumbnailManifest>(() => getCachedThumbnailManifest() || {})
  const [loading, setLoading] = useState(!getCachedCatalog())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    Promise.all([fetchCatalog(), fetchMeta(), fetchThumbnailManifest()])
      .then(([catalogData, metaData, thumbnailData]) => {
        if (!mounted) return
        setItems(catalogData)
        setMeta(metaData)
        setThumbnailManifest(thumbnailData)
        setLoading(false)
      })
      .catch(err => {
        if (!mounted) return
        setError(err?.message || 'Unknown error')
        setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  return { items, meta, thumbnailManifest, loading, error }
}
