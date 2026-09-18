export type Locale = "zh" | "en";

export type LocalizedText = Record<string, string | undefined>;

export interface CultivarImages {
  public_count?: number;
  public_cover_path?: string | null;
  public_paths?: string[];
  public_rhs_paths?: string[];
  public_mrmaple_paths?: string[];
  public_herter_paths?: string[];
  public_ncsu_paths?: string[];
  public_conifer_paths?: string[];
  public_jmac_paths?: string[];
  public_user_paths?: string[];
}

export interface RhsDimensions {
  height?: string;
  spread?: string;
  time_to_full_height?: string;
}

export interface RhsAttributes {
  habit?: string;
  plant_type?: string;
  foliage?: string;
}

export interface RhsRecord {
  description?: string;
  dimensions?: RhsDimensions;
  attributes?: RhsAttributes;
  [key: string]: unknown;
}

export interface CultivarSource {
  description?: string;
  [key: string]: unknown;
}

export interface CultivarRecord {
  id: string;
  canonical_name?: string | null;
  display_name?: string | null;
  chinese_name?: string | null;
  japanese_name?: string | null;
  scientific_name?: string | null;
  species?: string | null;
  top_category?: string | null;
  web_group?: string | null;
  cover_path?: string | null;
  cover_source?: string | null;
  selected_cover_path?: string | null;
  preferred_description?: string | null;
  aliases?: string[];
  search_terms?: string[];
  search_index?: string | null;
  book_groups?: string[];
  color_groups?: string[];
  sources?: CultivarSource[];
  images?: CultivarImages;
  descriptions?: LocalizedText;
  descriptions_zh?: LocalizedText;
  descriptions_en?: LocalizedText;
  rhs?: RhsRecord;
  rhs_zh?: RhsRecord;
  rhs_en?: RhsRecord;
  mrmaple?: { products?: Array<{ description_text?: string }> };
  discovery_hidden?: boolean;
  award_group?: string | null;
  [key: string]: unknown;
}

export interface AwardSelection {
  id: string;
  canonical_name?: string | null;
  display_name?: string | null;
  chinese_name?: string | null;
  award_group?: string | null;
}

export type ThumbnailManifest = Record<string, Partial<Record<480 | 960, string>>>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AssetUrlOptions {
  baseUrl?: string;
  cacheBust?: string;
}

export interface DevRecordPayload {
  record?: CultivarRecord;
  error?: string;
}

export interface CodedError extends Error {
  code?: "NOT_FOUND";
}
