import type { CatalogItem } from '../types/catalog'
import type { CultivarDetail } from '../types/detail'
import { resolveAssetUrl } from '../services/api'

export function getCardCover(item: CatalogItem): string {
  return resolveAssetUrl(item.cover_path)
}

export function getGalleryImages(detail: CultivarDetail): string[] {
  const paths = detail.images?.public_paths || []
  return paths.map(p => resolveAssetUrl(p)).filter(Boolean)
}
