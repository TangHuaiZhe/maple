import fs from "node:fs/promises";
import path from "node:path";
import {
  decodeHtmlEntities,
  downloadBinary,
  ensureDir,
  fetchText,
  hasContent,
  hasFlag,
  loadRecords,
  ncsuImagesRoot,
  parseIdsFilter,
  parseLimit,
  sanitizePathSegment,
  saveRecords,
  sleep,
  sourceRoot,
  stripHtml,
  uniqueValues,
} from "./fetch-image-common.mjs";

const NCSU_BASE_URL = "https://plants.ces.ncsu.edu";
const NCSU_SEARCH_URL = `${NCSU_BASE_URL}/find_a_plant/`;
const REPORT_PATH = path.join(sourceRoot, "Resource/园艺/raw/ncsu-match-report.json");
const MISSING_PATH = path.join(sourceRoot, "Resource/园艺/raw/missing-image-cultivars.json");
const REQUEST_DELAY_MS = 1800;
const MAX_QUERIES_PER_RECORD = 4;
const SAVE_EVERY_RECORDS = 10;

const TRAILING_PHRASES = [
  "japanese maple cultivars",
  "japanese maple cultivar",
  "japanese maple",
  "japanese maples",
  "spreading japanese maple",
];

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

function stripBotanicalPrefix(value) {
  return value
    .replace(/^acer\s+[a-z]+(?:\s+(?:subsp|var)\.?\s+[a-z-]+)?\s+/i, "")
    .trim();
}

function stripCultivarQuotes(value) {
  return value.replace(/^'+|'+$/g, "").trim();
}

function cleanDescriptionText(text) {
  return decodeText(text)
    .replace(/\bMore information on\b[\s\S]*$/i, " ")
    .replace(/\bVIDEO Created by\b[\s\S]*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLocalImageCount(record) {
  return (record.images?.count || 0)
    + ((record.rhs?.images?.local_files || []).length)
    + ((record.mrmaple?.local_files || []).length)
    + ((record.herter?.local_files || []).length)
    + ((record.ncsu?.local_files || []).length);
}

function buildCandidateQueries(record) {
  const raw = uniqueValues([
    record.scientific_name,
    record.display_name,
    record.canonical_name,
    ...(record.aliases || []),
    ...(record.search_terms || []),
  ].filter(Boolean));

  const candidates = new Set();

  raw.forEach((value) => {
    let current = normalizePhrase(value);
    if (!current) return;

    candidates.add(current);
    candidates.add(stripBotanicalPrefix(current));
    candidates.add(stripCultivarQuotes(stripBotanicalPrefix(current)));

    TRAILING_PHRASES.forEach((phrase) => {
      if (current.endsWith(` ${phrase}`)) {
        candidates.add(current.slice(0, -(phrase.length + 1)).trim());
      }
    });
  });

  return [...candidates].filter(Boolean).slice(0, MAX_QUERIES_PER_RECORD);
}

function parseAttributes(tag) {
  const attributes = {};
  const attrRegex = /([a-zA-Z0-9:_-]+)="([^"]*)"/g;
  let match;

  while ((match = attrRegex.exec(tag))) {
    attributes[match[1]] = decodeText(match[2]);
  }

  return attributes;
}

function extractSearchResults(html) {
  const results = [];
  const headingRegex = /<h2>[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<\/h2>/g;
  let match;

  while ((match = headingRegex.exec(html))) {
    const href = decodeText(match[1]);
    if (!href.startsWith("/plants/")) continue;
    results.push({
      url: new URL(href, NCSU_BASE_URL).toString(),
      title: stripHtml(match[2]),
    });
  }

  return uniqueValues(results.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));
}

function buildRecordTerms(record) {
  return uniqueValues([
    record.display_name,
    record.canonical_name,
    record.scientific_name,
    ...(record.aliases || []),
    ...(record.search_terms || []),
  ].filter(Boolean)).map((value) => normalizePhrase(value)).filter(Boolean);
}

