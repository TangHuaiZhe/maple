import fs from "node:fs/promises";
import path from "node:path";
import {
  decodeHtmlEntities,
  downloadBinary,
  ensureDir,
  fetchJson,
  hasContent,
  hasFlag,
  herterImagesRoot,
  loadRecords,
  parseIdsFilter,
  parseLimit,
  sanitizePathSegment,
  saveRecords,
  sourceRoot,
  stripHtml,
  uniqueValues,
} from "./fetch-image-common.mjs";

const COLLECTION_URL = "https://japanesemaple.net/products/all-japanese-maples/";
const PRODUCTS_API_URL = "https://japanesemaple.net/wp-json/wc/store/v1/products?category=24&per_page=100&page=1";
const PRODUCTS_SNAPSHOT_PATH = path.join(sourceRoot, "Resource/园艺/raw/herter-products.json");
const MATCH_REPORT_PATH = path.join(sourceRoot, "Resource/园艺/raw/herter-match-report.json");

const PRODUCT_OVERRIDES = {
  "a-j-aconitifolium-japanese-maple": "acer-japonicum-aconitifolium",
  "aureum-autumn-moon": "acer-shirasawanum-autumn-moon",
  "aureum-full-moon-japanese-maple": "acer-shirasawanum",
  "babylace-fine-lacelef-japanese-maple": "acer-palmatum-baby-lace",
  "beni-otake-red-bamboo-like-japanese-maple": "acer-palmatum-beni-o-take",
  "beni-schichihenge": "acer-palmatum-beni-shichihenge",
  "emperor-one-red-grafted-japanese-maple": "acer-palmatum-emperor-one",
  "fairyhaire-fine-leaf-japanese-maple": "acer-palmatum-fairy-hair",
  "inaba-shirdare-red-lace-leaf-japanese-maple": "acer-palmatum-inaba-shidare",
  "kandy-kitchens-japanese-maple": "acer-palmatum-kandy-kitchen",
  "lileeannes-jewel": "acer-palmatum-lileeanes-jewel",
  "omurayama-cascading-japanese-maple": "acer-palmatum-omura-yama",
  "orido-nishiki-variegated-japanese-maple": "acer-palmatum-oridono-nishiki",
  "peaches-cream-japanese-maple": "acer-palmatum-peaches-and-cream",
  "red-emperor-deep-red-japanese-maple": "acer-palmatum-emperor-one",
  "sango-kaku-coral-bark-japanese-maple": "acer-palmatum-sango-kaku",
  "seiryu-green-dragon-lace-leaf-japanese-maple": "acer-palmatum-seiryu",
  "shishigashira-lions-head-japanese-maple": "acer-palmatum-shishigashira",
  "toyoma-nishiki-variegated-laceleaf-japanese-maple": "acer-palmatum-toyama-nishiki",
  "villa-taranto-bamboo-japanese-maple": "acer-palmatum-villa-taranto",
};

const SKIP_PRODUCT_SLUGS = new Set([
  "ginkgo-biloba-tree",
  "green-japanese-maple-seedling-large",
  "green-japanese-maple-seedling-medium",
  "green-japanese-maple-seedling-small",
  "herter-original-double-grafted-maple",
  "mega-size-red-laceleaf-japanese-maple",
  "red-japanese-maple-2yr-branched-seedling-bonsai",
  "red-japanese-maple-seedlings-small",
  "wholesale-maple-deal-10-large-maples",
]);

const TRAILING_PHRASES = [
  "bamboo leaf japanese maple",
  "cascading japanese maple",
  "dwarf japanese maple",
  "fine laceleaf japanese maple",
  "fine leaf japanese maple",
  "grafted japanese maple",
  "japanese maple",
  "japanese maples",
  "lace leaf japanese maple",
  "laceleaf japanese maple",
  "large leaf japanese maple",
  "orange japanese maple",
  "pink japanese maple",
  "purple japanese maple",
  "red dwarf japanese maple",
  "red japanese maple",
  "variegated japanese maple",
  "yellow japanese maple",
];

