import { useState, useEffect } from 'react'
import type { CultivarDetail } from '../types/detail'
import { fetchCultivarDetail, getCachedCultivarDetail } from '../services/cultivar'

export function useCultivarDetail(id?: string) {
  const [detail, setDetail] = useState<CultivarDetail | null>(() =>
    id ? getCachedCultivarDetail(id) : null
  )
  const [loading, setLoading] = useState(!detail && !!id)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let mounted = true

    fetchCultivarDetail(id)
      .then(data => {
        if (!mounted) return
        setDetail(data)
        setLoading(false)
      })
      .catch(err => {
        if (!mounted) return
        setError(err?.message || 'Unknown error')
        setLoading(false)
      })

    return () => { mounted = false }
  }, [id])

  return { detail, loading, error }
}