function buildCultivarTerms(record) {
  const species = normalizePhrase(record.species || "");
  const blacklist = new Set([
    "",
    "acer",
    "japanese maple",
    "japanese maples",
    species,
  ]);

  return uniqueValues(
    buildRecordTerms(record)
      .flatMap((term) => uniqueValues([
        term,
        stripBotanicalPrefix(term),
        stripCultivarQuotes(stripBotanicalPrefix(term)),
      ]))
      .map((term) => term.trim())
      .filter((term) => term && term.length >= 4 && !blacklist.has(term)),
  );
}

function scoreResult(record, result) {
  const title = normalizePhrase(result.title);
  const url = normalizePhrase(result.url);
  const terms = buildRecordTerms(record);
  const cultivarTerms = buildCultivarTerms(record);
  const species = normalizePhrase(record.species || "");
  let score = 0;

  terms.forEach((term) => {
    if (!term) return;
    const stripped = stripCultivarQuotes(stripBotanicalPrefix(term));

    if (title === term || title === stripped) score += 40;
    if (title.includes(term) || (stripped && title.includes(stripped))) score += 8;
    if (url.includes(term.replace(/\s+/g, "-")) || (stripped && url.includes(stripped.replace(/\s+/g, "-")))) {
      score += 10;
    }
  });

  cultivarTerms.forEach((term) => {
    if (title === term) score += 180;
    if (title.includes(term)) score += 70;
    if (url.includes(term.replace(/\s+/g, "-"))) {
      score += 30;
    }
  });

  if (title === species || title === "acer palmatum") score -= 120;
  if (title.includes("'")) score += 10;

  return score;
}

function isGenericSpeciesResult(record, result) {
  const species = normalizePhrase(record.species || "");
  const title = normalizePhrase(result.title);
  const url = normalizePhrase(result.url);
  const cultivarTerms = buildCultivarTerms(record);

  if (!(title === species || title === "acer palmatum")) {
    return false;
  }

  return !cultivarTerms.some((term) => (
    title.includes(term) || url.includes(term.replace(/\s+/g, "-"))
  ));
}

async function searchNcsu(record) {
  const queries = buildCandidateQueries(record);
  const seenUrls = new Map();

  for (const query of queries) {
    try {
      const html = await fetchText(`${NCSU_SEARCH_URL}?q=${encodeURIComponent(query)}`);
      const results = extractSearchResults(html);

      results.forEach((result) => {
        const score = scoreResult(record, result);
        const current = seenUrls.get(result.url);
        if (!current || score > current.score) {
          seenUrls.set(result.url, {
            ...result,
            match_query: query,
            score,
          });
        }
      });
      const ranked = [...seenUrls.values()].sort((a, b) => b.score - a.score);
      const bestResult = ranked[0];
      if (
        bestResult
        && bestResult.score >= 180
        && normalizePhrase(bestResult.title).includes("acer")
      ) {
        break;
      }
      await sleep(REQUEST_DELAY_MS);
    } catch {}
  }

  return [...seenUrls.values()].sort((a, b) => b.score - a.score);
}

