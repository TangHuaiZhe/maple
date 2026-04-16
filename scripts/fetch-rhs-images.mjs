import path from "node:path";
import {
  ensureDir,
  fetchJson,
  hasFlag,
  loadRecords,
  parseIdsFilter,
  parseLimit,
  rhsImagesRoot,
  sanitizePathSegment,
  saveRecords,
  downloadBinary,
} from "./fetch-image-common.mjs";

const RHS_API_BASE = "https://lwapp-uks-prod-psearch-01.azurewebsites.net/api/v1/plants/details";
const RHS_IMAGE_BASE = "https://apps.rhs.org.uk/plantselectorimages/detail/";

function buildCandidates(records, idsFilter, force) {
  return records.filter((record) => {
    if (idsFilter && !idsFilter.has(record.id)) return false;
    if (!record.rhs?.rhs_id) return false;
    if (!force && (record.rhs?.images?.local_files || []).length > 0) return false;
    return true;
  });
}

function createRhsImageMetadata(record, filenames, localFiles, downloadItems) {
  return {
    count: filenames.length,
    filenames,
    download_source: {
      name: "Royal Horticultural Society (RHS)",
      base_url: RHS_IMAGE_BASE,
      usage_note: "Private local archive only. Do not redistribute without confirming RHS rights.",
    },
    local_files: localFiles,
    downloaded_count: downloadItems.length,
    download_items: downloadItems,
  };
}

async function fetchRhsPlantDetails(rhsId) {
  return fetchJson(`${RHS_API_BASE}/${rhsId}`);
}

async function downloadRhsImages(record, dryRun) {
  const plant = await fetchRhsPlantDetails(record.rhs.rhs_id);
  const rawImages = plant.images || [];
  const images = rawImages.filter((image) => image?.image && image.image.trim());

  if (!images.length) {
    return { downloaded: 0, found: 0, rawFound: rawImages.length };
  }

  const dirName = sanitizePathSegment(record.id);
  const targetDir = path.join(rhsImagesRoot, dirName);

  if (!dryRun) {
    await ensureDir(targetDir);
  }

  const filenames = [];
  const localFiles = [];
  const downloadItems = [];

  for (const [index, image] of images.entries()) {
    const sourceFilename = image.image;
    const sourceUrl = `${RHS_IMAGE_BASE}${sourceFilename}`;
    const numberedName = `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(sourceFilename)}`;
    const targetPath = path.join(targetDir, numberedName);
    const localPath = path.relative(process.cwd(), targetPath);

    filenames.push(sourceFilename);
    localFiles.push(localPath);

    let downloadMeta = {
      bytes: 0,
      contentType: "image/jpeg",
    };

    if (!dryRun) {
      downloadMeta = await downloadBinary(sourceUrl, targetPath, { referer: record.rhs.rhs_url });
    }

    downloadItems.push({
      index: index + 1,
      filename: sourceFilename,
      source_url: sourceUrl,
      source_page_url: record.rhs.rhs_url,
      copyright: image.copyRight || null,
      local_path: localPath,
      content_type: downloadMeta.contentType,
      bytes: downloadMeta.bytes,
      downloaded_at: new Date().toISOString(),
      status: dryRun ? "planned" : "downloaded",
      source_name: "Royal Horticultural Society (RHS)",
      usage_note: "Private local archive only. Do not redistribute without confirming RHS rights.",
    });
  }

  record.rhs.images = createRhsImageMetadata(record, filenames, localFiles, downloadItems);
  return { downloaded: localFiles.length, found: images.length, rawFound: rawImages.length };
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const idsFilter = parseIdsFilter();
  const limit = parseLimit(20);
  const records = await loadRecords();
  const candidates = buildCandidates(records, idsFilter, force).slice(0, limit);

  console.log(`RHS candidates: ${candidates.length}`);

  let downloadedRecords = 0;
  let downloadedImages = 0;

  for (const record of candidates) {
    try {
      const result = await downloadRhsImages(record, dryRun);
      if (result.downloaded > 0) {
        downloadedRecords += 1;
        downloadedImages += result.downloaded;
      }
      console.log(`${record.id}: found ${result.found}/${result.rawFound}, downloaded ${result.downloaded}`);
    } catch (error) {
      console.error(`${record.id}: ${error.message}`);
    }
  }

  if (!dryRun) {
    await saveRecords(records);
  }

  console.log(`RHS done. records=${downloadedRecords}, images=${downloadedImages}, dryRun=${dryRun}`);
}

await main();