const TRAILING_WORDS = new Set([
  "bark",
  "bonsai",
  "branched",
  "cascading",
  "deep",
  "dwarf",
  "fine",
  "graft",
  "grafted",
  "japanese",
  "lace",
  "laceleaf",
  "large",
  "leaf",
  "leafed",
  "like",
  "maple",
  "maples",
  "medium",
  "rare",
  "small",
  "tree",
  "trees",
]);

function decodeText(value) {
  return decodeHtmlEntities(String(value || "")).replace(/\s+/g, " ").trim();
}

function normalizePhrase(value) {
  return decodeText(value)
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
    .replace(/^acer\s+[a-z]+(?:\s+var\s+[a-z]+)?\s+/i, "")
    .replace(/^japanese maple\s+/i, "")
    .trim();
}

function stripLeadingInitials(value) {
  return value
    .split(/\s+/)
    .filter((part) => part.length > 1)
    .join(" ")
    .trim();
}

function buildCandidatePhrases(...values) {
  const candidates = new Set();

  values.forEach((value) => {
    let current = normalizePhrase(value);
    if (!current) return;

    candidates.add(current);
    candidates.add(current.replace(/\band\b/g, "").replace(/\s+/g, " ").trim());

    let changed = true;
    while (changed) {
      changed = false;
      for (const phrase of TRAILING_PHRASES) {
        if (current.endsWith(` ${phrase}`)) {
          current = current.slice(0, -(phrase.length + 1)).trim();
          if (current) {
            candidates.add(current);
          }
          changed = true;
        }
      }
    }

    let tokens = current.split(/\s+/).filter(Boolean);
    while (tokens.length > 1 && TRAILING_WORDS.has(tokens[tokens.length - 1])) {
      tokens = tokens.slice(0, -1);
      candidates.add(tokens.join(" "));
    }

    let prefix = [...tokens];
    while (prefix.length > 1) {
      prefix = prefix.slice(0, -1);
      candidates.add(prefix.join(" "));
    }

    const withoutInitials = stripLeadingInitials(current);
    if (withoutInitials && withoutInitials !== current) {
      candidates.add(withoutInitials);
    }
  });

  return [...candidates]
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function buildRecordTermIndex(records) {
  const termIndex = new Map();

  records.forEach((record) => {
    const rawTerms = [
      record.display_name,
      record.canonical_name,
      record.scientific_name,
      ...(record.aliases || []),
      ...(record.search_terms || []),
    ].filter(Boolean);

    rawTerms.forEach((term) => {
      const normalized = normalizePhrase(term);
      const derived = new Set([
        normalized,
        stripBotanicalPrefix(normalized),
        stripLeadingInitials(stripBotanicalPrefix(normalized)),
      ]);

      derived.forEach((value) => {
        if (!value) return;
        const ids = termIndex.get(value) || new Set();
        ids.add(record.id);
        termIndex.set(value, ids);
      });
    });
  });

  return termIndex;
}

function getSingleMatch(termIndex, candidate) {
  const ids = [...(termIndex.get(candidate) || [])];
  return ids.length === 1 ? ids[0] : null;
}

function findMatchedRecordId(product, termIndex) {
  if (PRODUCT_OVERRIDES[product.slug]) {
    return {
      candidate: product.slug,
      method: "override",
      recordId: PRODUCT_OVERRIDES[product.slug],
      score: 1000,
    };
  }

  const candidates = buildCandidatePhrases(product.name, product.slug);
  for (const candidate of candidates) {
    const recordId = getSingleMatch(termIndex, candidate);
    if (recordId) {
      return {
        candidate,
        method: "exact",
        recordId,
        score: 700 + candidate.length,
      };
    }
  }

  return {
    candidate: candidates[0] || normalizePhrase(product.name),
    method: "unmatched",
    recordId: null,
    score: 0,
  };
}

function buildProductCategories(product) {
  return uniqueValues((product.categories || []).map((category) => decodeText(category.name)));
}

function buildPriceRange(product) {
  const priceRange = product.prices?.price_range;
  const minorUnit = product.prices?.currency_minor_unit || 2;
  const currencyCode = product.prices?.currency_code || "USD";
  const currencySymbol = decodeText(product.prices?.currency_symbol || "$");

  const toNumber = (value) => {
    if (!hasContent(value)) return null;
    return Number(value) / (10 ** minorUnit);
  };

  return {
    currency_code: currencyCode,
    currency_symbol: currencySymbol,
    min: toNumber(priceRange?.min_amount ?? product.prices?.price),
    max: toNumber(priceRange?.max_amount ?? product.prices?.price),
  };
}

function buildHerterSourceEntry(productGroup) {
  const primary = productGroup.products[0];
  return {
    source: "herter",
    name: primary.name || primary.product_name,
    detail_url: primary.product_url || primary.permalink,
    description: primary.description_text,
    group: primary.category_names.join(" / ") || null,
    image_count: productGroup.imageUrls.length,
    matched_product_count: productGroup.products.length,
    usage_note: "Private local archive only. Check japanesemaple.net rights before redistribution.",
  };
}

function createProductMatchGroup(products) {
  const sortedProducts = [...products].sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    return stripHtml(b.description || "").length - stripHtml(a.description || "").length;
  });

  return {
    imageUrls: uniqueValues(sortedProducts.flatMap((product) => (product.images || []).map((image) => image?.src).filter(Boolean))),
    products: sortedProducts.map((product) => ({
      category_names: buildProductCategories(product),
      description_text: stripHtml(product.description),
      match: product.match,
      permalink: product.permalink,
      price_range: buildPriceRange(product),
      product_id: product.id,
      product_name: decodeText(product.name),
      product_slug: product.slug,
      review_count: Number(product.review_count || 0),
      short_description_text: stripHtml(product.short_description),
      stock_status: {
        class: product.stock_availability?.class || null,
        text: decodeText(product.stock_availability?.text || ""),
      },
    })),
  };
}

