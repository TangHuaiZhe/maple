import type { CultivarDetail } from '../types/detail'
import { hasContent } from './text'

export interface InfoRow {
  label: string
  value: string
}

export interface DetailInfoLabels {
  nameLabel: string
  chineseNameLabel: string
  japaneseNameLabel: string
  scientificNameLabel: string
  speciesLabel: string
  categoryLabel: string
  groupLabel: string
  imageCountLabel: string
  sourceCountLabel: string
  botanicalNameLabel: string
  sizeLabel: string
  timeToFullLabel: string
  hardinessLabel: string
  sunlightLabel: string
  soilTypeLabel: string
  aspectLabel: string
  moistureLabel: string
  phLabel: string
  exposureLabel: string
  plantTypeLabel: string
  habitLabel: string
  foliageLabel: string
  suggestedUsesLabel: string
}

function formatSize(detail: CultivarDetail): string {
  const h = detail.rhs?.dimensions?.height
  const s = detail.rhs?.dimensions?.spread
  if (h && s) return `${h} × ${s}`
  return h || s || ''
}

function formatChineseAliases(detail: CultivarDetail): string {
  const aliases = (detail.aliases || []).filter(a => /[\u4e00-\u9fff]/.test(a))
  return aliases.join('、')
}

export function buildBasicInfoRows(detail: CultivarDetail, labels: DetailInfoLabels): InfoRow[] {
  const rows: [string, string | undefined | null][] = [
    [labels.nameLabel, detail.display_name],
    [labels.chineseNameLabel, detail.chinese_name || formatChineseAliases(detail)],
    [labels.japaneseNameLabel, detail.japanese_name],
    [labels.scientificNameLabel, detail.scientific_name],
    [labels.speciesLabel, detail.species],
    [labels.categoryLabel, detail.top_category],
    [labels.groupLabel, detail.web_group],
    [labels.imageCountLabel, detail.image_count > 0 ? String(detail.image_count) : undefined],
    [labels.sourceCountLabel, detail.source_count > 0 ? String(detail.source_count) : undefined],
  ]
  return rows
    .filter(([, v]) => hasContent(v))
    .map(([label, value]) => ({ label, value: value! }))
}

export function buildRhsInfoRows(detail: CultivarDetail, labels: DetailInfoLabels): InfoRow[] {
  const rhs = detail.rhs
  if (!rhs) return []

  const gc = rhs.growing_conditions
  const attr = rhs.attributes
  const rows: [string, string | undefined | null][] = [
    [labels.botanicalNameLabel, rhs.botanical_name],
    [labels.sizeLabel, formatSize(detail)],
    [labels.timeToFullLabel, rhs.dimensions?.time_to_full_height],
    [labels.hardinessLabel, gc?.hardiness],
    [labels.sunlightLabel, gc?.sunlight],
    [labels.soilTypeLabel, gc?.soil_type],
    [labels.aspectLabel, gc?.aspect],
    [labels.moistureLabel, gc?.moisture],
    [labels.phLabel, gc?.ph],
    [labels.exposureLabel, gc?.exposure],
    [labels.plantTypeLabel, attr?.plant_type],
    [labels.habitLabel, attr?.habit],
    [labels.foliageLabel, attr?.foliage],
    [labels.suggestedUsesLabel, attr?.suggested_uses],
  ]
  return rows
    .filter(([, v]) => hasContent(v))
    .map(([label, value]) => ({ label, value: value! }))
}
