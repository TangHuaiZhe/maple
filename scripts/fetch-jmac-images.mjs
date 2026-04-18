import fs from "node:fs/promises";
import path from "node:path";
import {
  decodeHtmlEntities,
  downloadBinary,
  ensureDir,
  fetchJson,
  hasFlag,
  jmacImagesRoot,
  loadRecords,
  parseIdsFilter,
  parseLimit,
  sanitizePathSegment,
  saveRecords,
  sourceRoot,
  stripHtml,
  uniqueValues,
} from "./fetch-image-common.mjs";

const BASE_URL = "https://japanesemaplesandconifers.com";
const MATCH_REPORT_PATH = path.join(sourceRoot, "Resource/园艺/raw/jmac-match-report.json");
const PRODUCTS_PAGE_SIZE = 250;
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
  "weeping",
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
  "reticulated",
  "rare",
  "cold",
  "tolerant",
  "strap",
  "bark",
  "coral",
  "full",
  "moon",
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
  "x",
]);

function normalizePhrase(value) {
  return decodeHtmlEntities(String(value || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "'")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .toLowerCase()
    .trim();
}

function normalizeCompact(value) {
  return normalizePhrase(value).replace(/\s+/g, "");
}

function stripBotanicalPrefix(value) {
  return value
    .replace(/^acer\s+[a-z]+(?:\s+x)?(?:\s+(?:subsp|var)\.?\s+[a-z-]+)?\s+/i, "")
    .trim();
}

function stripTrailingDescriptors(value) {
  return value
    .replace(/\b(japanese maple|japanese maples|maple tree|maple trees|cultivar|cultivars|tree|trees)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuotedPhrases(value) {
  const text = decodeHtmlEntities(String(value || ""));
  const matches = [];

  for (const match of text.matchAll(/['‘’"]([^'‘’"]{2,80})['‘’"]/g)) {
    matches.push(match[1]);
  }

  return uniqueValues(matches);
}

function isUsefulPhrase(value) {
  const normalized = normalizePhrase(value);
  if (!normalized || normalized.length < 4) return false;
  if (SPECIES_STOPWORDS.has(normalized)) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;

  const distinctiveTokens = tokens.filter((token) => (
    token.length >= 4
    && !CULTIVAR_STOPWORDS.has(token)
    && !SPECIES_STOPWORDS.has(token)
  ));

  return distinctiveTokens.length > 0;
}

function dedupePhraseEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const compact = normalizeCompact(entry.phrase);
    if (!compact || seen.has(compact)) return false;
    seen.add(compact);
    return true;
  });
}

function getPrimaryPhraseEntries(record) {
  const rawEntries = [
    { phrase: record.display_name, priority: 3, source: "display_name" },
    { phrase: record.canonical_name, priority: 3, source: "canonical_name" },
    ...extractQuotedPhrases(record.scientific_name).map((phrase) => ({
      phrase,
      priority: 3,
      source: "scientific_name",
    })),
  ];

  return dedupePhraseEntries(
    rawEntries
      .map((entry) => ({
        ...entry,
        phrase: stripTrailingDescriptors(stripBotanicalPrefix(String(entry.phrase || "").trim())),
      }))
      .filter((entry) => isUsefulPhrase(entry.phrase)),
  );
}

function getSecondaryPhraseEntries(record, primaryEntries) {
  const primaryCompacts = primaryEntries.map((entry) => normalizeCompact(entry.phrase));

  const rawEntries = (record.aliases || [])
    .filter((value) => value && /[A-Za-z]/.test(value) && !/[\u4e00-\u9fff]/.test(value))
    .flatMap((value) => {
      const alias = String(value || "").trim();
      const candidates = [
        alias,
        stripTrailingDescriptors(stripBotanicalPrefix(alias)),
        ...extractQuotedPhrases(alias),
      ];
      return uniqueValues(candidates).map((phrase) => ({
        phrase,
        priority: 2,
        source: "alias",
      }));
    });

  return dedupePhraseEntries(
    rawEntries
      .map((entry) => ({
        ...entry,
        phrase: stripTrailingDescriptors(stripBotanicalPrefix(String(entry.phrase || "").trim())),
      }))
      .filter((entry) => {
        if (!isUsefulPhrase(entry.phrase)) return false;

        const compact = normalizeCompact(entry.phrase);
        return !primaryCompacts.some((primaryCompact) => (
          primaryCompact === compact
          || primaryCompact.includes(compact)
        ));
      }),
  );
}

function buildCultivarPhrases(record) {
  const primaryEntries = getPrimaryPhraseEntries(record);
  const secondaryEntries = getSecondaryPhraseEntries(record, primaryEntries);
  return (primaryEntries.length ? primaryEntries : secondaryEntries)
    .sort((a, b) => (
      b.priority - a.priority
      || normalizeCompact(b.phrase).length - normalizeCompact(a.phrase).length
      || a.phrase.localeCompare(b.phrase)
    ));
}

