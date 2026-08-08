import path from "node:path";
import {
  ensureDir,
  fetchJson,
  fetchText,
  hasContent,
  hasFlag,
  loadRecords,
  mrMapleImagesRoot,
  normalizeText,
  parseIdsFilter,
  parseLimit,
  sanitizePathSegment,
  saveRecords,
  stripHtml,
  uniqueValues,
  downloadBinary,
} from "./fetch-image-common.mjs";

const MRMAPLE_COLLECTION_URL = "https://mrmaple.com/collections/buy-japanese-maples";
const MRMAPLE_PRODUCTS_API_URL = "https://mrmaple.com/products.json";
const MRMAPLE_POLICY_URL = "https://mrmaple.com/pages/image-and-description-use-policy";
const MRMAPLE_PRODUCTS_PAGE_SIZE = 250;
const MAX_IMAGES_PER_PRODUCT = 12;
const BOTANICAL_STOPWORDS = new Set([
  "acer",
  "palmatum",
  "japonicum",
  "shirasawanum",
  "saccharum",
  "pictum",
  "circinatum",
  "buergerianum",
  "campestre",
  "cappadocicum",
  "carpinifolium",
  "conspicuum",
  "crataegifolium",
  "diabolicum",
  "laevigatum",
  "maximowiczianum",
  "morifolium",
  "oliverianum",
  "platanoides",
  "pseudoplatanus",
  "pseudosieboldianum",
  "pycnanthum",
  "sieboldianum",
  "shirasawanum",
  "truncatum",
  "japanese",
  "maple",
  "tree",
  "trees",
  "buy",
  "only",
  "pickup",
  "ship",
  "does",
  "not",
  "for",
  "red",
  "green",
]);

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
      .filter((value) => value && /[A-Za-z]/.test(value) && !/[\u4e00-\u9fff]/.test(value))
      .slice(0, 12),
  );
}

function getDistinctiveTokens(record) {
  const tokens = getLatinSearchTerms(record)
    .flatMap((value) => String(value).split(/[^A-Za-z0-9]+/))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 3 && !BOTANICAL_STOPWORDS.has(value));

  return uniqueValues(tokens);
}

function normalizeWords(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .toLowerCase()
    .trim();
}

