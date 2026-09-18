import { hasContent, normalizeCultivarToken, uniqueValues } from "./dataUtils";
import type { CultivarRecord, Locale } from "./types";

const latinCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const chineseCollator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });
const DESCRIPTION_NOISE_MARKERS = [
  /pointer-events-auto/i,
  /request-WEB:/i,
  /data-testid=/i,
  /scroll-mt-\[/i,
  /NURSERY SOURCES/i,
  /USDA HARDINESS ZONE/i,
  /This chapter presents/i,
];

export function normalizeSearchText(text: string | null | undefined) {
  return (text || "").toLowerCase().trim();
}

export function isDiscoveryHiddenRecord(record: CultivarRecord | null | undefined) {
  return Boolean(record?.discovery_hidden);
}

export function getKnownCultivarTokens(item: CultivarRecord) {
  return new Set(
    [
      item.display_name,
      item.canonical_name,
      item.scientific_name,
      ...(item.aliases || []),
    ]
      .map(normalizeCultivarToken)
      .filter(Boolean),
  );
}

export function cleanDescriptionText(text: string | null | undefined, item?: CultivarRecord) {
  if (!hasContent(text)) return "";

  let cleaned = String(text)
    .replace(/\*\*/g, "")
    .replace(/\*?\]:pointer-events-auto[\s\S]*?tabindex="-1">/gi, " ")
    .replace(/data-testid="[^"]*"/gi, " ")
    .replace(/data-turn-id="[^"]*"/gi, " ")
    .replace(/data-scroll-anchor="[^"]*"/gi, " ")
    .replace(/data-turn="[^"]*"/gi, " ")
    .replace(/dir="auto"/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\b(Limited Quantities Available|Please note that your \d+-gallon tree)\b[\s\S]*$/i, " ")
    .trim();

  const structuralBreaks = [
    /\bNURSERY SOURCES\b/i,
    /\bUSDA HARDINESS ZONE\b/i,
    /\bThis chapter presents\b/i,
  ];

  structuralBreaks.forEach((pattern) => {
    const match = cleaned.match(pattern);
    if (match?.index && match.index > 180) {
      cleaned = cleaned.slice(0, match.index).trim();
    }
  });

  const knownTokens = item ? getKnownCultivarTokens(item) : new Set();
  const quotedCultivarRegex = /'([^'\n]{3,48})'/g;
  let match;

  while ((match = quotedCultivarRegex.exec(cleaned))) {
    if (match.index < 280) {
      continue;
    }

    const token = normalizeCultivarToken(match[1]);
    if (!token || knownTokens.has(token)) {
      continue;
    }

    if (/[A-Z]/.test(match[1]) && token.length > 4) {
      cleaned = cleaned.slice(0, match.index).trim();
      break;
    }
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

export function getDescriptionPenalty(text: string | null | undefined) {
  if (!hasContent(text)) {
    return 100;
  }

  let penalty = 0;
  const normalized = String(text);

  if (normalized.length > 2400) penalty += 30;
  else if (normalized.length > 1800) penalty += 22;
  else if (normalized.length > 1200) penalty += 14;
  else if (normalized.length > 700) penalty += 8;
  else if (normalized.length > 450) penalty += 3;
  else if (normalized.length >= 120 && normalized.length <= 320) penalty -= 2;

  DESCRIPTION_NOISE_MARKERS.forEach((pattern) => {
    if (pattern.test(normalized)) penalty += 8;
  });

  if ((normalized.match(/'[^']{3,40}'/g) || []).length > 8) {
    penalty += 4;
  }

  if (/[A-Za-z]/.test(normalized) && /[\u4e00-\u9fff]/.test(normalized) && normalized.length > 800) {
    penalty += 3;
  }

  return penalty;
}

export function buildDescriptionPreview(text: string | null | undefined, locale: Locale = "zh", maxChars?: number) {
  if (!hasContent(text)) {
    return "";
  }

  const normalized = String(text).replace(/\s+/g, " ").trim();
  const limit = maxChars ?? (locale === "en" ? 420 : 240);

  if (normalized.length <= limit) {
    return normalized;
  }

  const sentenceParts = normalized.match(/[^。！？.!?]+[。！？.!?]?/g) || [normalized];
  let preview = "";

  for (const part of sentenceParts) {
    const candidate = `${preview}${part}`.trim();
    if (candidate.length > limit && preview) {
      break;
    }
    preview = candidate;
    if (preview.length >= Math.floor(limit * 0.72)) {
      break;
    }
  }

  const fallback = normalized.slice(0, limit).trim();
  const result = preview || fallback;
  return result.length < normalized.length ? `${result}...` : result;
}

export function getPreferredDescription(item: CultivarRecord, locale: Locale = "zh") {
  const descriptions = locale === "en" ? (item.descriptions_en || item.descriptions) : item.descriptions;
  const rhs = locale === "en" ? (item.rhs_en || item.rhs) : item.rhs;
  const sourceDescriptions = (item.sources || []).map((source) => source.description).filter((value): value is string => typeof value === "string" && hasContent(value));
  const localizedSourceDescriptions = locale === "en"
    ? [
        ...sourceDescriptions.filter((value) => !/[\u4e00-\u9fff]/.test(value)),
        ...sourceDescriptions.filter((value) => /[\u4e00-\u9fff]/.test(value)),
      ]
    : [
        ...sourceDescriptions.filter((value) => /[\u4e00-\u9fff]/.test(value)),
        ...sourceDescriptions.filter((value) => !/[\u4e00-\u9fff]/.test(value)),
      ];

  const candidates = [
    { source: "preferred", weight: 7, text: item.preferred_description },
    { source: "descriptions", weight: 6, text: descriptions?.preferred },
    { source: "rhs", weight: 5, text: rhs?.description },
    ...((item.mrmaple?.products || []).map((product) => ({ source: "mrmaple", weight: 3, text: product.description_text }))),
    ...localizedSourceDescriptions.map((text) => ({ source: "source", weight: 2, text })),
  ]
    .map((candidate) => ({
      ...candidate,
      text: cleanDescriptionText(candidate.text, item),
    }))
    .filter((candidate) => hasContent(candidate.text))
    .map((candidate) => ({
      ...candidate,
      score: candidate.weight - getDescriptionPenalty(candidate.text),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.text || "";
}

export function getEditorialCover(item: CultivarRecord) {
  if (item.cover_path) {
    return item.cover_path;
  }

  return uniqueValues([
    item.images?.public_cover_path,
    ...(item.images?.public_rhs_paths || []),
    ...(item.images?.public_mrmaple_paths || []),
    ...(item.images?.public_herter_paths || []),
    ...(item.images?.public_ncsu_paths || []),
    ...(item.images?.public_conifer_paths || []),
    ...(item.images?.public_jmac_paths || []),
  ])[0] || null;
}

export function getDetailCover(item: CultivarRecord) {
  return item.images?.public_cover_path || getEditorialCover(item);
}

export function getVisibleImagePaths(item: CultivarRecord | null | undefined): string[] {
  return uniqueValues([
    ...(item?.images?.public_rhs_paths || []),
    ...(item?.images?.public_mrmaple_paths || []),
    ...(item?.images?.public_herter_paths || []),
    ...(item?.images?.public_ncsu_paths || []),
    ...(item?.images?.public_conifer_paths || []),
    ...(item?.images?.public_jmac_paths || []),
    ...(item?.images?.public_user_paths || []),
  ]);
}

export function getVisibleCover(item: CultivarRecord | null | undefined, { prioritizeEditorial = false }: { prioritizeEditorial?: boolean } = {}) {
  const visibleImages = getVisibleImagePaths(item);

  if (prioritizeEditorial) {
    if (visibleImages.length) {
      return visibleImages[0];
    }
    if (item?.cover_path) {
      return item.cover_path;
    }
    return null;
  }

  const preferredCover = item?.images?.public_cover_path;
  if (preferredCover && visibleImages.includes(preferredCover)) {
    return preferredCover;
  }

  if (visibleImages.length) {
    return visibleImages[0];
  }

  if (item?.cover_path) {
    return item.cover_path;
  }

  return null;
}

export function getCoverSourceKey(item: CultivarRecord, cover: string | null | undefined) {
  if (!cover) return "none";
  if (item.cover_source && (!item.images || item.cover_path === cover)) {
    const normalizedSource = String(item.cover_source).toLowerCase();
    if (normalizedSource === "rhs") return "rhs";
    if (normalizedSource.includes("herter")) return "herter";
    if (normalizedSource.includes("ncsu")) return "ncsu";
    if (normalizedSource.includes("mr")) return "mrMaple";
    if (normalizedSource.includes("japanese maples & conifers")) return "jmac";
    if (normalizedSource.includes("conifer")) return "conifer";
    if (normalizedSource.includes("user")) return "user";
    return "none";
  }
  if ((item.images?.public_rhs_paths || []).includes(cover)) return "rhs";
  if ((item.images?.public_herter_paths || []).includes(cover)) return "herter";
  if ((item.images?.public_ncsu_paths || []).includes(cover)) return "ncsu";
  if ((item.images?.public_mrmaple_paths || []).includes(cover)) return "mrMaple";
  if ((item.images?.public_conifer_paths || []).includes(cover)) return "conifer";
  if ((item.images?.public_jmac_paths || []).includes(cover)) return "jmac";
  if ((item.images?.public_user_paths || []).includes(cover)) return "user";
  return "none";
}

export function summarizeText(text: string | null | undefined, locale: Locale = "zh", limit?: number) {
  if (!text) return locale === "en" ? "No summary available." : "暂无简介";

  const normalized = String(text).replace(/\s+/g, " ").trim();
  const maxChars = limit ?? (locale === "en" ? 118 : 72);

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const sentenceParts = normalized.match(/[^。！？.!?]+[。！？.!?]?/g) || [normalized];
  let summary = "";

  for (const part of sentenceParts) {
    const candidate = `${summary}${part}`.trim();
    if (candidate.length > maxChars && summary) {
      break;
    }
    summary = candidate;
    if (summary.length >= Math.floor(maxChars * 0.6)) {
      break;
    }
  }

  const fallback = normalized.slice(0, maxChars).trim();
  const result = summary || fallback;
  return result.length < normalized.length ? `${result}...` : result;
}

export function getLatinSortLabel(item: CultivarRecord) {
  const candidates = [
    item.display_name,
    item.canonical_name,
    item.scientific_name,
    ...(item.aliases || []),
  ];

  return candidates.find((value): value is string => typeof value === "string" && hasContent(value) && /[A-Za-z]/.test(value)) || "";
}

export function getChineseSortLabel(item: CultivarRecord) {
  return item.chinese_name || item.display_name || item.canonical_name || item.scientific_name || "";
}

export function getAlphaGroup(item: CultivarRecord) {
  const label = getLatinSortLabel(item);
  const match = label.match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : "#";
}

export function compareCultivars(a: CultivarRecord, b: CultivarRecord) {
  const aGroup = getAlphaGroup(a);
  const bGroup = getAlphaGroup(b);

  if (aGroup !== bGroup) {
    if (aGroup === "#") return 1;
    if (bGroup === "#") return -1;
    return latinCollator.compare(aGroup, bGroup);
  }

  const latinCompare = latinCollator.compare(getLatinSortLabel(a), getLatinSortLabel(b));
  if (latinCompare !== 0) return latinCompare;

  return chineseCollator.compare(getChineseSortLabel(a), getChineseSortLabel(b));
}

export function matchesQuery(item: CultivarRecord, query: string) {
  if (!query) return true;

  return (item.search_index || "").includes(query);
}

export function getAlphabetSections(records: CultivarRecord[]): Array<[string, CultivarRecord[]]> {
  const sorted = [...records].sort(compareCultivars);
  const map = new Map<string, CultivarRecord[]>();

  sorted.forEach((item) => {
    const group = getAlphaGroup(item);
    const current = map.get(group) || [];
    current.push(item);
    map.set(group, current);
  });

  return [...map.entries()];
}
