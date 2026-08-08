import type { CatalogItem } from '../types/catalog'
import type { ThumbnailManifest } from '../types/catalog'
import type { CultivarDetail } from '../types/detail'
import { resolveAssetUrl } from '../services/api'

function normalizeManifestPath(path: string) {
  const pathname = path.split(/[?#]/)[0]
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

export function getCardCover(item: CatalogItem, thumbnailManifest: ThumbnailManifest = {}): string {
  const sourcePath = item.cover_path ? normalizeManifestPath(item.cover_path) : ''
  const thumbnailPath = sourcePath ? thumbnailManifest[sourcePath]?.['480'] : ''
  return resolveAssetUrl(thumbnailPath || item.cover_path)
}

export function getGalleryImages(detail: CultivarDetail): string[] {
  const paths = detail.images?.public_paths || []
  return paths.map(p => resolveAssetUrl(p)).filter(Boolean)
}