async function fetchHerterProducts() {
  const products = await fetchJson(PRODUCTS_API_URL);
  return products.map((product) => ({
    ...product,
    name: decodeText(product.name),
    slug: decodeText(product.slug),
    permalink: decodeText(product.permalink),
  }));
}

async function writeSnapshot(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function downloadProductGroup(record, productGroup, dryRun) {
  const targetDir = path.join(herterImagesRoot, sanitizePathSegment(record.id));
  if (!dryRun) {
    await ensureDir(targetDir);
  }

  const localFiles = [];
  const downloadItems = [];

  for (const [index, imageUrl] of productGroup.imageUrls.entries()) {
    const cleanUrl = imageUrl.split("?")[0];
    const numberedName = `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(path.basename(cleanUrl))}`;
    const targetPath = path.join(targetDir, numberedName);
    const localPath = path.relative(process.cwd(), targetPath);

    let downloadMeta = {
      bytes: 0,
      contentType: "image/jpeg",
    };

    if (!dryRun) {
      downloadMeta = await downloadBinary(imageUrl, targetPath, { referer: COLLECTION_URL });
    }

    localFiles.push(localPath);
    downloadItems.push({
      index: index + 1,
      source_url: imageUrl,
      local_path: localPath,
      bytes: downloadMeta.bytes,
      content_type: downloadMeta.contentType,
      downloaded_at: new Date().toISOString(),
      status: dryRun ? "planned" : "downloaded",
      source_name: "Herter Nursery",
      usage_note: "Private local archive only. Check japanesemaple.net rights before redistribution.",
    });
  }

  const products = productGroup.products.map((product) => ({
    product_id: product.product_id,
    name: product.product_name,
    slug: product.product_slug,
    product_url: product.permalink,
    description_text: product.description_text,
    short_description_text: product.short_description_text,
    category_names: product.category_names,
    price_range: product.price_range,
    review_count: product.review_count,
    stock_status: product.stock_status,
    match_method: product.match.method,
    match_candidate: product.match.candidate,
  }));

  record.herter = {
    source_name: "Herter Nursery",
    collection_url: COLLECTION_URL,
    matched_product_count: products.length,
    local_file_count: localFiles.length,
    cover_path: localFiles[0] || null,
    local_files: localFiles,
    products,
    images: {
      download_items: downloadItems,
      downloaded_count: localFiles.length,
      local_files: localFiles,
    },
  };

  const remainingSources = (record.sources || []).filter((source) => source.source !== "herter");
  record.sources = [...remainingSources, buildHerterSourceEntry({ ...productGroup, products })];
  record.source_count = record.sources.length;
  record.has_herter = localFiles.length > 0 || products.length > 0;

  return {
    downloaded: localFiles.length,
    matchedProducts: products.length,
  };
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const idsFilter = parseIdsFilter();
  const limit = parseLimit(100);
  const records = await loadRecords();
  const recordById = new Map(records.map((record) => [record.id, record]));
  const termIndex = buildRecordTermIndex(records);
  const products = await fetchHerterProducts();

  if (!dryRun) {
    await writeSnapshot(PRODUCTS_SNAPSHOT_PATH, products);
  }

  const report = {
    collection_url: COLLECTION_URL,
    fetched_product_count: products.length,
    generated_at: new Date().toISOString(),
    matched: [],
    skipped: [],
    unmatched: [],
  };

  const groupedMatches = new Map();

  products.forEach((product) => {
    if (SKIP_PRODUCT_SLUGS.has(product.slug)) {
      report.skipped.push({
        product_name: product.name,
        product_slug: product.slug,
        reason: "skip_list",
      });
      return;
    }

    const match = findMatchedRecordId(product, termIndex);
    if (!match.recordId) {
      report.unmatched.push({
        product_name: product.name,
        product_slug: product.slug,
        candidate: match.candidate,
      });
      return;
    }

    const record = recordById.get(match.recordId);
    if (!record) {
      report.unmatched.push({
        product_name: product.name,
        product_slug: product.slug,
        candidate: match.candidate,
        reason: "record_missing",
      });
      return;
    }

    if (idsFilter && !idsFilter.has(record.id)) {
      report.skipped.push({
        product_name: product.name,
        product_slug: product.slug,
        record_id: record.id,
        reason: "ids_filter",
      });
      return;
    }

    const matches = groupedMatches.get(record.id) || [];
    matches.push({ ...product, match });
    groupedMatches.set(record.id, matches);
  });

  const selectedGroups = [...groupedMatches.entries()]
    .filter(([recordId]) => {
      const record = recordById.get(recordId);
      if (!force && (record?.herter?.local_files || []).length > 0) {
        report.skipped.push({
          record_id: recordId,
          reason: "already_downloaded",
        });
        return false;
      }
      return true;
    })
    .slice(0, limit);

  console.log(`Herter matched record groups: ${selectedGroups.length}`);

  let downloadedRecords = 0;
  let downloadedImages = 0;

  for (const [recordId, productsForRecord] of selectedGroups) {
    const record = recordById.get(recordId);
    const productGroup = createProductMatchGroup(productsForRecord);

    try {
      const result = await downloadProductGroup(record, productGroup, dryRun);
      report.matched.push({
        record_id: record.id,
        cultivar_name: record.display_name,
        matched_product_count: result.matchedProducts,
        downloaded_image_count: result.downloaded,
        product_slugs: productGroup.products.map((product) => product.product_slug),
      });

      if (result.downloaded > 0) {
        downloadedRecords += 1;
        downloadedImages += result.downloaded;
      }

      console.log(`${record.id}: matched ${result.matchedProducts}, downloaded ${result.downloaded}`);
    } catch (error) {
      report.unmatched.push({
        record_id: record.id,
        cultivar_name: record.display_name,
        reason: error.message,
      });
      console.error(`${record.id}: ${error.message}`);
    }
  }

  if (!dryRun) {
    await saveRecords(records);
    await writeSnapshot(MATCH_REPORT_PATH, report);
  }

  console.log(`Herter done. records=${downloadedRecords}, images=${downloadedImages}, dryRun=${dryRun}`);
}

await main();
