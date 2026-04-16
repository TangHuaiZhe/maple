import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

const latinCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const chineseCollator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });
const PAGE_SIZE = 96;
const DETAIL_GALLERY_PAGE_SIZE = 10;
const SEARCH_ALL_VALUE = "__all__";
const DESCRIPTION_NOISE_MARKERS = [
  /pointer-events-auto/i,
  /request-WEB:/i,
  /data-testid=/i,
  /scroll-mt-\[/i,
  /NURSERY SOURCES/i,
  /USDA HARDINESS ZONE/i,
  /This chapter presents/i,
];
const UI_STRINGS = {
  zh: {
    localeName: "中",
    nav: {
      catalog: "品种目录",
      search: "筛选搜索",
      awards: "RHS 获奖",
    },
    common: {
      noImage: "无图片",
      noResults: "没有匹配到结果。",
      loadMore: "加载更多",
      loadMoreImages: "加载更多图片",
      imagePreviewHint: "点击查看大图",
    },
    coverSource: {
      none: "无图",
      rhs: "RHS",
      herter: "Herter",
      ncsu: "NCSU",
      mrMaple: "Mr Maple",
      local: "本地",
    },
    lightbox: {
      dialogSuffix: "图片预览",
      close: "关闭",
      previous: "上一张",
      next: "下一张",
    },
    home: {
      eyebrow: "Japanese Maple Directory",
      title: "先把所有品种排成一张能快速翻阅的目录。",
      lead: "首页直接列出全部枫树品种，按首字母排序；搜索同时匹配中文名、英文名、学名和别名。",
      searchLabel: "中英文搜索",
      searchPlaceholder: "例如 Ice Dragon、冰龙、Acer palmatum",
      note: "首页卡片封面优先使用 RHS、Mr Maple、Herter 和 NCSU 图片，其次才回退到本地原图。",
      totalLabel: "品种总数",
      currentLabel: "当前结果",
      editorialLabel: "RHS / Mr Maple / Herter / NCSU 封面",
      chineseDescriptionLabel: "已有中文描述",
    },
    catalog: {
      alphaLabel: "字母索引",
      itemCount: (count) => `${count} 个品种`,
      progress: (shown, total) => `已显示 ${shown} / ${total} 个品种`,
      autoLoadMore: "继续下滑会自动加载更多品种",
    },
    search: {
      title: "筛选搜索",
      subtitle: "按分类收窄范围，再用中英文关键词定位具体品种。",
      keyword: "关键词",
      keywordPlaceholder: "例如 coral、珊瑚、三河、shirasawanum",
      category: "一级分类",
      all: "全部",
      result: (count) => `结果：${count} 条`,
    },
    awards: {
      title: "RHS 获奖品种",
      subtitle: "按你整理的获奖清单单独展示，便于集中浏览经典品种与常见园艺名。",
      count: (count) => `共 ${count} 个获奖品种`,
    },
    detail: {
      loading: "正在加载品种详情…",
      loadFailed: "加载失败",
      notFoundTitle: "未找到条目",
      notFoundText: "该详情页 ID 不存在于当前数据集中。",
      fallbackCategory: "书籍条目",
      noDescription: "暂无描述",
      basicInfo: "基本信息",
      standardName: "标准名",
      chineseName: "中文名",
      chineseAliases: "中文别名",
      species: "物种",
      topCategory: "一级分类",
      webGroup: "网页分组",
      size: "尺寸",
      imageCount: "图片数",
      sourceCount: "来源数",
      rhsMatched: "RHS 增强",
      matched: "已匹配",
      unmatched: "未匹配",
      sources: "来源",
      gallery: "图片画廊",
      galleryNote: "详情页保留全部已同步图片，包含原始图库、RHS、Mr Maple、Herter 和 NCSU 素材。",
      noImages: "当前条目没有本地图片。",
      imageProgress: (shown, total) => `已显示 ${shown} / ${total} 张图片`,
      descriptionSummary: "简介",
      descriptionFull: "完整描述",
      showMoreDescription: "展开完整描述",
      showLessDescription: "收起完整描述",
    },
    app: {
      loading: "正在加载日本枫树数据…",
      loadFailed: (error) => `加载失败：${error}`,
    },
  },
  en: {
    localeName: "EN",
    nav: {
      catalog: "Catalog",
      search: "Search",
      awards: "RHS Awards",
    },
    common: {
      noImage: "No Image",
      noResults: "No matches found.",
      loadMore: "Load More",
      loadMoreImages: "Load More Images",
      imagePreviewHint: "View full size",
    },
    coverSource: {
      none: "No Image",
      rhs: "RHS",
      herter: "Herter",
      ncsu: "NCSU",
      mrMaple: "Mr Maple",
      local: "Local",
    },
    lightbox: {
      dialogSuffix: "Image Preview",
      close: "Close",
      previous: "Previous",
      next: "Next",
    },
    home: {
      eyebrow: "Japanese Maple Directory",
      title: "Browse the full collection in one fast-scanning index.",
      lead: "The home page lists every maple cultivar, sorted alphabetically, with search across Chinese names, English names, scientific names, and aliases.",
      searchLabel: "Search",
      searchPlaceholder: "For example Ice Dragon, Bloodgood, Acer palmatum",
      note: "Catalog cards prefer RHS, Mr Maple, Herter, and NCSU imagery before falling back to local photos.",
      totalLabel: "Total Cultivars",
      currentLabel: "Current Results",
      editorialLabel: "RHS / Mr Maple / Herter / NCSU Covers",
      chineseDescriptionLabel: "Chinese Descriptions",
    },
    catalog: {
      alphaLabel: "Alphabet Index",
      itemCount: (count) => `${count} cultivars`,
      progress: (shown, total) => `Showing ${shown} / ${total} cultivars`,
      autoLoadMore: "Scroll down to load more cultivars automatically",
    },
    search: {
      title: "Search & Filter",
      subtitle: "Narrow the list by category, then pinpoint cultivars with Chinese or English keywords.",
      keyword: "Keyword",
      keywordPlaceholder: "For example coral, Bloodgood, shirasawanum",
      category: "Top Category",
      all: "All",
      result: (count) => `Results: ${count}`,
    },
    awards: {
      title: "RHS Award Winners",
      subtitle: "A dedicated page for the award-winning cultivars in your curated shortlist.",
      count: (count) => `${count} award-winning cultivars`,
    },
    detail: {
      loading: "Loading cultivar details…",
      loadFailed: "Load Failed",
      notFoundTitle: "Entry Not Found",
      notFoundText: "This cultivar ID does not exist in the current dataset.",
      fallbackCategory: "Book Entry",
      noDescription: "No description available.",
      basicInfo: "Basic Info",
      standardName: "Standard Name",
      chineseName: "Chinese Name",
      chineseAliases: "Chinese Aliases",
      species: "Species",
      topCategory: "Top Category",
      webGroup: "Web Group",
      size: "Size",
      imageCount: "Image Count",
      sourceCount: "Source Count",
      rhsMatched: "RHS Enhanced",
      matched: "Matched",
      unmatched: "Not Matched",
      sources: "Sources",
      gallery: "Image Gallery",
      galleryNote: "The detail page keeps all synced imagery, including local, RHS, Mr Maple, Herter, and NCSU assets.",
      noImages: "No local images are available for this entry.",
      imageProgress: (shown, total) => `Showing ${shown} / ${total} images`,
      descriptionSummary: "Overview",
      descriptionFull: "Full Description",
      showMoreDescription: "Show Full Description",
      showLessDescription: "Collapse Full Description",
    },
    app: {
      loading: "Loading Japanese maple data…",
      loadFailed: (error) => `Load failed: ${error}`,
    },
  },
};
const RHS_AWARD_SELECTIONS = [
  { id: "acer-palmatum-bloodgood", displayName: "Bloodgood", chineseName: "血红", awardGroup: "山红叶" },
  { id: "acer-palmatum-osakazuk", displayName: "Osakazuki", chineseName: "大盃", awardGroup: "山红叶" },
  { id: "acer-palmatum-crimson-queen", displayName: "Crimson Queen", chineseName: "绯红", awardGroup: "羽毛" },
  { id: "acer-palmatum-emerald-lace", displayName: "Emerald Lace", chineseName: "翡翠蕾丝", awardGroup: "羽毛" },
  { id: "acer-palmatum-garnet", displayName: "Garnet", chineseName: "石榴红", awardGroup: "羽毛" },
  { id: "acer-palmatum-inaba-shidare", displayName: "Inaba-shidare", chineseName: "稻叶枝垂", awardGroup: "羽毛" },
  { id: "acer-palmatum-orangeola", displayName: "Orangeola", chineseName: "橘子欧拉", awardGroup: "羽毛" },
  { id: "acer-palmatum-ornatum", displayName: "Ornatum", chineseName: "赤鹫尾", awardGroup: "羽毛" },
  { id: "acer-palmatum-seiryu", displayName: "Seiryu", chineseName: "青龙", awardGroup: "羽毛" },
  { id: "acer-palmatum-kiyohime", displayName: "Kiyohime", chineseName: "清姬", awardGroup: "Dwarf" },
  { id: "acer-palmatum-kinshi", displayName: "Kinshi", chineseName: "金线", awardGroup: null },
  { id: "acer-palmatum-red-pygmy", displayName: "Red Pygmy", chineseName: "红矮人", awardGroup: null },
  { id: "acer-palmatum-burgundy-lace", displayName: "Burgundy Lace", chineseName: "酒红蕾丝", awardGroup: "山红叶" },
  { id: "acer-palmatum-chitose-yama", displayName: "Chitose-yama", chineseName: "千岁红", awardGroup: "山红叶" },
  { id: "acer-palmatum-elegans", displayName: "Elegans", chineseName: "典雅", awardGroup: null },
  { id: "acer-palmatum-trompenburg", displayName: "Trompenburg", chineseName: "布加迪", awardGroup: null },
  { id: "acer-palmatum-ariadne", displayName: "Ariadne", chineseName: "女神", awardGroup: null },
  { id: "acer-palmatum-beni-maiko", displayName: "Beni-maiko", chineseName: "红舞姬", awardGroup: null },
  { id: "acer-palmatum-corallinum", displayName: "Corallinum", chineseName: "珊瑚", awardGroup: null },
  { id: "acer-palmatum-eddisbury", displayName: "Eddisbury", chineseName: "埃迪斯伯里", awardGroup: null },
  { id: "acer-palmatum-katsura", displayName: "Katsura", chineseName: "卡苏", awardGroup: null },
  { id: "acer-palmatum-orange-dream", displayName: "Orange dream", chineseName: "橙之梦", awardGroup: null },
  { id: "acer-palmatum-sango-kaku", displayName: "Sango-kaku", chineseName: "珊瑚阁", awardGroup: null },
  { id: "acer-palmatum-shin-desho-jo", displayName: "Shin-deshojo", chineseName: "新出猩猩", awardGroup: null },
  { id: "acer-palmatum-shishigashira", displayName: "Shishi-gashira", chineseName: "狮子头", awardGroup: null },
  { id: "acer-palmatum-beni-tsukasa", displayName: "Beni-tsukasa", chineseName: "红司", awardGroup: null },
  { id: "acer-japonicum-aconitifolium", displayName: "Aconitifolium", chineseName: "舞孔雀", awardGroup: null },
  { id: "acer-japonicum-green-cascade", displayName: "Green Cascade", chineseName: "绿色瀑布", awardGroup: null },
  { id: "acer-japonicum-vitifolium", displayName: "Vitifolium", chineseName: "葡萄叶", awardGroup: null },
];

function hasContent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeCultivarToken(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

function mergeLocalizedValue(baseValue, localizedValue) {
  if (!hasContent(localizedValue)) {
    return baseValue;
  }

  if (
    baseValue &&
    localizedValue &&
    typeof baseValue === "object" &&
    typeof localizedValue === "object" &&
    !Array.isArray(baseValue) &&
    !Array.isArray(localizedValue)
  ) {
    const merged = { ...baseValue };

    Object.entries(localizedValue).forEach(([key, value]) => {
      merged[key] = mergeLocalizedValue(baseValue[key], value);
    });

    return merged;
  }

  return localizedValue;
}

function normalizeSearchText(text) {
  return (text || "").toLowerCase().trim();
}

function localizeRecord(record) {
  return {
    ...record,
    descriptions_en: record.descriptions,
    rhs_en: record.rhs,
    descriptions: mergeLocalizedValue(record.descriptions, record.descriptions_zh),
    rhs: mergeLocalizedValue(record.rhs, record.rhs_zh),
  };
}

function getKnownCultivarTokens(item) {
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

function cleanDescriptionText(text, item) {
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

function getDescriptionPenalty(text) {
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

function buildDescriptionPreview(text, locale = "zh", maxChars) {
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

function getPreferredDescription(item, locale = "zh") {
  const descriptions = locale === "en" ? (item.descriptions_en || item.descriptions) : item.descriptions;
  const rhs = locale === "en" ? (item.rhs_en || item.rhs) : item.rhs;
  const sourceDescriptions = (item.sources || []).map((source) => source.description).filter(hasContent);
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

function getEditorialCover(item) {
  if (item.cover_path) {
    return item.cover_path;
  }

  return uniqueValues([
    ...(item.images?.public_rhs_paths || []),
    ...(item.images?.public_mrmaple_paths || []),
    ...(item.images?.public_herter_paths || []),
    ...(item.images?.public_ncsu_paths || []),
    ...(item.images?.public_original_paths || []),
    item.images?.public_cover_path,
  ])[0] || null;
}

function getDetailCover(item) {
  return item.images?.public_cover_path || getEditorialCover(item);
}

function hasSupplementalImages(item) {
  return [
    ...(item?.images?.public_rhs_paths || []),
    ...(item?.images?.public_mrmaple_paths || []),
    ...(item?.images?.public_herter_paths || []),
    ...(item?.images?.public_ncsu_paths || []),
  ].length > 0;
}

function getVisibleOriginalImagePaths(item) {
  if (item?.has_web && hasSupplementalImages(item)) {
    return [];
  }

  return item?.images?.public_original_paths || [];
}

function getVisibleImagePaths(item) {
  return uniqueValues([
    ...(item?.images?.public_rhs_paths || []),
    ...(item?.images?.public_mrmaple_paths || []),
    ...(item?.images?.public_herter_paths || []),
    ...(item?.images?.public_ncsu_paths || []),
    ...getVisibleOriginalImagePaths(item),
  ]);
}

function getVisibleCover(item, { prioritizeEditorial = false } = {}) {
  const visibleImages = getVisibleImagePaths(item);

  if (prioritizeEditorial) {
    if (visibleImages.length) {
      return visibleImages[0];
    }
    if (item?.cover_path && !(item?.has_web && (item?.cover_source || "").toLowerCase() === "local")) {
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

  if (item?.cover_path && !(item?.has_web && (item?.cover_source || "").toLowerCase() === "local")) {
    return item.cover_path;
  }

  return null;
}

function getCoverSourceKey(item, cover) {
  if (!cover) return "none";
  if (item.cover_source && (!item.images || item.cover_path === cover)) {
    const normalizedSource = String(item.cover_source).toLowerCase();
    if (normalizedSource === "rhs") return "rhs";
    if (normalizedSource.includes("herter")) return "herter";
    if (normalizedSource.includes("ncsu")) return "ncsu";
    if (normalizedSource.includes("mr")) return "mrMaple";
    return "local";
  }
  if ((item.images?.public_rhs_paths || []).includes(cover)) return "rhs";
  if ((item.images?.public_herter_paths || []).includes(cover)) return "herter";
  if ((item.images?.public_ncsu_paths || []).includes(cover)) return "ncsu";
  if ((item.images?.public_mrmaple_paths || []).includes(cover)) return "mrMaple";
  return "local";
}

function getCoverSourceLabel(sourceKey, locale = "zh") {
  return UI_STRINGS[locale]?.coverSource?.[sourceKey] || UI_STRINGS.zh.coverSource[sourceKey] || sourceKey;
}

function loadCatalog() {
  return fetch("/data/catalog.json").then((response) => {
    if (!response.ok) {
      throw new Error("无法加载 catalog.json");
    }
    return response.json();
  });
}

function loadCultivar(id) {
  return fetch(`/data/details/${id}.json`).then((response) => {
    if (!response.ok) {
      throw new Error("无法加载该品种详情");
    }
    return response.json().then((record) => localizeRecord(record));
  });
}

function summarizeText(text, locale = "zh", limit) {
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

function getSizeSummary(rhs, rhsEnglish, locale = "zh") {
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

function getDetailTraits(item, locale = "zh", rhsLabels = RHS_FIELD_LABELS[locale] || RHS_FIELD_LABELS.zh) {
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

function getChineseAliases(item) {
  return uniqueValues(
    [...(item.aliases || []), ...(item.search_terms || [])]
      .map((value) => (typeof value === "string" ? value.replace(/\s+/g, "").trim() : ""))
      .filter((value) => value && /[\u4e00-\u9fff]/.test(value) && !/[A-Za-z]/.test(value))
      .filter((value) => value !== item.chinese_name),
  );
}

const RHS_VALUE_TRANSLATIONS = {
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

const RHS_FIELD_LABELS = {
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

function translateRhsValue(value) {
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

function translateRhsMeasurement(value) {
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

function getLocalizedRhsValue(locale, localizedValue, englishValue, { measurement = false } = {}) {
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

function getLatinSortLabel(item) {
  const candidates = [
    item.display_name,
    item.canonical_name,
    item.scientific_name,
    ...(item.aliases || []),
  ];

  return candidates.find((value) => hasContent(value) && /[A-Za-z]/.test(value)) || "";
}

function getChineseSortLabel(item) {
  return item.chinese_name || item.display_name || item.canonical_name || item.scientific_name || "";
}

function getAlphaGroup(item) {
  const label = getLatinSortLabel(item);
  const match = label.match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : "#";
}

function compareCultivars(a, b) {
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

function matchesQuery(item, query) {
  if (!query) return true;

  return (item.search_index || "").includes(query);
}

function getAlphabetSections(records) {
  const sorted = [...records].sort(compareCultivars);
  const map = new Map();

  sorted.forEach((item) => {
    const group = getAlphaGroup(item);
    const current = map.get(group) || [];
    current.push(item);
    map.set(group, current);
  });

  return [...map.entries()];
}

function DefinitionList({ items }) {
  return (
    <dl className="detail-list">
      {items.filter(([, value]) => value).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ImageLightbox({ images, activeIndex, title, subtitle, onClose, onStep, strings }) {
  const currentImage = images[activeIndex];

  if (!currentImage) {
    return null;
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} ${strings.lightbox.dialogSuffix}`}
      onClick={onClose}
    >
      <div className="lightbox-title">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label={strings.lightbox.close}
      >
        {strings.lightbox.close}
      </button>
      {images.length > 1 ? (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-prev"
          onClick={(event) => {
            event.stopPropagation();
            onStep(-1);
          }}
          aria-label={strings.lightbox.previous}
        >
          ‹
        </button>
      ) : null}
      <div
        className="lightbox-stage"
        onClick={(event) => event.stopPropagation()}
      >
        <img src={currentImage} alt={title} />
        <p className="lightbox-meta">
          {activeIndex + 1} / {images.length}
        </p>
      </div>
      {images.length > 1 ? (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-next"
          onClick={(event) => {
            event.stopPropagation();
            onStep(1);
          }}
          aria-label={strings.lightbox.next}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

function AtlasStats({ records, filtered, strings, locale }) {
  const editorialCovers = records.filter((item) => getCoverSourceKey(item, getEditorialCover(item)) !== "local").length;
  const chineseDescriptions = records.filter((item) => /[\u4e00-\u9fff]/.test(getPreferredDescription(item))).length;

  return (
    <div className="atlas-stats">
      <article className="atlas-stat">
        <span>{strings.home.totalLabel}</span>
        <strong>{records.length}</strong>
      </article>
      <article className="atlas-stat">
        <span>{strings.home.currentLabel}</span>
        <strong>{filtered.length}</strong>
      </article>
      <article className="atlas-stat">
        <span>{strings.home.editorialLabel}</span>
        <strong>{editorialCovers}</strong>
      </article>
      <article className="atlas-stat">
        <span>{strings.home.chineseDescriptionLabel}</span>
        <strong>{chineseDescriptions}</strong>
      </article>
    </div>
  );
}

function CultivarCard({ item, prioritizeEditorialImage = false, strings, locale }) {
  const description = getPreferredDescription(item, locale);
  const cover = getVisibleCover(item, { prioritizeEditorial: prioritizeEditorialImage });
  const coverSourceKey = getCoverSourceKey(item, cover);
  const coverSourceLabel = getCoverSourceLabel(coverSourceKey, locale);

  return (
    <article className="cultivar-card">
      <Link className="cultivar-visual" to={`/cultivar/${item.id}`}>
        {cover ? (
          <img src={cover} alt={item.display_name || item.canonical_name} loading="lazy" />
        ) : (
          <div className="image-fallback">{strings.common.noImage}</div>
        )}
        <span className={`cover-chip source-${coverSourceKey === "mrMaple" ? "mr-maple" : coverSourceKey}`}>{coverSourceLabel}</span>
      </Link>
      <div className="cultivar-meta">
        <div className="cultivar-kicker">
          <span>{getAlphaGroup(item)}</span>
          {item.top_category ? <span>{item.top_category}</span> : null}
          {item.web_group ? <span>{item.web_group}</span> : null}
        </div>
        <h3 className="cultivar-title">
          <Link to={`/cultivar/${item.id}`}>{item.display_name || item.canonical_name}</Link>
        </h3>
        {item.chinese_name ? <p className="cultivar-chinese">{item.chinese_name}</p> : null}
        <p className="cultivar-scientific">{item.scientific_name || item.canonical_name}</p>
        <p className="cultivar-description">{summarizeText(description, locale)}</p>
      </div>
    </article>
  );
}

function AlphabetToolbar({ letters, onSelect, strings }) {
  return (
    <nav className="alpha-toolbar" aria-label={strings.catalog.alphaLabel}>
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          className="alpha-link"
          onClick={() => onSelect(letter)}
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}

function CatalogSections({ sections, prioritizeEditorialImage, strings, locale }) {
  if (!sections.length) {
    return <div className="empty-state">{strings.common.noResults}</div>;
  }

  return (
    <div className="catalog-sections">
      {sections.map(([letter, items]) => (
        <section key={letter} id={`section-${letter}`} className="catalog-section">
          <div className="catalog-section-head">
            <h2>{letter}</h2>
            <p>{strings.catalog.itemCount(items.length)}</p>
          </div>
          <div className="catalog-grid">
            {items.map((item) => (
              <CultivarCard
                key={item.id}
                item={item}
                prioritizeEditorialImage={prioritizeEditorialImage}
                strings={strings}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RHSAwardPage({ records, strings, locale }) {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const resolvedSelections = RHS_AWARD_SELECTIONS
    .map((selection) => {
      const record = recordMap.get(selection.id);
      if (!record) {
        return null;
      }

      return {
        ...record,
        display_name: selection.displayName || record.display_name,
        chinese_name: selection.chineseName || record.chinese_name,
      };
    })
    .filter(Boolean);

  return (
    <div className="page-shell">
      <section className="search-panel">
        <div className="section-head">
          <h1>{strings.awards.title}</h1>
          <p>{strings.awards.subtitle}</p>
        </div>
        <div className="result-summary">{strings.awards.count(resolvedSelections.length)}</div>
      </section>

      <div className="catalog-sections">
        <section className="catalog-section">
          <div className="catalog-grid">
            {resolvedSelections.map((item) => (
              <CultivarCard key={item.id} item={item} prioritizeEditorialImage strings={strings} locale={locale} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function PaginatedCatalog({ records, prioritizeEditorialImage = false, strings, locale }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingLetter, setPendingLetter] = useState("");
  const sentinelRef = useRef(null);
  const firstRecordId = records[0]?.id || "";
  const lastRecordId = records[records.length - 1]?.id || "";
  const allSections = getAlphabetSections(records);
  const visibleRecords = records.slice(0, visibleCount);
  const hasMore = visibleRecords.length < records.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPendingLetter("");
  }, [records.length, firstRecordId, lastRecordId]);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setVisibleCount((count) => Math.min(count + PAGE_SIZE, records.length));
      },
      {
        rootMargin: "0px 0px 320px 0px",
      },
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, records.length, visibleCount]);

  useEffect(() => {
    if (!pendingLetter) {
      return undefined;
    }

    const frameId = requestAnimationFrame(() => {
      document.getElementById(`section-${pendingLetter}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingLetter("");
    });

    return () => cancelAnimationFrame(frameId);
  }, [pendingLetter, visibleCount]);

  if (!records.length) {
    return <div className="empty-state">{strings.common.noResults}</div>;
  }

  const sections = getAlphabetSections(visibleRecords);
  const letters = allSections.map(([letter]) => letter);

  function handleLetterSelect(letter) {
    const target = document.getElementById(`section-${letter}`);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    let requiredCount = 0;
    for (const [sectionLetter, items] of allSections) {
      requiredCount += items.length;
      if (sectionLetter === letter) {
        break;
      }
    }

    setPendingLetter(letter);
    setVisibleCount((count) => Math.max(count, requiredCount));
  }

  return (
    <>
      <AlphabetToolbar letters={letters} onSelect={handleLetterSelect} strings={strings} />
      <CatalogSections sections={sections} prioritizeEditorialImage={prioritizeEditorialImage} strings={strings} locale={locale} />
      <div className="catalog-actions">
        <p className="catalog-progress">
          {strings.catalog.progress(visibleRecords.length, records.length)}
        </p>
        {hasMore ? <p className="catalog-progress">{strings.catalog.autoLoadMore}</p> : null}
        {hasMore ? <div ref={sentinelRef} className="catalog-sentinel" aria-hidden="true" /> : null}
      </div>
    </>
  );
}

function HomePage({ records, strings, locale }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalizeSearchText(deferredQuery);
  const filtered = records.filter((item) => matchesQuery(item, normalizedQuery));

  return (
    <div className="page-shell">
      <section className="atlas-hero">
        <div className="atlas-copy">
          <p className="eyebrow">{strings.home.eyebrow}</p>
          <h1>{strings.home.title}</h1>
          <p className="atlas-lead">
            {strings.home.lead}
          </p>
        </div>

        <div className="atlas-search-panel">
          <label className="field">
            <span>{strings.home.searchLabel}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={strings.home.searchPlaceholder}
            />
          </label>
          <p className="atlas-note">{strings.home.note}</p>
        </div>
      </section>

      <AtlasStats records={records} filtered={filtered} strings={strings} locale={locale} />
      <PaginatedCatalog records={filtered} prioritizeEditorialImage strings={strings} locale={locale} />
    </div>
  );
}

function SearchPage({ records, strings, locale }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  const initialCategory = new URLSearchParams(location.search).get("category") || SEARCH_ALL_VALUE;
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== SEARCH_ALL_VALUE) params.set("category", category);
    navigate({ pathname: "/search", search: params.toString() }, { replace: true });
  }, [query, category, navigate]);

  const categories = [{ value: SEARCH_ALL_VALUE, label: strings.search.all }, ...new Set(records.map((item) => item.top_category).filter(Boolean)).values().map((item) => ({ value: item, label: item }))];
  const normalizedQuery = normalizeSearchText(deferredQuery);
  const filtered = records.filter((item) => {
    const categoryMatch = category === SEARCH_ALL_VALUE || item.top_category === category;
    return categoryMatch && matchesQuery(item, normalizedQuery);
  });

  return (
    <div className="page-shell">
      <section className="search-panel">
        <div className="section-head">
          <h1>{strings.search.title}</h1>
          <p>{strings.search.subtitle}</p>
        </div>
        <div className="search-controls">
          <label className="field">
            <span>{strings.search.keyword}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={strings.search.keywordPlaceholder}
            />
          </label>
          <label className="field">
            <span>{strings.search.category}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="result-summary">{strings.search.result(filtered.length)}</div>
      </section>

      <PaginatedCatalog records={filtered} prioritizeEditorialImage strings={strings} locale={locale} />
    </div>
  );
}

function DetailPage({ locale, strings }) {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [previewIndex, setPreviewIndex] = useState(null);
  const [visibleImageCount, setVisibleImageCount] = useState(DETAIL_GALLERY_PAGE_SIZE);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const previewImages = item ? uniqueValues([getVisibleCover(item), ...getVisibleImagePaths(item)]) : [];
  const galleryImages = item ? getVisibleImagePaths(item) : [];
  const visibleGalleryImages = galleryImages.slice(0, visibleImageCount);
  const hasMoreGalleryImages = visibleGalleryImages.length < galleryImages.length;

  useEffect(() => {
    setStatus("loading");
    setError("");
    setPreviewIndex(null);
    setVisibleImageCount(DETAIL_GALLERY_PAGE_SIZE);
    setIsDescriptionExpanded(false);

    loadCultivar(id)
      .then((data) => {
        setItem(data);
        setStatus("ready");
      })
      .catch((err) => {
        setItem(null);
        setError(err.message);
        setStatus("error");
      });
  }, [id]);

  useEffect(() => {
    if (previewIndex == null) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setPreviewIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setPreviewIndex((current) => {
          if (current == null || !previewImages.length) return current;
          return (current - 1 + previewImages.length) % previewImages.length;
        });
      }

      if (event.key === "ArrowRight") {
        setPreviewIndex((current) => {
          if (current == null || !previewImages.length) return current;
          return (current + 1) % previewImages.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewIndex, previewImages]);

  if (status === "loading") {
    return (
      <div className="page-shell">
        <div className="empty-state">{strings.detail.loading}</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page-shell">
        <div className="empty-state">
          <h1>{strings.detail.loadFailed}</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const description = item ? getPreferredDescription(item, locale) : "";
  const descriptionSummary = buildDescriptionPreview(description, locale, locale === "en" ? 300 : 180);
  const descriptionFull = description;
  const isLongDescription = hasContent(descriptionFull) && descriptionSummary.length < descriptionFull.length;
  const shouldSplitDescription = isLongDescription && descriptionFull.length >= (locale === "en" ? 420 : 260);

  if (!item) {
    return (
      <div className="page-shell">
        <div className="empty-state">
          <h1>{strings.detail.notFoundTitle}</h1>
          <p>{strings.detail.notFoundText}</p>
        </div>
      </div>
    );
  }

  const rhs = item.rhs;
  const rhsEnglish = item.rhs_en || item.rhs;
  const rhsLabels = RHS_FIELD_LABELS[locale] || RHS_FIELD_LABELS.zh;
  const cover = getVisibleCover(item);
  const sizeSummary = getSizeSummary(rhs, rhsEnglish, locale);
  const detailTraits = getDetailTraits(item, locale, rhsLabels);
  const chineseAliases = getChineseAliases(item);
  const rhsDimensionItems = rhs
    ? [
        [rhsLabels.chineseName, item.chinese_name || "—"],
        [rhsLabels.botanicalName, rhsEnglish?.botanical_name],
        [rhsLabels.height, getLocalizedRhsValue(locale, rhs.dimensions?.height, rhsEnglish?.dimensions?.height, { measurement: true })],
        [rhsLabels.spread, getLocalizedRhsValue(locale, rhs.dimensions?.spread, rhsEnglish?.dimensions?.spread, { measurement: true })],
        [rhsLabels.timeToFullHeight, getLocalizedRhsValue(locale, rhs.dimensions?.time_to_full_height, rhsEnglish?.dimensions?.time_to_full_height, { measurement: true })],
        [rhsLabels.hardiness, getLocalizedRhsValue(locale, rhs.growing_conditions?.hardiness, rhsEnglish?.growing_conditions?.hardiness)],
        [rhsLabels.sunlight, getLocalizedRhsValue(locale, rhs.growing_conditions?.sunlight, rhsEnglish?.growing_conditions?.sunlight)],
        [rhsLabels.soilType, getLocalizedRhsValue(locale, rhs.growing_conditions?.soil_type, rhsEnglish?.growing_conditions?.soil_type)],
        [rhsLabels.aspect, getLocalizedRhsValue(locale, rhs.growing_conditions?.aspect, rhsEnglish?.growing_conditions?.aspect)],
        [rhsLabels.moisture, getLocalizedRhsValue(locale, rhs.growing_conditions?.moisture, rhsEnglish?.growing_conditions?.moisture)],
        [rhsLabels.ph, getLocalizedRhsValue(locale, rhs.growing_conditions?.ph, rhsEnglish?.growing_conditions?.ph)],
        [rhsLabels.exposure, getLocalizedRhsValue(locale, rhs.growing_conditions?.exposure, rhsEnglish?.growing_conditions?.exposure)],
      ]
    : [];
  const rhsCareItems = rhs
    ? [
        [rhsLabels.cultivation, getLocalizedRhsValue(locale, rhs.care?.cultivation, rhsEnglish?.care?.cultivation)],
        [rhsLabels.pruning, getLocalizedRhsValue(locale, rhs.care?.pruning, rhsEnglish?.care?.pruning)],
        [rhsLabels.propagation, getLocalizedRhsValue(locale, rhs.care?.propagation, rhsEnglish?.care?.propagation)],
        [rhsLabels.pest, getLocalizedRhsValue(locale, rhs.resistance?.pest, rhsEnglish?.resistance?.pest)],
        [rhsLabels.disease, getLocalizedRhsValue(locale, rhs.resistance?.disease, rhsEnglish?.resistance?.disease)],
        [rhsLabels.suggestedUses, getLocalizedRhsValue(locale, rhs.attributes?.suggested_uses, rhsEnglish?.attributes?.suggested_uses)],
        [rhsLabels.habit, getLocalizedRhsValue(locale, rhs.attributes?.habit, rhsEnglish?.attributes?.habit)],
        [rhsLabels.plantType, getLocalizedRhsValue(locale, rhs.attributes?.plant_type, rhsEnglish?.attributes?.plant_type)],
        [rhsLabels.foliage, getLocalizedRhsValue(locale, rhs.attributes?.foliage, rhsEnglish?.attributes?.foliage)],
      ]
    : [];

  function openPreview(imagePath) {
    const index = previewImages.indexOf(imagePath);
    setPreviewIndex(index >= 0 ? index : 0);
  }

  function stepPreview(step) {
    setPreviewIndex((current) => {
      if (current == null || !previewImages.length) return current;
      return (current + step + previewImages.length) % previewImages.length;
    });
  }

  return (
    <>
      <div className="page-shell detail-shell">
        <section className="detail-hero">
          <div className="detail-copy">
            <p className="eyebrow">{item.top_category || strings.detail.fallbackCategory} {item.web_group ? `· ${item.web_group}` : ""}</p>
            <h1>{item.display_name || item.canonical_name}</h1>
            {item.chinese_name ? <p className="detail-chinese">{item.chinese_name}</p> : null}
            <p className="detail-scientific">{item.scientific_name || item.canonical_name}</p>
            <div className={shouldSplitDescription ? "detail-description-stack" : "detail-description-merged"}>
              <section className="detail-description-layer">
                {shouldSplitDescription ? <p className="detail-description-label">{strings.detail.descriptionSummary}</p> : null}
                <p className="detail-description">
                  {descriptionSummary || strings.detail.noDescription}
                </p>
                {detailTraits.length ? (
                  <div className="detail-fact-row">
                    {detailTraits.map((fact) => (
                      <span key={fact} className="detail-fact-chip">{fact}</span>
                    ))}
                  </div>
                ) : null}
              </section>
              {shouldSplitDescription ? (
                <section className="detail-description-layer">
                  <div className="detail-description-layer-head">
                    <p className="detail-description-label">{strings.detail.descriptionFull}</p>
                    <button
                      type="button"
                      className="detail-toggle"
                      onClick={() => setIsDescriptionExpanded((value) => !value)}
                    >
                      {isDescriptionExpanded ? strings.detail.showLessDescription : strings.detail.showMoreDescription}
                    </button>
                  </div>
                  {isDescriptionExpanded ? (
                    <p className="detail-description detail-description-full">
                      {descriptionFull}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
            <div className="tag-row">
              {(item.book_groups || []).map((group) => (
                <span key={group} className="tag-chip">{group}</span>
              ))}
              {(item.color_groups || []).map((group) => (
                <span key={group} className="tag-chip subtle">{group}</span>
              ))}
            </div>
          </div>
          <div className="detail-cover">
            {cover ? (
              <button
                type="button"
                className="image-preview-trigger image-preview-trigger-cover"
                onClick={() => openPreview(cover)}
                aria-label={`${strings.common.imagePreviewHint}: ${item.display_name}`}
              >
                <img src={cover} alt={item.display_name} />
                <span className="image-preview-hint">{strings.common.imagePreviewHint}</span>
              </button>
            ) : (
              <div className="image-fallback large">{strings.common.noImage}</div>
            )}
          </div>
        </section>

        <section className="detail-grid">
          <article className="detail-card">
            <h2>{strings.detail.basicInfo}</h2>
            <DefinitionList
              items={[
                ["ID", item.id],
                [strings.detail.standardName, item.canonical_name],
                [strings.detail.chineseName, item.chinese_name || "—"],
                [strings.detail.chineseAliases, chineseAliases.join("、") || "—"],
                [strings.detail.species, item.species || "—"],
                [strings.detail.topCategory, item.top_category || "—"],
                [strings.detail.webGroup, item.web_group || "—"],
                [strings.detail.size, sizeSummary || "—"],
                [strings.detail.imageCount, galleryImages.length],
                [strings.detail.sourceCount, item.source_count],
                [strings.detail.rhsMatched, item.has_rhs ? strings.detail.matched : strings.detail.unmatched],
              ]}
            />
          </article>

          <article className="detail-card">
            <h2>{strings.detail.sources}</h2>
            <div className="source-stack">
              {(item.sources || []).map((source) => (
                <div
                  key={`${source.source}-${source.name || source.detail_id || source.rhs_id || source.botanical_name}`}
                  className="source-item"
                >
                  <strong>{source.source}</strong>
                  {source.name ? <p>{source.name}</p> : null}
                  {source.botanical_name ? <p>{source.botanical_name}</p> : null}
                  {source.page_range ? <p>{locale === "en" ? `Pages: ${source.page_range}` : `页码：${source.page_range}`}</p> : null}
                  {source.group ? <p>{locale === "en" ? `Group: ${source.group}` : `分组：${source.group}`}</p> : null}
                  {source.detail_url ? <a href={source.detail_url} target="_blank" rel="noreferrer">{locale === "en" ? "Open Detail Page" : "打开详情页"}</a> : null}
                </div>
              ))}
            </div>
          </article>
        </section>

        {rhs ? (
          <section className="detail-grid">
            <article className="detail-card">
              <h2>{rhsLabels.dimensionsHeading}</h2>
              <DefinitionList items={rhsDimensionItems} />
            </article>

            <article className="detail-card">
              <h2>{rhsLabels.careHeading}</h2>
              <div className="rhs-stack">
                {rhsCareItems.filter(([, value]) => value).map(([label, value]) => (
                  <div key={label} className="rhs-item">
                    <strong>{label}</strong>
                    <p>{value}</p>
                  </div>
                ))}
              </div>
              <p className="detail-note">
                {rhsLabels.note}
              </p>
            </article>
          </section>
        ) : null}

        <section className="section-block">
          <div className="section-head">
            <h2>{strings.detail.gallery}</h2>
            <p>{strings.detail.galleryNote}</p>
          </div>
        <div className="gallery-grid">
          {galleryImages.length ? (
            visibleGalleryImages.map((imagePath, index) => (
              <figure
                key={imagePath}
                className={index === 0 ? "gallery-card gallery-card-featured" : "gallery-card"}
              >
                  <button
                    type="button"
                    className="image-preview-trigger"
                    onClick={() => openPreview(imagePath)}
                    aria-label={`${strings.common.imagePreviewHint}: ${item.display_name} ${index + 1}`}
                  >
                    <img src={imagePath} alt={item.display_name} loading="lazy" />
                    <span className="image-preview-hint">{strings.common.imagePreviewHint}</span>
                  </button>
                </figure>
              ))
            ) : (
              <div className="empty-state compact">{strings.detail.noImages}</div>
            )}
          </div>
          {galleryImages.length > DETAIL_GALLERY_PAGE_SIZE ? (
            <div className="catalog-actions">
              <p className="catalog-progress">
                {strings.detail.imageProgress(visibleGalleryImages.length, galleryImages.length)}
              </p>
              {hasMoreGalleryImages ? (
                <button
                  type="button"
                  className="load-more-button"
                  onClick={() => setVisibleImageCount((count) => count + DETAIL_GALLERY_PAGE_SIZE)}
                >
                  {strings.common.loadMoreImages}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {previewIndex != null ? (
        <ImageLightbox
          images={previewImages}
          activeIndex={previewIndex}
          title={item.display_name || item.canonical_name}
          subtitle={item.chinese_name}
          onClose={() => setPreviewIndex(null)}
          onStep={stepPreview}
          strings={strings}
        />
      ) : null}
    </>
  );
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [locale, setLocale] = useState("zh");

  useEffect(() => {
    loadCatalog()
      .then((data) => {
        setRecords(data);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return <div className="app-shell"><div className="empty-state">{UI_STRINGS[locale].app.loading}</div></div>;
  }

  if (status === "error") {
    return <div className="app-shell"><div className="empty-state">{UI_STRINGS[locale].app.loadFailed(error)}</div></div>;
  }

  const strings = UI_STRINGS[locale] || UI_STRINGS.zh;

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Maple Atlas</Link>
        <div className="header-tools">
          <nav className="site-nav">
            <NavLink to="/" end>{strings.nav.catalog}</NavLink>
            <NavLink to="/search">{strings.nav.search}</NavLink>
            <NavLink to="/rhs-awards">{strings.nav.awards}</NavLink>
          </nav>
          <div className="locale-switch" role="group" aria-label={locale === "en" ? "Language Switch" : "语言切换"}>
            <button
              type="button"
              className={locale === "zh" ? "active" : ""}
              onClick={() => setLocale("zh")}
            >
              {UI_STRINGS.zh.localeName}
            </button>
            <button
              type="button"
              className={locale === "en" ? "active" : ""}
              onClick={() => setLocale("en")}
            >
              {UI_STRINGS.en.localeName}
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage records={records} strings={strings} locale={locale} />} />
        <Route path="/search" element={<SearchPage records={records} strings={strings} locale={locale} />} />
        <Route path="/rhs-awards" element={<RHSAwardPage records={records} strings={strings} locale={locale} />} />
        <Route path="/cultivar/:id" element={<DetailPage locale={locale} strings={strings} />} />
      </Routes>
    </div>
  );
}
