import type { CultivarDetail } from '../types/detail'
import { peekCachedJson, requestJsonCached } from './api'

export function fetchCultivarDetail(id: string) {
  return requestJsonCached<CultivarDetail>(`/data/details/${id}.json`)
}

export function getCachedCultivarDetail(id: string) {
  return peekCachedJson<CultivarDetail>(`/data/details/${id}.json`)
}