function extractCommonNames(html) {
  const blockMatch = html.match(/<ul class="" id="common_names">([\s\S]*?)<\/ul>/i);
  if (!blockMatch) return [];
  const names = [...blockMatch[1].matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map((match) => stripHtml(match[1]));
  return uniqueValues(names);
}

function extractDescription(html) {
  const match = html.match(/<dt>Description<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i);
  return match ? cleanDescriptionText(stripHtml(match[1])) : "";
}

function extractDimensions(html) {
  const blockMatch = html.match(/<dt>Dimensions:<\/dt>([\s\S]*?)(?:<dt|<\/dl>)/i);
  if (!blockMatch) return {};

  const values = [...blockMatch[1].matchAll(/<dd><span class="detail_display_attribute">([^<]+)<\/span><\/dd>/g)]
    .map((match) => decodeText(match[1]));
  const dimensions = {};

  values.forEach((value) => {
    if (value.startsWith("Height:")) dimensions.height = value.replace(/^Height:\s*/i, "");
    if (value.startsWith("Width:")) dimensions.width = value.replace(/^Width:\s*/i, "");
  });

  return dimensions;
}

function extractTags(html) {
  return uniqueValues(
    [...html.matchAll(/class="badge badge-secondary mx-1"[^>]*>(#[^<]+)<\/a>/g)]
      .map((match) => decodeText(match[1]).replace(/^#/, "")),
  );
}

function extractImages(html) {
  const items = [];
  const imgRegex = /<img class="img-thumbnail modal_img"[\s\S]*?\/>/g;

  for (const match of html.matchAll(imgRegex)) {
    const attrs = parseAttributes(match[0]);
    if (!attrs["data-downloadurl"]) continue;
    items.push({
      alt: attrs["data-alt"] || attrs.alt || "",
      attribution: attrs["data-attrib"] || "",
      caption: attrs["data-caption"] || "",
      download_url: attrs["data-downloadurl"],
      image_id: attrs["data-image-id"] || null,
      license_html: attrs["data-license"] || "",
      preview_url: attrs.src || "",
    });
  }

  return items.filter((item, index, array) => array.findIndex((entry) => entry.download_url === item.download_url) === index);
}

function extractPageTitle(html) {
  const match = html.match(/<h1>[\s\S]*?<em>([\s\S]*?)<\/em>/i);
  return match ? stripHtml(match[1]) : "";
}

function isDetailMatch(record, detail) {
  const cultivarTerms = buildCultivarTerms(record);
  const title = normalizePhrase(detail.page_title);
  const commonNames = detail.common_names.map((name) => normalizePhrase(name));
  const species = normalizePhrase(record.species || "");

  if (species.startsWith("acer") && !title.includes("acer")) {
    return false;
  }

  if (!cultivarTerms.length) {
    return title === species || title.includes(species);
  }

  return cultivarTerms.some((term) => (
    title.includes(term)
      || commonNames.some((name) => name.includes(term))
  ));
}

async function fetchDetail(url) {
  const html = await fetchText(url);
  return {
    common_names: extractCommonNames(html),
    description: extractDescription(html),
    dimensions: extractDimensions(html),
    images: extractImages(html),
    page_title: extractPageTitle(html),
    tags: extractTags(html),
    url,
  };
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function persistProgress(records, report, dryRun) {
  if (dryRun) return;
  await saveRecords(records);
  await writeJson(REPORT_PATH, report);
}

async function downloadImages(record, detail, dryRun) {
  if (!detail.images.length) {
    return { downloaded: 0 };
  }

  const targetDir = path.join(ncsuImagesRoot, sanitizePathSegment(record.id));
  if (!dryRun) {
    await ensureDir(targetDir);
  }

  const localFiles = [];
  const downloadItems = [];

  for (const [index, image] of detail.images.entries()) {
    const cleanUrl = image.download_url.split("?")[0];
    const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(path.basename(cleanUrl) || image.caption || image.alt || "image")}`;
    const targetPath = path.join(targetDir, fileName);
    const localPath = path.relative(process.cwd(), targetPath);

    let downloadMeta = {
      bytes: 0,
      contentType: "image/jpeg",
    };

    if (!dryRun) {
      downloadMeta = await downloadBinary(image.download_url, targetPath, { referer: detail.url });
    }

    localFiles.push(localPath);
    downloadItems.push({
      index: index + 1,
      source_url: image.download_url,
      preview_url: image.preview_url,
      local_path: localPath,
      caption: image.caption,
      attribution: image.attribution,
      license_html: image.license_html,
      content_type: downloadMeta.contentType,
      bytes: downloadMeta.bytes,
      downloaded_at: new Date().toISOString(),
      status: dryRun ? "planned" : "downloaded",
      source_name: "NCSU Plant Toolbox",
      usage_note: "Respect source license and attribution shown on the NCSU Plant Toolbox page.",
    });
  }

  record.ncsu = {
    source_name: "NCSU Plant Toolbox",
    detail_url: detail.url,
    page_title: detail.page_title,
    common_names: detail.common_names,
    description_text: detail.description,
    dimensions: detail.dimensions,
    tags: detail.tags,
    local_file_count: localFiles.length,
    cover_path: localFiles[0] || null,
    local_files: localFiles,
    images: {
      download_items: downloadItems,
      downloaded_count: localFiles.length,
      local_files: localFiles,
    },
  };

  record.has_ncsu = true;
  record.sources = [
    ...(record.sources || []).filter((source) => source.source !== "ncsu"),
    {
      source: "ncsu",
      name: detail.page_title || record.display_name,
      botanical_name: detail.page_title || record.scientific_name || record.display_name,
      detail_url: detail.url,
      description: detail.description,
      image_count: detail.images.length,
      common_names: detail.common_names,
      dimensions: detail.dimensions,
      tags: detail.tags,
      usage_note: "Respect source license and attribution shown on the NCSU Plant Toolbox page.",
    },
  ];
  record.source_count = record.sources.length;

  return { downloaded: localFiles.length };
}

function buildCandidates(records, idsFilter, force) {
  return records.filter((record) => {
    if (idsFilter && !idsFilter.has(record.id)) return false;
    if (!force && getLocalImageCount(record) > 0) return false;
    return true;
  });
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const idsFilter = parseIdsFilter();
  const limit = parseLimit(200);
  const records = await loadRecords();
  const candidates = buildCandidates(records, idsFilter, force).slice(0, limit);

  const report = {
    generated_at: new Date().toISOString(),
    total_candidates: candidates.length,
    matched: [],
    unmatched: [],
  };

  const missingSummary = candidates.map((record) => ({
    id: record.id,
    display_name: record.display_name,
    scientific_name: record.scientific_name,
    aliases: (record.aliases || []).slice(0, 8),
  }));

  if (!dryRun) {
    await writeJson(MISSING_PATH, missingSummary);
  }

  console.log(`NCSU missing-image candidates: ${candidates.length}`);

  let matchedRecords = 0;
  let downloadedImages = 0;
  let dirtyRecords = 0;

  for (const record of candidates) {
    try {
      const results = await searchNcsu(record);
      const bestResult = results[0];

      if (!bestResult || bestResult.score < 60 || isGenericSpeciesResult(record, bestResult)) {
        report.unmatched.push({
          id: record.id,
          display_name: record.display_name,
          top_results: results.slice(0, 5),
        });
        console.log(`${record.id}: no confident NCSU match`);
        await sleep(REQUEST_DELAY_MS);
      } else {
        const detail = await fetchDetail(bestResult.url);
        if (!isDetailMatch(record, detail)) {
          report.unmatched.push({
            id: record.id,
            display_name: record.display_name,
            reason: "detail_page_not_specific",
            detail_url: detail.url,
            page_title: detail.page_title,
          });
          console.log(`${record.id}: rejected non-specific NCSU page "${detail.page_title}"`);
          await sleep(REQUEST_DELAY_MS);
        } else {
          const downloadResult = await downloadImages(record, detail, dryRun);

          report.matched.push({
            id: record.id,
            display_name: record.display_name,
            detail_url: detail.url,
            page_title: detail.page_title,
            match_query: bestResult.match_query,
            match_score: bestResult.score,
            image_count: detail.images.length,
            downloaded_count: downloadResult.downloaded,
          });

          matchedRecords += 1;
          downloadedImages += downloadResult.downloaded;
          console.log(`${record.id}: matched "${detail.page_title}" with ${downloadResult.downloaded} images`);
          await sleep(REQUEST_DELAY_MS);
        }
      }
    } catch (error) {
      report.unmatched.push({
        id: record.id,
        display_name: record.display_name,
        reason: error.message,
      });
      console.error(`${record.id}: ${error.message}`);
      await sleep(REQUEST_DELAY_MS);
    }

    dirtyRecords += 1;
    if (dirtyRecords >= SAVE_EVERY_RECORDS) {
      await persistProgress(records, report, dryRun);
      dirtyRecords = 0;
    }
  }

  await persistProgress(records, report, dryRun);

  console.log(`NCSU done. matched_records=${matchedRecords}, downloaded_images=${downloadedImages}, dryRun=${dryRun}`);
}

await main();
