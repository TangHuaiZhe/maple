import type { CatalogItem } from './catalog'

export interface DetailImages {
  count?: number
  public_count?: number
  public_cover_path?: string | null
  public_paths?: string[]
}

export interface DetailDimensions {
  height?: string
  spread?: string
  time_to_full_height?: string
}

export interface DetailGrowingConditions {
  hardiness?: string
  sunlight?: string
  soil_type?: string
  aspect?: string
  moisture?: string
  ph?: string
  exposure?: string
}

export interface DetailAttributes {
  plant_type?: string
  habit?: string
  foliage?: string
  suggested_uses?: string
  hort_group_description?: string
}

export interface DetailRhs {
  rhs_id?: number
  rhs_url?: string
  botanical_name?: string
  description?: string
  dimensions?: DetailDimensions
  growing_conditions?: DetailGrowingConditions
  attributes?: DetailAttributes
}

export interface CultivarDetail extends CatalogItem {
  images: DetailImages
  descriptions?: {
    preferred?: string
  }
  descriptions_zh?: {
    preferred?: string
  }
  rhs?: DetailRhs
  rhs_zh?: Partial<DetailRhs>
  aliases?: string[]
  search_terms?: string[]
  sources?: Array<{
    source?: string
    title?: string
    name?: string
    detail_url?: string
    description?: string
  }>
}
