import type { CatalogItem } from '../types/catalog'

export const DISCOVERY_VISIBILITY_STORAGE_KEY = 'maple-show-discovery-cultivars'

export function isDiscoveryHidden(item: CatalogItem): boolean {
  return Boolean(item.discovery_hidden)
}

export function filterDiscoveryItems(items: CatalogItem[], showDiscoveryCultivars: boolean): CatalogItem[] {
  if (showDiscoveryCultivars) {
    return items
  }
  return items.filter(item => !isDiscoveryHidden(item))
}