function getSpeciesToken(record) {
  const source = normalizePhrase(record.scientific_name || record.species || "");
  const parts = source.split(/\s+/).filter(Boolean);
  return parts[1] || "";
}

function getDistinctiveTokens(phrase) {
  return uniqueValues(
    normalizePhrase(phrase)
      .split(/\s+/)
      .filter((token) => (
        token.length >= 4
        && !CULTIVAR_STOPWORDS.has(token)
        && !SPECIES_STOPWORDS.has(token)
      )),
  );
}

function getLocalImageCount(record) {
  return ((record.rhs?.images?.local_files || []).length)
    + ((record.mrmaple?.local_files || []).length)
    + ((record.herter?.local_files || []).length)
    + ((record.ncsu?.local_files || []).length)
    + ((record.conifer_kingdom?.local_files || []).length)
    + ((record.jmac?.local_files || []).length);
}

async function fetchAllProducts() {
  const products = [];

  for (let page = 1; page <= 20; page += 1) {
    const url = `${BASE_URL}/products.json?limit=${PRODUCTS_PAGE_SIZE}&page=${page}`;
    const response = await fetchJson(url);
    const pageProducts = response.products || [];

    if (!pageProducts.length) {
      break;
    }

    console.log(`JM&C page ${page}: ${pageProducts.length} products`);
    products.push(...pageProducts);

    if (pageProducts.length < PRODUCTS_PAGE_SIZE) {
      break;
    }
  }

  return uniqueValues(products.map((product) => product.id))
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean)
    .map((product) => {
      const title = decodeHtmlEntities(product.title || "");
      const handle = decodeHtmlEntities(product.handle || "");
      const titleNormalized = normalizePhrase(title);
      const handleNormalized = normalizePhrase(handle);
      const titleCompact = titleNormalized.replace(/\s+/g, "");
      const handleCompact = handleNormalized.replace(/\s+/g, "");
      const quotedCultivars = extractQuotedPhrases(title).map((phrase) => normalizeCompact(phrase));
      const images = uniqueValues((product.images || []).map((image) => image?.src).filter(Boolean))
        .slice(0, MAX_IMAGES_PER_PRODUCT);

      return {
        id: product.id,
        title,
        handle,
        titleNormalized,
        handleNormalized,
        titleCompact,
        handleCompact,
        quotedCultivars,
        images,
        bodyText: stripHtml(product.body_html || ""),
        url: `${BASE_URL}/products/${handle}`,
      };
    })
    .filter((product) => (
      product.images.length > 0
      && (product.titleNormalized.includes("acer") || product.handleNormalized.includes("acer"))
    ));
}

function scoreProduct(record, product) {
  const phraseEntries = buildCultivarPhrases(record);
  if (!phraseEntries.length) {
    return { score: 0 };
  }

  const speciesToken = getSpeciesToken(record);
  const combinedNormalized = `${product.titleNormalized} ${product.handleNormalized}`.trim();

  if (speciesToken && !SPECIES_STOPWORDS.has(speciesToken) && !combinedNormalized.includes(speciesToken)) {
    return { score: 0 };
  }

  let bestScore = 0;
  let matchedPhrase = "";
  let matchedTokens = [];
  let matchedSource = "";

  if (product.quotedCultivars.length > 0) {
    for (const entry of phraseEntries) {
      const compact = normalizeCompact(entry.phrase);
      if (!compact || compact.length < 4) continue;
      if (!product.quotedCultivars.includes(compact)) continue;

      const score = 320 + compact.length + entry.priority * 10 + (product.handleCompact.includes(compact) ? 10 : 0);
      if (score > bestScore) {
        bestScore = score;
        matchedPhrase = entry.phrase;
        matchedTokens = [];
        matchedSource = entry.source;
      }
    }

    return {
      score: bestScore,
      matchedPhrase,
      matchedTokens,
      matchedSource,
    };
  }

  for (const entry of phraseEntries) {
    const compact = normalizeCompact(entry.phrase);
    if (!compact || compact.length < 5) continue;

    if (product.handleCompact.includes(compact) || product.titleCompact.includes(compact)) {
      const score = 250 + compact.length + entry.priority * 10;
      if (score > bestScore) {
        bestScore = score;
        matchedPhrase = entry.phrase;
        matchedTokens = [];
        matchedSource = entry.source;
      }
      continue;
    }

    const distinctiveTokens = getDistinctiveTokens(entry.phrase);
    if (distinctiveTokens.length >= 2 && distinctiveTokens.every((token) => combinedNormalized.includes(token))) {
      const score = 190 + distinctiveTokens.reduce((sum, token) => sum + token.length, 0) + entry.priority * 10;
      if (score > bestScore) {
        bestScore = score;
        matchedPhrase = entry.phrase;
        matchedTokens = distinctiveTokens;
        matchedSource = entry.source;
      }
    }
  }

  return {
    score: bestScore,
    matchedPhrase,
    matchedTokens,
    matchedSource,
  };
}

