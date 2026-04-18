import fs from "node:fs/promises";
import path from "node:path";
import {
  coniferImagesRoot,
  decodeHtmlEntities,
  downloadBinary,
  ensureDir,
  fetchText,
  hasContent,
  hasFlag,
  loadRecords,
  parseIdsFilter,
  parseLimit,
  sanitizePathSegment,
  saveRecords,
  sourceRoot,
  stripHtml,
  uniqueValues,
} from "./fetch-image-common.mjs";

const PRODUCT_SITEMAP_URL = "https://www.coniferkingdom.com/product-sitemap.xml";
const MATCH_REPORT_PATH = path.join(sourceRoot, "Resource/园艺/raw/conifer-match-report.json");
const MAX_IMAGES_PER_PRODUCT = 8;
const CULTIVAR_STOPWORDS = new Set([
  "acer",
  "maple",
  "japanese",
  "tree",
  "trees",
  "cultivar",
  "cultivars",
  "plant",
  "plants",
  "specimen",
  "dwarf",
  "upright",
  "lace",
  "laceleaf",
  "leaf",
  "leafed",
  "green",
  "red",
  "orange",
  "yellow",
  "purple",
  "pink",
  "gold",
  "silver",
  "variegated",
]);
const SPECIES_STOPWORDS = new Set([
  "palmatum",
  "japonicum",
  "shirasawanum",
  "sieboldianum",
  "pictum",
  "circinatum",
  "pseudosieboldianum",
  "buergerianum",
  "campestre",
  "platanoides",
  "pseudoplatanus",
  "saccharum",
  "tataricum",
  "truncatum",
  "pycnanthum",
  "carpinifolium",
  "crataegifolium",
  "diabolicum",
  "morifolium",
  "maximowiczianum",
  "oliverianum",
  "conspicuum",
  "laevigatum",
  "tenuifolium",
]);

