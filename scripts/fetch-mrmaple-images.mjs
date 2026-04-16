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
const MRMAPLE_POLICY_URL = "https://mrmaple.com/pages/image-and-description-use-policy";
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
  const phraseTokens = getLatinSearchTerms(record)
    .map(normalizeText)
    .filter((value) => value && !BOTANICAL_STOPWORDS.has(value));
  const wordTokens = getDistinctiveTokens(record).map(normalizeText).filter(Boolean);
  let score = 0;
  let matched = 0;

  for (const token of phraseTokens) {
    if (title.includes(token)) {
      score += 18;
      matched += 1;
    }
    if (handle.includes(token)) {
      score += 14;
      matched += 1;
    }
  }

  for (const token of wordTokens) {
    if (title.includes(token)) {
      score += 7;
      matched += 1;
    }
    if (handle.includes(token)) {
      score += 5;
      matched += 1;
    }
  }

  if (!matched) {
    return 0;
  }

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

async function resolveMrMapleProducts(record) {
  const directUrls = uniqueValues((record.mrmaple?.products || []).map((product) => product.product_url).filter(Boolean));
  const discoveredUrls = [...directUrls];
  const distinctiveTokens = getDistinctiveTokens(record);

  if (!discoveredUrls.length && (distinctiveTokens.length >= 2 || hasMultiWordCultivarName(record))) {
    for (const term of getLatinSearchTerms(record)) {
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

async function downloadMrMapleImages(record, dryRun) {
  const products = await resolveMrMapleProducts(record);
  if (!products.length) {
    return { downloaded: 0, matched: 0, selectedHandle: null };
  }

  const selectedProduct = products[0];
  const images = uniqueValues(
    [
      ...(selectedProduct.media || []).filter((item) => item.media_type === "image").map((item) => item.src),
      ...(selectedProduct.images || []),
    ]
      .map((value) => (value || "").replace(/^\/\//, "https://"))
      .filter(Boolean),
  ).slice(0, MAX_IMAGES_PER_PRODUCT);

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
        description_text: stripHtml(selectedProduct.description),
        image_count: images.length,
        match_method: directProductUrlExists(record) ? "existing_product_url" : "search_html",
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

  console.log(`Mr Maple candidates: ${candidates.length}`);

  let downloadedRecords = 0;
  let downloadedImages = 0;

  for (const record of candidates) {
    try {
      const result = await downloadMrMapleImages(record, dryRun);
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
