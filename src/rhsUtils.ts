import { hasContent, uniqueValues } from "./dataUtils";
import type { CultivarRecord, Locale, RhsRecord } from "./types";

export function getSizeSummary(rhs: RhsRecord | undefined, rhsEnglish: RhsRecord | undefined, locale: Locale = "zh") {
  if (!rhs) return "";

  const height = getLocalizedRhsValue(locale, rhs.dimensions?.height, rhsEnglish?.dimensions?.height, { measurement: true });
  const spread = getLocalizedRhsValue(locale, rhs.dimensions?.spread, rhsEnglish?.dimensions?.spread, { measurement: true });
  const timeToFullHeight = getLocalizedRhsValue(locale, rhs.dimensions?.time_to_full_height, rhsEnglish?.dimensions?.time_to_full_height, { measurement: true });
  const parts = [];

  if (height) {
    parts.push(locale === "en" ? `H ${height}` : `高 ${height}`);
  }

  if (spread) {
    parts.push(locale === "en" ? `W ${spread}` : `冠幅 ${spread}`);
  }

  if (timeToFullHeight) {
    parts.push(locale === "en" ? `${timeToFullHeight} to mature size` : `${timeToFullHeight} 达到成株尺寸`);
  }

  return parts.join(" · ");
}

export function getDetailTraits(item: CultivarRecord, locale: Locale = "zh", rhsLabels = RHS_FIELD_LABELS[locale] || RHS_FIELD_LABELS.zh) {
  const rhs = item?.rhs;
  const rhsEnglish = item?.rhs_en || item?.rhs;

  if (!rhs) return [];

  return uniqueValues([
    getLocalizedRhsValue(locale, rhs.attributes?.habit, rhsEnglish?.attributes?.habit) ? `${rhsLabels.habit}：${getLocalizedRhsValue(locale, rhs.attributes?.habit, rhsEnglish?.attributes?.habit)}` : "",
    getLocalizedRhsValue(locale, rhs.attributes?.plant_type, rhsEnglish?.attributes?.plant_type) ? `${rhsLabels.plantType}：${getLocalizedRhsValue(locale, rhs.attributes?.plant_type, rhsEnglish?.attributes?.plant_type)}` : "",
    getLocalizedRhsValue(locale, rhs.attributes?.foliage, rhsEnglish?.attributes?.foliage) ? `${rhsLabels.foliage}：${getLocalizedRhsValue(locale, rhs.attributes?.foliage, rhsEnglish?.attributes?.foliage)}` : "",
    getSizeSummary(rhs, rhsEnglish, locale),
  ]);
}

export function getChineseAliases(item: CultivarRecord) {
  return uniqueValues(
    [...(item.aliases || []), ...(item.search_terms || [])]
      .map((value) => (typeof value === "string" ? value.replace(/\s+/g, "").trim() : ""))
      .filter((value) => value && /[\u4e00-\u9fff]/.test(value) && !/[A-Za-z]/.test(value))
      .filter((value) => value !== item.chinese_name),
  );
}

export const RHS_VALUE_TRANSLATIONS: Record<string, string> = {
  Architectural: "造型性强",
  Acid: "酸性",
  Bushy: "丛生型",
  Chalk: "白垩土",
  "City/Courtyard Gardens": "城市/庭院花园",
  Climbing: "攀援型",
  Clay: "黏土",
  Columnar: "柱形",
  Compact: "紧凑型",
  "Cottage/Informal Garden": "乡村风或自然式花园",
  Deciduous: "落叶",
  "East-facing": "朝东",
  Evergreen: "常绿",
  "Full Sun": "全日照",
  Herbaceous: "草本",
  "Low Maintenance": "养护需求低",
  Loam: "壤土",
  "Moist but well-drained": "湿润但排水良好",
  Rounded: "圆头形",
  "Partial Shade": "半阴",
  "Patio/Container Plants": "露台/容器栽培",
  "Rock Garden": "岩石园",
  Sand: "沙土",
  "Semi-deciduous": "半落叶",
  "Semi-evergreen": "半常绿",
  Sheltered: "避风",
  Shrub: "灌木",
  Spreading: "开展型",
  Tree: "乔木",
  Upright: "直立型",
  "Vase-shaped": "花瓶形",
  "West-facing": "朝西",
  Weeping: "垂枝型",
};

export const RHS_FIELD_LABELS = {
  zh: {
    chineseName: "中文名",
    botanicalName: "RHS 学名",
    height: "成年高度",
    spread: "冠幅",
    timeToFullHeight: "达到成年尺寸",
    hardiness: "耐寒性",
    sunlight: "光照",
    soilType: "土壤",
    aspect: "朝向",
    moisture: "水分",
    ph: "酸碱度",
    exposure: "环境暴露",
    cultivation: "栽培建议",
    pruning: "修剪",
    propagation: "繁殖",
    pest: "虫害风险",
    disease: "病害风险",
    suggestedUses: "建议用途",
    habit: "株型",
    plantType: "植物类型",
    foliage: "落叶/常绿",
    dimensionsHeading: "RHS 尺寸与环境",
    careHeading: "RHS 养护与风险",
    note: "RHS 数据来自 Royal Horticultural Society 公开植物详情页，用于补充尺寸、种植条件和养护信息。",
  },
  en: {
    chineseName: "Chinese Name",
    botanicalName: "RHS Botanical Name",
    height: "Height",
    spread: "Spread",
    timeToFullHeight: "Time to Full Height",
    hardiness: "Hardiness",
    sunlight: "Sunlight",
    soilType: "Soil",
    aspect: "Aspect",
    moisture: "Moisture",
    ph: "pH",
    exposure: "Exposure",
    cultivation: "Cultivation",
    pruning: "Pruning",
    propagation: "Propagation",
    pest: "Pest Risk",
    disease: "Disease Risk",
    suggestedUses: "Suggested Uses",
    habit: "Habit",
    plantType: "Plant Type",
    foliage: "Foliage",
    dimensionsHeading: "RHS Size & Conditions",
    careHeading: "RHS Care & Risks",
    note: "RHS data comes from the Royal Horticultural Society plant detail pages and supplements size, growing conditions, and care information.",
  },
};

export function translateRhsValue(value: unknown) {
  if (!hasContent(value) || typeof value !== "string") {
    return value;
  }

  if (/[\u4e00-\u9fff]/.test(value)) {
    return value;
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => RHS_VALUE_TRANSLATIONS[part] || part)
    .join("、");
}

export function translateRhsMeasurement(value: unknown) {
  if (!hasContent(value) || typeof value !== "string") {
    return value;
  }

  if (/[\u4e00-\u9fff]/.test(value)) {
    return value;
  }

  return value
    .replace(/\bmetres?\b/gi, "米")
    .replace(/\byears?\b/gi, "年")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

export function getLocalizedRhsValue(locale: Locale, localizedValue: unknown, englishValue: unknown, { measurement = false }: { measurement?: boolean } = {}) {
  const fallbackValue = hasContent(englishValue) ? englishValue : localizedValue;

  if (locale === "en") {
    return fallbackValue;
  }

  const baseValue = hasContent(localizedValue) ? localizedValue : fallbackValue;

  if (measurement) {
    return translateRhsMeasurement(baseValue);
  }

  return translateRhsValue(baseValue);
}
