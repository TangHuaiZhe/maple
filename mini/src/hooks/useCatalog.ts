import { useState, useEffect } from 'react'
import type { CatalogItem, MetaData } from '../types/catalog'
import { fetchCatalog, fetchMeta, getCachedCatalog, getCachedMeta } from '../services/catalog'

export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[]>(() => getCachedCatalog() || [])
  const [meta, setMeta] = useState<MetaData | null>(() => getCachedMeta())
  const [loading, setLoading] = useState(!getCachedCatalog())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    Promise.all([fetchCatalog(), fetchMeta()])
      .then(([catalogData, metaData]) => {
        if (!mounted) return
        setItems(catalogData)
        setMeta(metaData)
        setLoading(false)
      })
      .catch(err => {
        if (!mounted) return
        setError(err?.message || 'Unknown error')
        setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  return { items, meta, loading, error }
}
