export type Locale = 'zh' | 'en'

export type CoverSource = 'RHS' | 'Mr Maple' | 'Herter' | 'NCSU' | 'No Image'

export interface CatalogItem {
  id: string
  canonical_name: string
  display_name: string
  chinese_name?: string | null
  scientific_name?: string | null
  species?: string | null
  top_category?: string | null
  web_group?: string | null
  book_groups?: string[]
  color_groups?: string[]
  aliases?: string[]
  search_terms?: string[]
  search_index?: string
  preferred_description?: string
  cover_path?: string | null
  cover_source?: CoverSource
  image_count: number
  source_count: number
  has_web?: boolean
  has_rhs?: boolean
  has_mrmaple?: boolean
  has_herter?: boolean
  has_ncsu?: boolean
  award_group?: string | null
  is_new_discovery?: boolean
  discovery_hidden?: boolean
  discovery_source?: string | null
}

export interface MetaData {
  generated_at: string
  counts: {
    cultivars: number
    catalog: number
    awards: number
  }
  categories: {
    top_categories: string[]
    web_groups: string[]
    cover_sources: string[]
  }
  locales: Locale[]
  datasets: {
    catalog: string
    details_dir: string
    merged: string
    awards: string
    meta: string
  }
}
