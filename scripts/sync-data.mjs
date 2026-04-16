import fs from "node:fs/promises";
import path from "node:path";
import { pinyin } from "pinyin-pro";

const appRoot = process.cwd();
const sourceRoot = path.join(appRoot, "data-source");
const enhancedJson = path.join(sourceRoot, "Resource/园艺/raw/merged-cultivars-with-rhs.json");
const fallbackJson = path.join(sourceRoot, "Resource/园艺/raw/merged-cultivars.json");
const sourceImages = path.join(sourceRoot, "Resource/园艺/枫树品种合集/图片");
const sourceRhsImages = path.join(sourceRoot, "Resource/园艺/raw/rhs-images");
const sourceMrMapleImages = path.join(sourceRoot, "Resource/园艺/raw/mrmaple-images");
const sourceHerterImages = path.join(sourceRoot, "Resource/园艺/raw/herter-images");
const sourceNcsuImages = path.join(sourceRoot, "Resource/园艺/raw/ncsu-images");
const targetJson = path.join(appRoot, "public/data/merged-cultivars.json");
const targetCatalogJson = path.join(appRoot, "public/data/catalog.json");
const targetDetailsDir = path.join(appRoot, "public/data/details");
const targetImages = path.join(appRoot, "public/maple-images");
const targetRhsImages = path.join(appRoot, "public/rhs-images");
const targetMrMapleImages = path.join(appRoot, "public/mrmaple-images");
const targetHerterImages = path.join(appRoot, "public/herter-images");
const targetNcsuImages = path.join(appRoot, "public/ncsu-images");

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

function toOriginalPublicImagePath(imagePath) {
  return toPublicImagePath(imagePath, "Resource/园艺/枫树品种合集/图片/", "/maple-images");
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

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
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

  structuralBreaks.forEach((pattern) => {
    const match = cleaned.match(pattern);
    if (match?.index && match.index > 180) {
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

  return cleaned.replace(/\s+/g, " ").trim();
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
    ...(record.images.public_rhs_paths || []),
    ...(record.images.public_mrmaple_paths || []),
    ...(record.images.public_herter_paths || []),
    ...(record.images.public_ncsu_paths || []),
    ...(record.images.public_original_paths || []),
    record.images.public_cover_path,
  ])[0] || null;
}

function getCoverSource(record, cover) {
  if (!cover) return "No Image";
  if ((record.images.public_rhs_paths || []).includes(cover)) return "RHS";
  if ((record.images.public_mrmaple_paths || []).includes(cover)) return "Mr Maple";
  if ((record.images.public_herter_paths || []).includes(cover)) return "Herter";
  if ((record.images.public_ncsu_paths || []).includes(cover)) return "NCSU";
  return "Local";
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

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function syncJson() {
  const sourceJson = await fs
    .access(enhancedJson)
    .then(() => enhancedJson)
    .catch(() => fallbackJson);
  const raw = await fs.readFile(sourceJson, "utf8");
  const records = JSON.parse(raw).map((record) => ({
    ...record,
    images: {
      ...record.images,
      public_original_cover_path: record.has_web
        ? null
        : (
          record.images.cover_path
            ? toOriginalPublicImagePath(record.images.cover_path)
            : null
        ),
      public_original_paths: record.has_web
        ? []
        : uniquePaths(
          (record.images.paths || []).map((item) => toOriginalPublicImagePath(item)),
        ),
      public_rhs_paths: uniquePaths(
        (((record.rhs || {}).images || {}).local_files || []).map((item) => toRhsPublicImagePath(item)),
      ),
      public_mrmaple_paths: uniquePaths(
        (((record.mrmaple || {}).local_files) || []).map((item) => toMrMaplePublicImagePath(item)),
      ),
      public_herter_paths: uniquePaths(
        (((record.herter || {}).local_files) || []).map((item) => toHerterPublicImagePath(item)),
      ),
      public_ncsu_paths: uniquePaths(
        (((record.ncsu || {}).local_files) || []).map((item) => toNcsuPublicImagePath(item)),
      ),
    },
  })).map((record) => {
    const publicPaths = uniquePaths([
      record.images.public_original_cover_path,
      ...(record.images.public_original_paths || []),
      ...(record.images.public_rhs_paths || []),
      ...(record.images.public_mrmaple_paths || []),
      ...(record.images.public_herter_paths || []),
      ...(record.images.public_ncsu_paths || []),
    ]);
    return {
      ...record,
      images: {
        ...record.images,
        public_cover_path: publicPaths[0] || null,
        public_paths: publicPaths,
        public_count: publicPaths.length,
      },
    };
  }).map((record) => sanitizeDescriptions(record));
  const catalogRecords = records.map((record) => buildCatalogRecord(record));
  await ensureDir(path.dirname(targetJson));
  await fs.rm(targetDetailsDir, { recursive: true, force: true });
  await ensureDir(targetDetailsDir);
  await fs.writeFile(targetJson, JSON.stringify(records, null, 2), "utf8");
  await fs.writeFile(targetCatalogJson, JSON.stringify(catalogRecords, null, 2), "utf8");
  await Promise.all(
    records.map((record) => (
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
    await fs.lstat(targetDir);
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch {}
  await fs.symlink(sourceDir, targetDir, "dir");
}

const chosenJson = await syncJson();
await syncDirLink(sourceImages, targetImages);
await syncDirLink(sourceRhsImages, targetRhsImages);
await syncDirLink(sourceMrMapleImages, targetMrMapleImages);
await syncDirLink(sourceHerterImages, targetHerterImages);
await syncDirLink(sourceNcsuImages, targetNcsuImages);
console.log(`synced ${path.basename(chosenJson)} and image directories`);