function extractQuotedPhrases(value) {
  return [...String(value || "").matchAll(/[\u0027\u2018\u2019\"]([^\u0027\u2018\u2019\"]{2,80})[\u0027\u2018\u2019\"]/g)]
    .map((match) => match[1]);
}

function stripCultivarPrefix(value) {
  return String(value || "")
    .replace(/^acer\s+[a-z]+(?:\s+x)?(?:\s+(?:subsp|var)\.?\s+[a-z-]+)?\s*/i, "")
    .replace(/^japanese\s+maple\s+/i, "")
    .replace(/\s+\([^)]*\)\s*$/g, "")
    .trim();
}

function getExactCultivarPhraseEntries(record) {
  const primaryValues = [
    record.display_name,
    record.canonical_name,
    ...extractQuotedPhrases(record.scientific_name),
  ];
  const secondaryValues = [
    ...(record.aliases || []),
    ...(record.search_terms || []),
  ];
  const entries = [];
  const seen = new Set();

  for (const [values, priority] of [[primaryValues, 3], [secondaryValues, 2]]) {
    for (const value of values) {
      if (!value || /[\u4e00-\u9fff]/.test(String(value))) continue;
      const phrase = stripCultivarPrefix(value);
      const words = normalizeWords(phrase).split(/\s+/).filter(Boolean);
      const compact = normalizeText(phrase);
      const distinctiveWords = words.filter((word) => (
        word.length >= 3 && !BOTANICAL_STOPWORDS.has(word)
      ));

      if (!compact || compact.length < 4 || !distinctiveWords.length) continue;
      if (seen.has(compact)) continue;
      seen.add(compact);
      entries.push({ compact, priority, words });
    }
  }

  return entries;
}

function getSpeciesToken(record) {
  const speciesWords = normalizeWords(record.species || record.scientific_name || "").split(/\s+/).filter(Boolean);
  return speciesWords[0] === "acer" ? speciesWords[1] || "" : "";
}

function hasMultiWordCultivarName(record) {
  return getLatinSearchTerms(record).some((value) => (
    value
      .split(/[^A-Za-z0-9]+/)
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length >= 2 && !BOTANICAL_STOPWORDS.has(part))
      .length >= 2
  ));
}

function getProductJsonUrl(productUrl) {
  return productUrl.replace(/\/+$/, "").replace(/\?.*$/, "") + ".js";
}

function extractProductUrlsFromSearchHtml(html) {
  const matches = html.match(/\/products\/[^"'?#\s<]+/g) || [];
  return uniqueValues(
    matches
      .filter((value) => !/\.(?:jpg|jpeg|png|webp|gif|avif)$/i.test(value))
      .map((value) => `https://mrmaple.com${value}`),
  );
}

async function searchMrMapleProductUrls(term) {
  const html = await fetchText(`https://mrmaple.com/search?q=${encodeURIComponent(term)}&type=product`);
  return extractProductUrlsFromSearchHtml(html);
}

function buildMrMapleScore(record, product) {
  const title = normalizeText(product.title);
  const handle = normalizeText(product.handle);
  const speciesToken = getSpeciesToken(record);
  if (speciesToken && !title.includes(speciesToken) && !handle.includes(speciesToken)) {
    return 0;
  }

  const quotedProductPhrases = extractQuotedPhrases(product.title).map(normalizeText);
  const exactPhrase = getExactCultivarPhraseEntries(record)
    .find((entry) => {
      const quotedMatch = quotedProductPhrases.find((quoted) => quoted === entry.compact);
      if (quotedMatch) return true;

      const containedInQuotedPhrase = quotedProductPhrases.some((quoted) => quoted.includes(entry.compact));
      if (containedInQuotedPhrase) return false;

      return title.includes(entry.compact) || handle.includes(entry.compact);
    });

  if (!exactPhrase) return 0;

  let score = 1000 + exactPhrase.priority * 100;
  if (title.includes(exactPhrase.compact)) score += 20;
  if (handle.includes(exactPhrase.compact)) score += 20;

  if (handle.includes("forpickuponly") || handle.includes("doesnotship")) {
    score -= 8;
  }

  return score;
}

async function fetchMrMapleProduct(productUrl) {
  const product = await fetchJson(getProductJsonUrl(productUrl), {
    headers: {
      referer: productUrl,
    },
  });

  return {
    ...product,
    product_url: productUrl.replace(/\.js$/, ""),
  };
}

async function fetchAllMrMapleProducts() {
  const products = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchJson(`${MRMAPLE_PRODUCTS_API_URL}?limit=${MRMAPLE_PRODUCTS_PAGE_SIZE}&page=${page}`);
    const pageProducts = response.products || [];
    if (!pageProducts.length) break;

    products.push(...pageProducts.map((product) => ({
      ...product,
      product_url: `https://mrmaple.com/products/${product.handle}`,
    })));

    if (pageProducts.length < MRMAPLE_PRODUCTS_PAGE_SIZE) break;
  }

  return uniqueValues(products.map((product) => product.handle))
    .map((handle) => products.find((product) => product.handle === handle))
    .filter(Boolean);
}

function getProductImageUrls(product) {
  return uniqueValues([
    ...(product.media || [])
      .filter((item) => item?.media_type === "image")
      .map((item) => typeof item === "string" ? item : item.src),
    ...(product.images || [])
      .map((item) => typeof item === "string" ? item : item?.src),
  ]).slice(0, MAX_IMAGES_PER_PRODUCT);
}

async function resolveMrMapleProducts(record, productIndex) {
  const directUrls = uniqueValues((record.mrmaple?.products || []).map((product) => product.product_url).filter(Boolean));
  const discoveredUrls = [...directUrls];
  const distinctiveTokens = getDistinctiveTokens(record);
  const hasStrongExactPhrase = getExactCultivarPhraseEntries(record)
    .some((entry) => entry.priority === 3 && entry.compact.length >= 5);

  if (!discoveredUrls.length && productIndex?.length) {
    return productIndex
      .map((product) => ({
        ...product,
        match_score: buildMrMapleScore(record, product),
      }))
      .filter((product) => product.match_score > 0 && getProductImageUrls(product).length)
      .sort((a, b) => b.match_score - a.match_score);
  }

  if (!discoveredUrls.length && (distinctiveTokens.length >= 2 || hasMultiWordCultivarName(record) || hasStrongExactPhrase)) {
    // Prefer the display/canonical/scientific names. Searching every alias is
    // both slow and more likely to surface an unrelated product with a shared
    // short token; the exact-match gate below is the final authority.
    for (const term of getLatinSearchTerms(record).slice(0, 3)) {
      try {
        const urls = await searchMrMapleProductUrls(term);
        discoveredUrls.push(...urls);
        if (discoveredUrls.length >= 6) break;
      } catch {}
    }
  }

  const productUrls = uniqueValues(discoveredUrls).slice(0, 6);
  const products = [];

  for (const productUrl of productUrls) {
    try {
      const product = await fetchMrMapleProduct(productUrl);
      const score = buildMrMapleScore(record, product);
      if (score > 0 && (product.images || product.media || []).length) {
        products.push({ ...product, match_score: score });
      }
    } catch {}
  }

  return products.sort((a, b) => b.match_score - a.match_score);
}

async function downloadMrMapleImages(record, dryRun, productIndex) {
  const products = await resolveMrMapleProducts(record, productIndex);
  if (!products.length) {
    return { downloaded: 0, matched: 0, selectedHandle: null };
  }

  const selectedProduct = products[0];
  const images = getProductImageUrls(selectedProduct)
    .map((value) => (value || "").replace(/^\/\//, "https://"))
    .filter(Boolean);

  if (!images.length) {
    return { downloaded: 0, matched: products.length, selectedHandle: selectedProduct.handle };
  }

  const targetDir = path.join(mrMapleImagesRoot, sanitizePathSegment(selectedProduct.handle));
  if (!dryRun) {
    await ensureDir(targetDir);
  }

  const localFiles = [];
  const downloadItems = [];

  for (const [index, imageUrl] of images.entries()) {
    const cleanUrl = imageUrl.split("?")[0];
    const originalName = path.basename(cleanUrl);
    const numberedName = `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(originalName)}`;
    const targetPath = path.join(targetDir, numberedName);
    const localPath = path.relative(process.cwd(), targetPath);

    let downloadMeta = {
      bytes: 0,
      contentType: "image/jpeg",
    };

    if (!dryRun) {
      downloadMeta = await downloadBinary(imageUrl, targetPath, { referer: selectedProduct.product_url });
    }

    localFiles.push(localPath);
    downloadItems.push({
      index: index + 1,
      source_url: imageUrl,
      product_url: selectedProduct.product_url,
      local_path: localPath,
      content_type: downloadMeta.contentType,
      bytes: downloadMeta.bytes,
      downloaded_at: new Date().toISOString(),
      status: dryRun ? "planned" : "downloaded",
      source_name: "Mr Maple",
      usage_note: "Copyrighted by MrMaple.com. Not authorized for use without expressed written consent.",
    });
  }

  record.mrmaple = {
    ...(record.mrmaple || {}),
    collection_url: MRMAPLE_COLLECTION_URL,
    policy_url: MRMAPLE_POLICY_URL,
    matched_product_count: products.length,
    local_files: localFiles,
    cover_path: localFiles[0] || null,
    products: [
      {
        title: selectedProduct.title,
        handle: selectedProduct.handle,
        product_url: selectedProduct.product_url,
        description_text: stripHtml(selectedProduct.description || selectedProduct.body_html),
        image_count: images.length,
        match_method: directProductUrlExists(record)
          ? "existing_product_url"
          : (productIndex?.length ? "collection_products_json" : "search_html"),
        match_score: selectedProduct.match_score,
        images: {
          downloaded_count: downloadItems.length,
          local_files: localFiles,
          download_items: downloadItems,
        },
      },
    ],
  };

  record.has_mrmaple = true;
  return { downloaded: localFiles.length, matched: products.length, selectedHandle: selectedProduct.handle };
}

function directProductUrlExists(record) {
  return !!(record.mrmaple?.products || []).some((product) => hasContent(product.product_url));
}

function buildCandidates(records, idsFilter, force) {
  return records.filter((record) => {
    if (idsFilter && !idsFilter.has(record.id)) return false;
    if (!force && (record.mrmaple?.local_files || []).length > 0) return false;
    return getLatinSearchTerms(record).length > 0;
  });
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const idsFilter = parseIdsFilter();
  const limit = parseLimit(20);
  const records = await loadRecords();
  const candidates = buildCandidates(records, idsFilter, force).slice(0, limit);
  const productIndex = await fetchAllMrMapleProducts();

  console.log(`Mr Maple candidates: ${candidates.length}, products: ${productIndex.length}`);

  let downloadedRecords = 0;
  let downloadedImages = 0;

  for (const record of candidates) {
    try {
      const result = await downloadMrMapleImages(record, dryRun, productIndex);
      if (result.downloaded > 0) {
        downloadedRecords += 1;
        downloadedImages += result.downloaded;
      }
      console.log(
        `${record.id}: matched ${result.matched}, downloaded ${result.downloaded}${result.selectedHandle ? `, selected ${result.selectedHandle}` : ""}`,
      );
    } catch (error) {
      console.error(`${record.id}: ${error.message}`);
    }
  }

  if (!dryRun) {
    await saveRecords(records);
  }

  console.log(`Mr Maple done. records=${downloadedRecords}, images=${downloadedImages}, dryRun=${dryRun}`);
}

await main();