function normalizePhrase(value) {
  return decodeHtmlEntities(String(value || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .toLowerCase()
    .trim();
}

function normalizeCompact(value) {
  return normalizePhrase(value).replace(/\s+/g, "");
}

function stripBotanicalPrefix(value) {
  return value
    .replace(/^acer\s+[a-z]+(?:\s+(?:subsp|var)\.?\s+[a-z-]+)?\s+/i, "")
    .trim();
}

function stripCultivarQuotes(value) {
  return value.replace(/^'+|'+$/g, "").trim();
}

function stripTrailingDescriptors(value) {
  return value
    .replace(/\b(japanese maple|japanese maples|maple tree|maple trees|cultivar|cultivars)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLatinSearchTerms(record) {
  return uniqueValues(
    [
      record.display_name,
      record.canonical_name,
      record.scientific_name,
      ...(record.aliases || []),
      ...(record.search_terms || []),
    ]
      .map((value) => String(value || "").trim())
      .filter((value) => value && /[A-Za-z]/.test(value) && !/[\u4e00-\u9fff]/.test(value)),
  );
}

function getSpeciesToken(record) {
  const source = normalizePhrase(record.scientific_name || record.species || "");
  const parts = source.split(/\s+/).filter(Boolean);
  return parts[1] && !SPECIES_STOPWORDS.has(parts[1]) ? parts[1] : parts[1] || "";
}

function buildCultivarPhrases(record) {
  const rawTerms = getLatinSearchTerms(record);
  const phrases = new Set();

  rawTerms.forEach((term) => {
    const normalized = normalizePhrase(term);
    const candidates = [
      normalized,
      stripBotanicalPrefix(normalized),
      stripCultivarQuotes(stripBotanicalPrefix(normalized)),
      stripTrailingDescriptors(stripCultivarQuotes(stripBotanicalPrefix(normalized))),
    ];

    candidates.forEach((candidate) => {
      const clean = candidate.trim();
      if (!clean) return;
      if (clean === "acer") return;
      if (SPECIES_STOPWORDS.has(clean)) return;
      if (clean === normalizePhrase(record.species || "")) return;
      phrases.add(clean);
    });
  });

  return [...phrases]
    .filter((phrase) => phrase.length >= 4)
    .sort((a, b) => b.length - a.length);
}

function getDistinctiveTokens(record) {
  return uniqueValues(
    buildCultivarPhrases(record)
      .flatMap((phrase) => phrase.split(/\s+/))
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !CULTIVAR_STOPWORDS.has(token) && !SPECIES_STOPWORDS.has(token)),
  );
}

function getLocalImageCount(record) {
  return ((record.rhs?.images?.local_files || []).length)
    + ((record.mrmaple?.local_files || []).length)
    + ((record.herter?.local_files || []).length)
    + ((record.ncsu?.local_files || []).length)
    + ((record.conifer_kingdom?.local_files || []).length);
}

function extractSitemapEntries(xml) {
  const entries = [];

  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = match[1];
    const locMatch = block.match(/<loc>(.*?)<\/loc>/);
    if (!locMatch) continue;

    const loc = decodeHtmlEntities(locMatch[1]);
    if (loc.includes("/products/")) continue;

    const images = uniqueValues(
      [...block.matchAll(/<image:loc>(.*?)<\/image:loc>/g)]
        .map((entry) => decodeHtmlEntities(entry[1]))
        .filter((imageUrl) => (
          imageUrl.includes("/wp-content/uploads/")
          && !imageUrl.includes("/needed/")
          && !imageUrl.includes("favicon")
        )),
    ).slice(0, MAX_IMAGES_PER_PRODUCT);

    if (!images.length) continue;

    const slug = decodeURIComponent(new URL(loc).pathname.replace(/^\/|\/$/g, ""));
    const slugNormalized = normalizePhrase(slug);
    if (!slugNormalized.includes("acer")) continue;

    entries.push({
      url: loc,
      slug,
      slugNormalized,
      slugCompact: slugNormalized.replace(/\s+/g, ""),
      images,
    });
  }

  return entries;
}

function scoreEntry(record, entry) {
  const cultivarPhrases = buildCultivarPhrases(record);
  const distinctiveTokens = getDistinctiveTokens(record);
  const hasMultiWordPhrase = cultivarPhrases.some((phrase) => (
    phrase
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !CULTIVAR_STOPWORDS.has(token) && !SPECIES_STOPWORDS.has(token))
      .length >= 2
  ));
  const species = normalizePhrase(record.species || "");
  const speciesToken = getSpeciesToken(record);

  if (species && species.includes("acer") && !entry.slugNormalized.includes("acer")) {
    return { score: 0 };
  }

  if (speciesToken && !entry.slugNormalized.includes(speciesToken)) {
    return { score: 0 };
  }

  let bestScore = 0;
  let matchedPhrase = "";
  let matchedTokens = [];

  for (const phrase of cultivarPhrases) {
    const compact = normalizeCompact(phrase);
    if (!compact || compact.length < 4) continue;

    if (entry.slugCompact.includes(compact)) {
      const score = 240 + compact.length;
      if (score > bestScore) {
        bestScore = score;
        matchedPhrase = phrase;
        matchedTokens = [];
      }
      continue;
    }

    const tokens = phrase
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !CULTIVAR_STOPWORDS.has(token) && !SPECIES_STOPWORDS.has(token));

    if (tokens.length >= 2 && tokens.every((token) => entry.slugNormalized.includes(token))) {
      const score = 180 + tokens.reduce((sum, token) => sum + token.length, 0);
      if (score > bestScore) {
        bestScore = score;
        matchedPhrase = phrase;
        matchedTokens = tokens;
      }
    }
  }

  if (!bestScore && !hasMultiWordPhrase) {
    const longTokens = distinctiveTokens.filter((token) => token.length >= 6 && entry.slugNormalized.includes(token));
    if (longTokens.length >= 2) {
      bestScore = 140 + longTokens.reduce((sum, token) => sum + token.length, 0);
      matchedTokens = longTokens;
    } else if (longTokens.length === 1 && longTokens[0].length >= 8) {
      bestScore = 110 + longTokens[0].length;
      matchedTokens = longTokens;
    }
  }

  return {
    score: bestScore,
    matchedPhrase,
    matchedTokens,
  };
}

