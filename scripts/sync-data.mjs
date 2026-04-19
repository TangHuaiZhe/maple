import fs from "node:fs/promises";
import path from "node:path";
import { pinyin } from "pinyin-pro";

const appRoot = process.cwd();
const sourceRoot = path.join(appRoot, "data-source");
const enhancedJson = path.join(sourceRoot, "Resource/园艺/raw/merged-cultivars-with-rhs.json");
const fallbackJson = path.join(sourceRoot, "Resource/园艺/raw/merged-cultivars.json");
const sourceRhsImages = path.join(sourceRoot, "Resource/园艺/raw/rhs-images");
const sourceMrMapleImages = path.join(sourceRoot, "Resource/园艺/raw/mrmaple-images");
const sourceHerterImages = path.join(sourceRoot, "Resource/园艺/raw/herter-images");
const sourceNcsuImages = path.join(sourceRoot, "Resource/园艺/raw/ncsu-images");
const sourceConiferImages = path.join(sourceRoot, "Resource/园艺/raw/coniferkingdom-images");
const sourceJmacImages = path.join(sourceRoot, "Resource/园艺/raw/jmac-images");
const targetJson = path.join(appRoot, "public/data/merged-cultivars.json");
const targetCatalogJson = path.join(appRoot, "public/data/catalog.json");
const targetMetaJson = path.join(appRoot, "public/data/meta.json");
const targetAwardsJson = path.join(appRoot, "public/data/awards.json");
const targetDetailsDir = path.join(appRoot, "public/data/details");
const targetRhsImages = path.join(appRoot, "public/rhs-images");
const targetMrMapleImages = path.join(appRoot, "public/mrmaple-images");
const targetHerterImages = path.join(appRoot, "public/herter-images");
const targetNcsuImages = path.join(appRoot, "public/ncsu-images");
const targetConiferImages = path.join(appRoot, "public/coniferkingdom-images");
const targetJmacImages = path.join(appRoot, "public/jmac-images");
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