function selectBestProduct(record, products) {
  const ranked = products
    .map((product) => ({
      ...product,
      ...scoreProduct(record, product),
    }))
    .filter((product) => product.score > 0)
    .sort((a, b) => b.score - a.score);

  const [best, second] = ranked;
  if (!best) return null;

  if (best.score >= 340) return best;
  if (best.score >= 280 && (!second || best.score - second.score >= 25)) return best;
  if (best.score >= 220 && best.matchedTokens.length >= 2 && (!second || best.score - second.score >= 40)) {
    return best;
  }

  return null;
}

async function downloadImages(record, product, dryRun) {
  const targetDir = path.join(jmacImagesRoot, sanitizePathSegment(record.id));
  if (!dryRun) {
    await ensureDir(targetDir);
  }

  const localFiles = [];
  const downloadItems = [];

  for (const [index, imageUrl] of product.images.entries()) {
    const cleanUrl = imageUrl.split("?")[0];
    const numberedName = `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(path.basename(cleanUrl) || "image")}`;
    const targetPath = path.join(targetDir, numberedName);
    const localPath = path.relative(process.cwd(), targetPath);

    let downloadMeta = {
      bytes: 0,
      contentType: "image/jpeg",
    };

    if (!dryRun) {
      downloadMeta = await downloadBinary(imageUrl, targetPath, { referer: product.url });
    }

    localFiles.push(localPath);
    downloadItems.push({
      index: index + 1,
      source_url: imageUrl,
      source_page_url: product.url,
      local_path: localPath,
      bytes: downloadMeta.bytes,
      content_type: downloadMeta.contentType,
      downloaded_at: new Date().toISOString(),
      status: dryRun ? "planned" : "downloaded",
      source_name: "Japanese Maples & Conifers",
      usage_note: "Source-hosted product imagery from japanesemaplesandconifers.com. Confirm reuse rights before redistribution.",
    });
  }

  record.jmac = {
    source_name: "Japanese Maples & Conifers",
    detail_url: product.url,
    matched_product_count: 1,
    local_file_count: localFiles.length,
    cover_path: localFiles[0] || null,
    local_files: localFiles,
    products: [
      {
        name: product.title,
        product_url: product.url,
        botanical_name: record.scientific_name || record.canonical_name || record.display_name,
        common_name: record.display_name || record.canonical_name || "",
        description_text: product.bodyText,
        match_method: product.quotedCultivars.length ? "shopify_title_quoted_cultivar" : "shopify_handle_or_title",
        match_candidate: product.matchedPhrase || product.matchedTokens.join(" "),
        match_score: product.score,
        match_source: product.matchedSource,
      },
    ],
    images: {
      download_items: downloadItems,
      downloaded_count: localFiles.length,
      local_files: localFiles,
    },
  };

  record.sources = [
    ...(record.sources || []).filter((source) => source.source !== "jmac"),
    {
      source: "jmac",
      name: product.title || record.display_name,
      botanical_name: record.scientific_name || record.display_name,
      detail_url: product.url,
      image_count: localFiles.length,
      usage_note: "Source-hosted product imagery from japanesemaplesandconifers.com. Confirm reuse rights before redistribution.",
    },
  ];
  record.source_count = record.sources.length;

  return {
    downloaded: localFiles.length,
    match_score: product.score,
    matched_phrase: product.matchedPhrase || product.matchedTokens.join(" "),
    product_url: product.url,
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
    return buildCultivarPhrases(record).length > 0;
  });
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const idsFilter = parseIdsFilter();
  const limit = parseLimit(400);
  const records = await loadRecords();
  const candidates = buildCandidates(records, idsFilter, force).slice(0, limit);
  const products = await fetchAllProducts();
  const report = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    total_products: products.length,
    total_candidates: candidates.length,
    matched: [],
    unmatched: [],
  };

  console.log(`JM&C candidates: ${candidates.length}, products: ${products.length}`);

  let matchedRecords = 0;
  let downloadedImages = 0;

  for (const record of candidates) {
    try {
      const selected = selectBestProduct(record, products);
      if (!selected) {
        report.unmatched.push({
          id: record.id,
          display_name: record.display_name,
        });
        console.log(`${record.id}: no confident JM&C match`);
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
      console.log(`${record.id}: matched ${result.matched_phrase || "title"}, downloaded ${result.downloaded}`);
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

  console.log(`JM&C done. records=${matchedRecords}, images=${downloadedImages}, dryRun=${dryRun}`);
}

await main();