function selectBestEntry(record, entries) {
  const ranked = entries
    .map((entry) => ({
      ...entry,
      ...scoreEntry(record, entry),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const [best, second] = ranked;
  if (!best) return null;

  if (best.score >= 240) return best;
  if (best.score >= 190 && (!second || best.score - second.score >= 20)) return best;
  if (best.score >= 155 && best.matchedTokens.length >= 2 && (!second || best.score - second.score >= 30)) {
    return best;
  }

  return null;
}

function extractMetaContent(html, name) {
  const match = html.match(new RegExp(`<meta[^>]+${name}="description"[^>]+content="([^"]+)"`, "i"));
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function extractProductTitle(html) {
  const match = html.match(/<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]) : "";
}

async function fetchProductMeta(url) {
  try {
    const html = await fetchText(url);
    return {
      name: extractProductTitle(html) || decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || ""),
      description_text: extractMetaContent(html, "name"),
    };
  } catch {
    return {
      name: decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || ""),
      description_text: "",
    };
  }
}

async function downloadImages(record, entry, dryRun) {
  const targetDir = path.join(coniferImagesRoot, sanitizePathSegment(record.id));
  if (!dryRun) {
    await ensureDir(targetDir);
  }

  const localFiles = [];
  const downloadItems = [];

  for (const [index, imageUrl] of entry.images.entries()) {
    const cleanUrl = imageUrl.split("?")[0];
    const numberedName = `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(path.basename(cleanUrl) || "image")}`;
    const targetPath = path.join(targetDir, numberedName);
    const localPath = path.relative(process.cwd(), targetPath);

    let downloadMeta = {
      bytes: 0,
      contentType: "image/jpeg",
    };

    if (!dryRun) {
      downloadMeta = await downloadBinary(imageUrl, targetPath, { referer: entry.url });
    }

    localFiles.push(localPath);
    downloadItems.push({
      index: index + 1,
      source_url: imageUrl,
      source_page_url: entry.url,
      local_path: localPath,
      bytes: downloadMeta.bytes,
      content_type: downloadMeta.contentType,
      downloaded_at: new Date().toISOString(),
      status: dryRun ? "planned" : "downloaded",
      source_name: "Conifer Kingdom",
      usage_note: "Source-hosted product imagery from Conifer Kingdom. Confirm reuse rights before redistribution.",
    });
  }

  const meta = await fetchProductMeta(entry.url);

  record.conifer_kingdom = {
    source_name: "Conifer Kingdom",
    detail_url: entry.url,
    matched_product_count: 1,
    local_file_count: localFiles.length,
    cover_path: localFiles[0] || null,
    local_files: localFiles,
    products: [
      {
        name: meta.name,
        product_url: entry.url,
        botanical_name: record.scientific_name || record.canonical_name || record.display_name,
        common_name: record.display_name || record.canonical_name || "",
        description_text: meta.description_text,
        match_method: "product_sitemap_slug",
        match_candidate: entry.matchedPhrase || entry.matchedTokens.join(" "),
        match_score: entry.score,
      },
    ],
    images: {
      download_items: downloadItems,
      downloaded_count: localFiles.length,
      local_files: localFiles,
    },
  };

  record.sources = [
    ...(record.sources || []).filter((source) => source.source !== "conifer_kingdom"),
    {
      source: "conifer_kingdom",
      name: meta.name || record.display_name,
      botanical_name: record.scientific_name || record.display_name,
      detail_url: entry.url,
      image_count: localFiles.length,
      usage_note: "Source-hosted product imagery from Conifer Kingdom. Confirm reuse rights before redistribution.",
    },
  ];
  record.source_count = record.sources.length;

  return {
    downloaded: localFiles.length,
    match_score: entry.score,
    matched_phrase: entry.matchedPhrase || entry.matchedTokens.join(" "),
    product_url: entry.url,
  };
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function buildCandidates(records, idsFilter, force) {
  return records.filter((record) => {
    if (idsFilter && !idsFilter.has(record.id)) return false;
    if (!force && getLocalImageCount(record) > 0) return false;
    return getLatinSearchTerms(record).length > 0;
  });
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const idsFilter = parseIdsFilter();
  const limit = parseLimit(400);
  const records = await loadRecords();
  const candidates = buildCandidates(records, idsFilter, force).slice(0, limit);
  const xml = await fetchText(PRODUCT_SITEMAP_URL);
  const entries = extractSitemapEntries(xml);
  const report = {
    generated_at: new Date().toISOString(),
    sitemap_entries: entries.length,
    total_candidates: candidates.length,
    matched: [],
    unmatched: [],
  };

  console.log(`Conifer candidates: ${candidates.length}, sitemap entries: ${entries.length}`);

  let matchedRecords = 0;
  let downloadedImages = 0;

  for (const record of candidates) {
    try {
      const selected = selectBestEntry(record, entries);
      if (!selected) {
        report.unmatched.push({
          id: record.id,
          display_name: record.display_name,
        });
        console.log(`${record.id}: no confident Conifer match`);
        continue;
      }

      const result = await downloadImages(record, selected, dryRun);
      report.matched.push({
        id: record.id,
        display_name: record.display_name,
        product_url: result.product_url,
        match_score: result.match_score,
        match_phrase: result.matched_phrase,
        downloaded_count: result.downloaded,
      });
      matchedRecords += 1;
      downloadedImages += result.downloaded;
      console.log(`${record.id}: matched ${result.matched_phrase || "slug"}, downloaded ${result.downloaded}`);
    } catch (error) {
      report.unmatched.push({
        id: record.id,
        display_name: record.display_name,
        error: error.message,
      });
      console.error(`${record.id}: ${error.message}`);
    }
  }

  if (!dryRun) {
    await saveRecords(records);
    await writeJson(MATCH_REPORT_PATH, report);
  }

  console.log(`Conifer done. records=${matchedRecords}, images=${downloadedImages}, dryRun=${dryRun}`);
}

await main();