function toPublicImagePath(imagePath, marker, publicRoot) {
  const normalizedImagePath = String(imagePath || "").replace(/^data-source[\\/]/, "");
  if (!normalizedImagePath.startsWith(marker)) {
    return null;
  }
  const rest = normalizedImagePath
    .slice(marker.length)
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${publicRoot}/${rest}`;
}

function toRhsPublicImagePath(imagePath) {
  return toPublicImagePath(imagePath, "Resource/园艺/raw/rhs-images/", "/rhs-images");
}

function toMrMaplePublicImagePath(imagePath) {
  return toPublicImagePath(imagePath, "Resource/园艺/raw/mrmaple-images/", "/mrmaple-images");
}

function toHerterPublicImagePath(imagePath) {
  return toPublicImagePath(imagePath, "Resource/园艺/raw/herter-images/", "/herter-images");
}

function toNcsuPublicImagePath(imagePath) {
  return toPublicImagePath(imagePath, "Resource/园艺/raw/ncsu-images/", "/ncsu-images");
}

function toConiferPublicImagePath(imagePath) {
  return toPublicImagePath(imagePath, "Resource/园艺/raw/coniferkingdom-images/", "/coniferkingdom-images");
}

function toJmacPublicImagePath(imagePath) {
  return toPublicImagePath(imagePath, "Resource/园艺/raw/jmac-images/", "/jmac-images");
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function hasContent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
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

function normalizeCultivarToken(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

function getKnownCultivarTokens(record) {
  return new Set(
    [
      record.display_name,
      record.canonical_name,
      record.scientific_name,
      ...(record.aliases || []),
    ]
      .map(normalizeCultivarToken)
      .filter(Boolean),
  );
}

function removePromotionalSentences(text) {
  const sentencePattern = /[^.!?。！？]+[.!?。！？]?/g;
  const promotionalSentencePatterns = [
    /\bfocal point\b/i,
    /\bbackground planting\b/i,
    /\bperfect .* any garden\b/i,
    /\bexcellent addition .* garden\b/i,
    /\bgreat addition .* garden\b/i,
    /\bexcellent choice\b/i,
    /\bshop now\b/i,
    /\bdon['’]t miss\b/i,
    /\bbetter act fast\b/i,
    /\bfor maple fanatics and casual gardeners alike\b/i,
    /\bfavorite(?:s)? to photograph\b/i,
    /\bsure to add\b/i,
    /\bbecome one of (?:our )?favorite/i,
    /\bbring the timeless beauty\b/i,
    /\bfor your garden today\b/i,
    /\badds? a touch of elegance\b/i,
    /\bstriking visual impact\b/i,
    /\bexcellent addition .* collection\b/i,
    /花园中的视觉焦点/,
    /庭园中的视觉焦点/,
    /园林中的视觉焦点/,
    /视觉焦点/,
    /作为(?:庭园|花园)焦点/,
    /任何庭园中的优秀补充/,
    /优秀补充/,
    /不要错过/,
    /请尽快下单/,
    /适合作为庭园观赏植物/,
  ];

  const sentences = String(text || "").match(sentencePattern) || [String(text || "")];
  const filtered = sentences.filter((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return false;
    return !promotionalSentencePatterns.some((pattern) => pattern.test(trimmed));
  });

  return filtered.join(" ").replace(/\s+/g, " ").trim();
}

function cleanDescriptionText(text, record) {
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

  const commerceTailBreaks = [
    /数量有限/i,
    /由于我们拥有上千个日本枫品种/i,
    /单个品种通常库存不多/i,
    /每个品种通常库存不多/i,
    /请尽快下单，以免售罄/i,
    /建议您(?:在看到心仪品种时)?及时购买/i,
    /我们建议您尽快购买/i,
    /部分(?:选育)?品种经常很快售罄/i,
    /某些品种常常很快售罄/i,
    /10 加仑规格植株发货时不带盆/i,
    /请注意，您的 10 加仑植株到货时将不含容器/i,
    /请提前做好接收无容器 10 加仑植株的准备/i,
    /\bLimited Quantities Available\b/i,
    /\bWe have thousands of Japanese maples\b/i,
    /\bBetter act fast before they are gone\b/i,
    /\bWe suggest you buy\b/i,
    /\bsell out quickly\b/i,
    /\b10 GALLON TREE SHIPS WITHOUT POT\b/i,
  ];
  const rightsTailBreaks = [
    /带有\s*MrMaple\s*标志的照片归\s*MrMaple\.com\s*所有/i,
    /本页无\s*MrMaple\s*标志的照片由.*拍摄/i,
    /未经明确书面许可不得使用/i,
    /归\s*MrMaple\.com\s*所有/i,
    /本页不带\s*MrMaple\s*标志的照片由.*拍摄/i,
    /\bThe photo\(s\) with a MrMaple logo are owned by MrMaple\.com\b/i,
    /\bThe photos on this page without a MrMaple logo were taken by\b/i,
    /\bcannot be used without expressed written consent\b/i,
    /\bwithout expressed written consent from the owner\b/i,
  ];

  structuralBreaks.forEach((pattern) => {
    const match = cleaned.match(pattern);
    if (match?.index && match.index > 180) {
      cleaned = cleaned.slice(0, match.index).trim();
    }
  });

  commerceTailBreaks.forEach((pattern) => {
    const match = cleaned.match(pattern);
    if (match?.index && match.index > 80) {
      cleaned = cleaned.slice(0, match.index).trim();
    }
  });

  rightsTailBreaks.forEach((pattern) => {
    const match = cleaned.match(pattern);
    if (match?.index && match.index > 80) {
      cleaned = cleaned.slice(0, match.index).trim();
    }
  });

  const knownTokens = getKnownCultivarTokens(record);
  const quotedCultivarRegex = /'([^'\n]{3,48})'/g;
  let match;

  while ((match = quotedCultivarRegex.exec(cleaned))) {
    if (match.index < 280) continue;

    const token = normalizeCultivarToken(match[1]);
    if (!token || knownTokens.has(token)) continue;

    if (/[A-Z]/.test(match[1]) && token.length > 4) {
      cleaned = cleaned.slice(0, match.index).trim();
      break;
    }
  }

  return removePromotionalSentences(cleaned).replace(/\s+/g, " ").trim();
}

function getDescriptionPenalty(text) {
  if (!hasContent(text)) return 100;

  let penalty = 0;
  const normalized = String(text);

  if (normalized.length > 2400) penalty += 30;
  else if (normalized.length > 1800) penalty += 22;
  else if (normalized.length > 1200) penalty += 14;
  else if (normalized.length > 700) penalty += 8;
  else if (normalized.length > 450) penalty += 3;
  else if (normalized.length >= 120 && normalized.length <= 320) penalty -= 2;

  [
    /pointer-events-auto/i,
    /request-WEB:/i,
    /data-testid=/i,
    /scroll-mt-\[/i,
    /NURSERY SOURCES/i,
    /USDA HARDINESS ZONE/i,
    /This chapter presents/i,
  ].forEach((pattern) => {
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

function sanitizeDescriptions(record) {
  return {
    ...record,
    descriptions: record.descriptions
      ? Object.fromEntries(
        Object.entries(record.descriptions).map(([key, value]) => [key, cleanDescriptionText(value, record)]),
      )
      : record.descriptions,
    descriptions_zh: record.descriptions_zh
      ? Object.fromEntries(
        Object.entries(record.descriptions_zh).map(([key, value]) => [key, cleanDescriptionText(value, record)]),
      )
      : record.descriptions_zh,
    rhs: record.rhs
      ? {
        ...record.rhs,
        description: cleanDescriptionText(record.rhs.description, record),
      }
      : record.rhs,
    rhs_zh: record.rhs_zh
      ? {
        ...record.rhs_zh,
        description: cleanDescriptionText(record.rhs_zh.description, record),
      }
      : record.rhs_zh,
    sources: (record.sources || []).map((source) => ({
      ...source,
      description: cleanDescriptionText(source.description, record),
    })),
    mrmaple: record.mrmaple
      ? {
        ...record.mrmaple,
        products: (record.mrmaple.products || []).map((product) => ({
          ...product,
          description_text: cleanDescriptionText(product.description_text, record),
        })),
      }
      : record.mrmaple,
  };
}

function localizeRecord(record) {
  return {
    ...record,
    descriptions: mergeLocalizedValue(record.descriptions, record.descriptions_zh),
    rhs: mergeLocalizedValue(record.rhs, record.rhs_zh),
  };
}

function cleanMrMapleDescription(text) {
  return cleanDescriptionText(text, {});
}

function getPreferredDescription(record) {
  const candidates = [
    { weight: 7, text: record.descriptions?.preferred },
    { weight: 5, text: record.rhs?.description },
    ...((record.mrmaple?.products || []).map((product) => ({ weight: 3, text: cleanMrMapleDescription(product.description_text) }))),
    ...((record.sources || []).map((source) => ({ weight: 2, text: source.description }))),
  ]
    .map((candidate) => ({
      ...candidate,
      text: cleanDescriptionText(candidate.text, record),
    }))
    .filter((candidate) => hasContent(candidate.text))
    .map((candidate) => ({
      ...candidate,
      score: candidate.weight - getDescriptionPenalty(candidate.text),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.text || "";
}

function getEditorialCover(record) {
  return uniqueValues([
    record.images.public_cover_path,
    ...(record.images.public_rhs_paths || []),
    ...(record.images.public_mrmaple_paths || []),
    ...(record.images.public_herter_paths || []),
    ...(record.images.public_ncsu_paths || []),
    ...(record.images.public_conifer_paths || []),
    ...(record.images.public_jmac_paths || []),
  ])[0] || null;
}

function getCoverSource(record, cover) {
  if (!cover) return "No Image";
  if ((record.images.public_rhs_paths || []).includes(cover)) return "RHS";
  if ((record.images.public_mrmaple_paths || []).includes(cover)) return "Mr Maple";
  if ((record.images.public_herter_paths || []).includes(cover)) return "Herter";
  if ((record.images.public_ncsu_paths || []).includes(cover)) return "NCSU";
  if ((record.images.public_conifer_paths || []).includes(cover)) return "Conifer Kingdom";
  if ((record.images.public_jmac_paths || []).includes(cover)) return "Japanese Maples & Conifers";
  return "No Image";
}

function toPinyinVariants(text) {
  if (!hasContent(text) || !/[\u4e00-\u9fff]/.test(text)) {
    return [];
  }

  const full = pinyin(text, { toneType: "none" });
  const initials = pinyin(text, { pattern: "first", toneType: "none" });

  return uniqueValues([
    full,
    full.replace(/\s+/g, ""),
    initials,
    initials.replace(/\s+/g, ""),
  ]);
}

function buildSearchIndex(record) {
  const values = [
    record.display_name,
    record.canonical_name,
    record.chinese_name,
    record.scientific_name,
    record.species,
    record.top_category,
    record.web_group,
    ...(record.aliases || []),
    ...(record.search_terms || []),
  ].filter(Boolean);

  return uniqueValues([
    ...values,
    ...values.flatMap((value) => toPinyinVariants(value)),
  ]).join("\n").toLowerCase();
}

function buildCatalogRecord(record) {
  const localized = localizeRecord(record);
  const coverPath = getEditorialCover(localized);

  return {
    id: localized.id,
    canonical_name: localized.canonical_name,
    display_name: localized.display_name,
    chinese_name: localized.chinese_name,
    scientific_name: localized.scientific_name,
    species: localized.species,
    top_category: localized.top_category,
    web_group: localized.web_group,
    book_groups: localized.book_groups,
    color_groups: localized.color_groups,
    aliases: localized.aliases,
    search_terms: localized.search_terms,
    search_index: buildSearchIndex(localized),
    preferred_description: getPreferredDescription(localized),
    cover_path: coverPath,
    cover_source: getCoverSource(localized, coverPath),
    image_count: localized.images.public_count || localized.images.count || 0,
    source_count: localized.source_count,
    has_web: localized.has_web,
    has_rhs: localized.has_rhs,
    has_mrmaple: localized.has_mrmaple,
    has_herter: localized.has_herter,
    has_ncsu: localized.has_ncsu,
  };
}

function buildAwardsRecords(catalogRecords) {
  return RHS_AWARD_SELECTIONS
    .map((selection) => {
      const item = catalogRecords.find((record) => record.id === selection.id);
      if (!item) return null;
      return {
        ...item,
        display_name: selection.displayName || item.display_name,
        chinese_name: selection.chineseName || item.chinese_name,
        award_group: selection.awardGroup,
      };
    })
    .filter(Boolean);
}

function buildMeta(records, catalogRecords, awardsRecords) {
  return {
    generated_at: new Date().toISOString(),
    counts: {
      cultivars: records.length,
      catalog: catalogRecords.length,
      awards: awardsRecords.length,
    },
    categories: {
      top_categories: uniqueValues(catalogRecords.map((record) => record.top_category)).sort(chineseCollator.compare),
      web_groups: uniqueValues(catalogRecords.map((record) => record.web_group)).sort(chineseCollator.compare),
      cover_sources: uniqueValues(catalogRecords.map((record) => record.cover_source)),
    },
    locales: ["zh", "en"],
    datasets: {
      catalog: "/data/catalog.json",
      details_dir: "/data/details",
      merged: "/data/merged-cultivars.json",
      awards: "/data/awards.json",
      meta: "/data/meta.json",
    },
  };
}

const chineseCollator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });
const COVER_SOURCE_PRIORITY = {
  rhs: 5,
  mrmaple: 4,
  herter: 3,
  ncsu: 2,
  conifer: 1,
  jmac: 1,
};
const imageMetadataCache = new Map();
const imagePathRewriteCache = new Map();

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function getAbsoluteLocalPath(localPath) {
  if (!localPath) return null;

  const normalized = String(localPath);
  if (path.isAbsolute(normalized)) {
    return normalized;
  }
  if (normalized.startsWith("data-source/")) {
    return path.join(appRoot, normalized);
  }
  return path.join(sourceRoot, normalized);
}

function parsePngSize(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseGifSize(buffer) {
  if (buffer.length < 10 || (buffer.toString("ascii", 0, 6) !== "GIF87a" && buffer.toString("ascii", 0, 6) !== "GIF89a")) {
    return null;
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function parseWebpSize(buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8 ") {
    if (buffer.length < 30) return null;
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L") {
    if (buffer.length < 25) return null;
    const value = buffer.readUInt32LE(21);
    return {
      width: (value & 0x3fff) + 1,
      height: ((value >> 14) & 0x3fff) + 1,
    };
  }

  if (chunkType === "VP8X") {
    if (buffer.length < 30) return null;
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  return null;
}

function detectImageFormat(buffer) {
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }

  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    return "png";
  }

  if (buffer.length >= 6 && (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) {
    return "gif";
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "jpg";
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") {
      return "avif";
    }
  }

  return null;
}

function parseJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    if (offset + 4 > buffer.length) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      return null;
    }

    const isSofMarker = (
      (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    );

    if (isSofMarker) {
      if (offset + 9 >= buffer.length) {
        return null;
      }
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function parseImageSize(buffer) {
  return parsePngSize(buffer) || parseGifSize(buffer) || parseWebpSize(buffer) || parseJpegSize(buffer);
}

async function readImageMetadata(localPath) {
  const absolutePath = getAbsoluteLocalPath(localPath);
  if (!absolutePath) return null;
  if (imageMetadataCache.has(absolutePath)) {
    return imageMetadataCache.get(absolutePath);
  }

  let metadata = null;

  try {
    const handle = await fs.open(absolutePath, "r");
    try {
      const stat = await handle.stat();
      const sampleLength = Math.min(stat.size, 256 * 1024);
      const header = Buffer.alloc(sampleLength);
      await handle.read(header, 0, sampleLength, 0);

      let size = parseImageSize(header);
      if (!size && stat.size > sampleLength) {
        const full = await fs.readFile(absolutePath);
        size = parseImageSize(full);
      }

      metadata = size
        ? { ...size, bytes: stat.size }
        : { width: null, height: null, bytes: stat.size };
    } finally {
      await handle.close();
    }
  } catch {
    metadata = null;
  }

  imageMetadataCache.set(absolutePath, metadata);
  return metadata;
}

function replacePathReferences(value, fromPath, toPath) {
  if (value === fromPath) {
    return toPath;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePathReferences(item, fromPath, toPath));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replacePathReferences(item, fromPath, toPath)]),
    );
  }

  return value;
}

async function normalizeImageFilePath(localPath) {
  if (!localPath) return localPath;
  if (imagePathRewriteCache.has(localPath)) {
    return imagePathRewriteCache.get(localPath);
  }

  const absolutePath = getAbsoluteLocalPath(localPath);
  if (!absolutePath || !(await pathExists(absolutePath))) {
    imagePathRewriteCache.set(localPath, localPath);
    return localPath;
  }

  const stat = await fs.stat(absolutePath);
  const sampleLength = Math.min(stat.size, 64);
  const handle = await fs.open(absolutePath, "r");
  let header;

  try {
    header = Buffer.alloc(sampleLength);
    await handle.read(header, 0, sampleLength, 0);
  } finally {
    await handle.close();
  }

  const detectedFormat = detectImageFormat(header);
  if (!detectedFormat) {
    imagePathRewriteCache.set(localPath, localPath);
    return localPath;
  }

  const currentExt = path.extname(absolutePath).toLowerCase();
  const normalizedExt = currentExt === ".jpeg" ? ".jpg" : currentExt;
  const desiredExt = `.${detectedFormat}`;

  if (normalizedExt === desiredExt) {
    imagePathRewriteCache.set(localPath, localPath);
    return localPath;
  }

  const nextAbsolutePath = `${absolutePath.slice(0, -path.extname(absolutePath).length)}${desiredExt}`;
  if (!(await pathExists(nextAbsolutePath))) {
    await fs.rename(absolutePath, nextAbsolutePath);
  }

  imageMetadataCache.delete(absolutePath);
  imageMetadataCache.delete(nextAbsolutePath);

  const nextLocalPath = path.relative(appRoot, nextAbsolutePath);
  imagePathRewriteCache.set(localPath, nextLocalPath);
  return nextLocalPath;
}

async function normalizeRecordImagePaths(records) {
  const sourceKeys = ["rhs", "mrmaple", "herter", "ncsu", "conifer_kingdom", "jmac"];
  let changed = false;

  for (let index = 0; index < records.length; index += 1) {
    let record = records[index];
    const localPaths = uniqueValues(
      sourceKeys.flatMap((sourceKey) => getSourceLocalFiles(record, sourceKey)),
    );

    for (const localPath of localPaths) {
      const nextLocalPath = await normalizeImageFilePath(localPath);
      if (nextLocalPath !== localPath) {
        record = replacePathReferences(record, localPath, nextLocalPath);
        changed = true;
      }
    }

    records[index] = record;
  }

  return changed;
}

function getSourceImageItems(record, sourceKey) {
  if (sourceKey === "rhs") {
    return ((record.rhs || {}).images || {}).download_items || [];
  }
  return (((record[sourceKey] || {}).images) || {}).download_items || [];
}

function getSourceLocalFiles(record, sourceKey) {
  if (sourceKey === "rhs") {
    return (((record.rhs || {}).images) || {}).local_files || [];
  }
  return ((record[sourceKey] || {}).local_files) || [];
}

async function getFallbackSourceLocalFiles(record, sourceKey) {
  const sourceDirByKey = {
    mrmaple: sourceMrMapleImages,
    herter: sourceHerterImages,
    ncsu: sourceNcsuImages,
    conifer_kingdom: sourceConiferImages,
    jmac: sourceJmacImages,
  };

  const sourceDir = sourceDirByKey[sourceKey];
  if (!sourceDir || !record?.id) {
    return [];
  }

  const recordDir = path.join(sourceDir, record.id);
  if (!(await pathExists(recordDir))) {
    return [];
  }

  const entries = await fs.readdir(recordDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(appRoot, path.join(recordDir, entry.name)))
    .sort((left, right) => left.localeCompare(right));
}

async function getEffectiveSourceLocalFiles(record, sourceKey) {
  const configuredFiles = getSourceLocalFiles(record, sourceKey);
  if (configuredFiles.length) {
    return configuredFiles;
  }

  return getFallbackSourceLocalFiles(record, sourceKey);
}

async function buildCoverCandidates(record) {
  const sourceConfigs = [
    { recordKey: "rhs", scoreKey: "rhs", toPublic: toRhsPublicImagePath },
    { recordKey: "mrmaple", scoreKey: "mrmaple", toPublic: toMrMaplePublicImagePath },
    { recordKey: "herter", scoreKey: "herter", toPublic: toHerterPublicImagePath },
    { recordKey: "ncsu", scoreKey: "ncsu", toPublic: toNcsuPublicImagePath },
    { recordKey: "conifer_kingdom", scoreKey: "conifer", toPublic: toConiferPublicImagePath },
    { recordKey: "jmac", scoreKey: "jmac", toPublic: toJmacPublicImagePath },
  ];

  const candidates = [];

  for (const source of sourceConfigs) {
    const localFiles = await getEffectiveSourceLocalFiles(record, source.recordKey);
    const imageItems = getSourceImageItems(record, source.recordKey);
    const bytesByPath = new Map(
      imageItems
        .filter((item) => item.local_path)
        .map((item) => [item.local_path, item.bytes || 0]),
    );

    for (const localPath of localFiles) {
      const publicPath = source.toPublic(localPath);
      if (!publicPath) continue;

      const metadata = await readImageMetadata(localPath);
      const width = metadata?.width || 0;
      const height = metadata?.height || 0;
      candidates.push({
        publicPath,
        localPath,
        sourceKey: source.scoreKey,
        width,
        height,
        area: width * height,
        bytes: metadata?.bytes || bytesByPath.get(localPath) || 0,
        priority: COVER_SOURCE_PRIORITY[source.scoreKey] || 0,
      });
    }
  }

  return candidates;
}

async function pickBestCoverPath(record) {
  const candidates = await buildCoverCandidates(record);
  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => (
    right.area - left.area
    || right.bytes - left.bytes
    || right.priority - left.priority
    || left.publicPath.localeCompare(right.publicPath)
  ));

  return candidates[0].publicPath;
}

async function syncJson() {
  const sourceJson = await fs
    .access(enhancedJson)
    .then(() => enhancedJson)
    .catch(() => fallbackJson);
  const raw = await fs.readFile(sourceJson, "utf8");
  const sourceRecords = JSON.parse(raw);
  const normalizedPathsChanged = await normalizeRecordImagePaths(sourceRecords);

  if (normalizedPathsChanged) {
    await fs.writeFile(sourceJson, JSON.stringify(sourceRecords, null, 2), "utf8");
  }

  const recordsWithPublicImages = await Promise.all(sourceRecords.map(async (record) => ({
    ...record,
    images: {
      count: record.images?.count || 0,
      public_rhs_paths: uniquePaths(
        (((record.rhs || {}).images || {}).local_files || []).map((item) => toRhsPublicImagePath(item)),
      ),
      public_mrmaple_paths: uniquePaths(
        (await getEffectiveSourceLocalFiles(record, "mrmaple")).map((item) => toMrMaplePublicImagePath(item)),
      ),
      public_herter_paths: uniquePaths(
        (await getEffectiveSourceLocalFiles(record, "herter")).map((item) => toHerterPublicImagePath(item)),
      ),
      public_ncsu_paths: uniquePaths(
        (await getEffectiveSourceLocalFiles(record, "ncsu")).map((item) => toNcsuPublicImagePath(item)),
      ),
      public_conifer_paths: uniquePaths(
        (await getEffectiveSourceLocalFiles(record, "conifer_kingdom")).map((item) => toConiferPublicImagePath(item)),
      ),
      public_jmac_paths: uniquePaths(
        (await getEffectiveSourceLocalFiles(record, "jmac")).map((item) => toJmacPublicImagePath(item)),
      ),
    },
  })));
  const records = await Promise.all(recordsWithPublicImages.map(async (record) => {
    const publicPaths = uniquePaths([
      ...(record.images.public_rhs_paths || []),
      ...(record.images.public_mrmaple_paths || []),
      ...(record.images.public_herter_paths || []),
      ...(record.images.public_ncsu_paths || []),
      ...(record.images.public_conifer_paths || []),
      ...(record.images.public_jmac_paths || []),
    ]);
    const bestCoverPath = await pickBestCoverPath(record);
    return {
      ...record,
      images: {
        ...record.images,
        public_cover_path: bestCoverPath || publicPaths[0] || null,
        public_paths: publicPaths,
        public_count: publicPaths.length,
      },
    };
  }));
  const sanitizedRecords = records.map((record) => sanitizeDescriptions(record));
  const catalogRecords = sanitizedRecords.map((record) => buildCatalogRecord(record));
  const awardsRecords = buildAwardsRecords(catalogRecords);
  const meta = buildMeta(sanitizedRecords, catalogRecords, awardsRecords);
  await ensureDir(path.dirname(targetJson));
  await fs.rm(targetDetailsDir, { recursive: true, force: true });
  await ensureDir(targetDetailsDir);
  await fs.writeFile(targetJson, JSON.stringify(sanitizedRecords, null, 2), "utf8");
  await fs.writeFile(targetCatalogJson, JSON.stringify(catalogRecords, null, 2), "utf8");
  await fs.writeFile(targetMetaJson, JSON.stringify(meta, null, 2), "utf8");
  await fs.writeFile(targetAwardsJson, JSON.stringify(awardsRecords, null, 2), "utf8");
  await Promise.all(
    sanitizedRecords.map((record) => (
      fs.writeFile(
        path.join(targetDetailsDir, `${record.id}.json`),
        JSON.stringify(record, null, 2),
        "utf8",
      )
    )),
  );
  return sourceJson;
}

async function syncDirLink(sourceDir, targetDir) {
  try {
    const current = await fs.lstat(targetDir);
    if (current.isSymbolicLink()) {
      await fs.unlink(targetDir);
    } else {
      await fs.rm(targetDir, { recursive: true, force: true });
    }
  } catch {}

  if (!(await pathExists(sourceDir))) {
    return false;
  }

  await fs.symlink(sourceDir, targetDir, "dir");
  return true;
}

const chosenJson = await syncJson();
const linkResults = await Promise.all([
  syncDirLink(sourceRhsImages, targetRhsImages).then((linked) => ["rhs-images", linked]),
  syncDirLink(sourceMrMapleImages, targetMrMapleImages).then((linked) => ["mrmaple-images", linked]),
  syncDirLink(sourceHerterImages, targetHerterImages).then((linked) => ["herter-images", linked]),
  syncDirLink(sourceNcsuImages, targetNcsuImages).then((linked) => ["ncsu-images", linked]),
  syncDirLink(sourceConiferImages, targetConiferImages).then((linked) => ["coniferkingdom-images", linked]),
  syncDirLink(sourceJmacImages, targetJmacImages).then((linked) => ["jmac-images", linked]),
]);
const linkedDirs = linkResults.filter(([, linked]) => linked).map(([name]) => name);
const skippedDirs = linkResults.filter(([, linked]) => !linked).map(([name]) => name);
console.log(`synced ${path.basename(chosenJson)} and image directories`);
if (linkedDirs.length) {
  console.log(`linked: ${linkedDirs.join(", ")}`);
}
if (skippedDirs.length) {
  console.log(`skipped missing image sources: ${skippedDirs.join(", ")}`);
}
