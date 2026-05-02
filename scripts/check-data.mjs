import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = process.cwd();
const publicDataDir = path.join(appRoot, "public/data");
const detailDir = path.join(publicDataDir, "details");
const publicDir = path.join(appRoot, "public");

const consistencyFields = [
  "display_name",
  "chinese_name",
  "canonical_name",
  "scientific_name",
];

const imagePathKeys = [
  "public_cover_path",
  "public_paths",
  "public_rhs_paths",
  "public_mrmaple_paths",
  "public_herter_paths",
  "public_ncsu_paths",
  "public_conifer_paths",
  "public_jmac_paths",
  "public_user_paths",
];

function result() {
  return { errors: [], warnings: [] };
}

function byId(records) {
  return new Map((records || []).map((record) => [record.id, record]));
}

function formatValue(value) {
  return value == null || value === "" ? "∅" : String(value);
}

function sameValue(a, b, c) {
  return formatValue(a) === formatValue(b) && formatValue(b) === formatValue(c);
}

function collectPublicImagePaths(record) {
  const values = [
    record.cover_path,
    record.images?.public_cover_path,
  ];

  for (const key of imagePathKeys) {
    const value = record.images?.[key];
    if (Array.isArray(value)) {
      values.push(...value);
    } else {
      values.push(value);
    }
  }

  return [...new Set(values.filter((value) => /^\/[^/]/.test(String(value || ""))))];
}

function publicPathToFilePath(publicPath) {
  const cleanPath = String(publicPath).split("?")[0].replace(/^\/+/, "");
  const decodedParts = cleanPath.split("/").map((part) => decodeURIComponent(part));
  return path.join(publicDir, ...decodedParts);
}

export function checkCatalogDetailConsistency({ catalogRecords, detailRecordsById, mergedRecords }) {
  const check = result();
  const mergedById = byId(mergedRecords);
  const catalogById = byId(catalogRecords);

  for (const catalogRecord of catalogRecords || []) {
    const id = catalogRecord.id;
    const detailRecord = detailRecordsById.get(id);
    const mergedRecord = mergedById.get(id);

    if (!detailRecord) {
      check.errors.push(`catalog id ${id} is missing public/data/details/${id}.json`);
      continue;
    }

    if (!mergedRecord) {
      check.errors.push(`catalog id ${id} is missing from public/data/merged-cultivars.json`);
      continue;
    }

    for (const field of consistencyFields) {
      if (!sameValue(catalogRecord[field], detailRecord[field], mergedRecord[field])) {
        check.errors.push(
          `${id} ${field} mismatch: catalog="${formatValue(catalogRecord[field])}" detail="${formatValue(detailRecord[field])}" merged="${formatValue(mergedRecord[field])}"`,
        );
      }
    }
  }

  for (const id of detailRecordsById.keys()) {
    if (!catalogById.has(id)) {
      check.warnings.push(`detail id ${id} is not present in public/data/catalog.json`);
    }
  }

  return check;
}

export function checkImagePathsExist({ records, publicPathExists = (publicPath) => fs.existsSync(publicPathToFilePath(publicPath)) }) {
  const check = result();

  for (const record of records || []) {
    for (const publicPath of collectPublicImagePaths(record)) {
      if (!publicPathExists(publicPath)) {
        check.errors.push(`${record.id} references missing image ${publicPath}`);
      }
    }
  }

  return check;
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

async function loadDetailRecordsById() {
  const entries = await fsp.readdir(detailDir);
  const records = new Map();

  for (const entry of entries.filter((item) => item.endsWith(".json")).sort()) {
    const record = await readJson(path.join(detailDir, entry));
    records.set(record.id, record);
  }

  return records;
}

function mergeChecks(checks) {
  return checks.reduce((merged, check) => {
    merged.errors.push(...check.errors);
    merged.warnings.push(...check.warnings);
    return merged;
  }, result());
}

async function run() {
  const catalogRecords = await readJson(path.join(publicDataDir, "catalog.json"));
  const mergedRecords = await readJson(path.join(publicDataDir, "merged-cultivars.json"));
  const detailRecordsById = await loadDetailRecordsById();
  const allDetailRecords = [...detailRecordsById.values()];

  return mergeChecks([
    checkCatalogDetailConsistency({ catalogRecords, detailRecordsById, mergedRecords }),
    checkImagePathsExist({ records: [...catalogRecords, ...allDetailRecords] }),
  ]);
}

function printCheck(check) {
  for (const warning of check.warnings) {
    console.warn(`warning: ${warning}`);
  }

  for (const error of check.errors) {
    console.error(`error: ${error}`);
  }

  if (check.errors.length) {
    console.error(`check:data failed with ${check.errors.length} error(s), ${check.warnings.length} warning(s)`);
    return;
  }

  console.log(`check:data passed with ${check.warnings.length} warning(s)`);
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  run()
    .then((check) => {
      printCheck(check);
      process.exitCode = check.errors.length ? 1 : 0;
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    });
}
