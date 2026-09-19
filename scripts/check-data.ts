import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AwardSelection, CultivarRecord } from "../src/types";

interface CheckResult {
  errors: string[];
  warnings: string[];
}

interface DetailFileRecord {
  fileName: string;
  record: CultivarRecord;
}

interface CatalogDetailConsistencyInput {
  catalogRecords: CultivarRecord[];
  detailRecordsById: Map<string, CultivarRecord>;
  mergedRecords: CultivarRecord[];
}

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

const imagePathKeys: Array<Exclude<keyof NonNullable<CultivarRecord["images"]>, "public_count">> = [
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

function result(): CheckResult {
  return { errors: [], warnings: [] };
}

function byId(records: CultivarRecord[] = []): Map<string, CultivarRecord> {
  return new Map((records || []).map((record) => [record.id, record]));
}

function formatValue(value: unknown): string {
  return value == null || value === "" ? "∅" : String(value);
}

function sameValue(a: unknown, b: unknown, c: unknown): boolean {
  return formatValue(a) === formatValue(b) && formatValue(b) === formatValue(c);
}

function collectPublicImagePaths(record: CultivarRecord): string[] {
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

  return [...new Set(values.filter((value): value is string => /^\/[^/]/.test(String(value || ""))))];
}

function publicPathToFilePath(publicPath: string): string {
  const cleanPath = String(publicPath).split("?")[0].replace(/^\/+/, "");
  const decodedParts = cleanPath.split("/").map((part) => decodeURIComponent(part));
  return path.join(publicDir, ...decodedParts);
}

export function checkCatalogDetailConsistency({ catalogRecords, detailRecordsById, mergedRecords }: CatalogDetailConsistencyInput): CheckResult {
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

export function checkImagePathsExist({
  records,
  publicPathExists = (publicPath: string) => fs.existsSync(publicPathToFilePath(publicPath)),
}: {
  records: CultivarRecord[];
  publicPathExists?: (publicPath: string) => boolean;
}): CheckResult {
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

export function checkDetailFileNameMatchesRecordId({ detailFileRecords }: { detailFileRecords: DetailFileRecord[] }): CheckResult {
  const check = result();

  for (const { fileName, record } of detailFileRecords || []) {
    const expectedId = fileName.replace(/\.json$/i, "");
    if (record?.id !== expectedId) {
      check.errors.push(`detail file public/data/details/${fileName} contains id ${formatValue(record?.id)}`);
    }
  }

  return check;
}

export function checkCuratedIdsExist({
  catalogRecords,
  popularIds,
  awardRecords,
}: {
  catalogRecords: CultivarRecord[];
  popularIds: string[];
  awardRecords: AwardSelection[];
}): CheckResult {
  const check = result();
  const catalogIds = new Set((catalogRecords || []).map((record) => record.id).filter(Boolean));

  for (const id of popularIds || []) {
    if (!catalogIds.has(id)) {
      check.errors.push(`popular id ${id} is missing from public/data/catalog.json`);
    }
  }

  for (const record of awardRecords || []) {
    if (!catalogIds.has(record?.id)) {
      check.errors.push(`award id ${formatValue(record?.id)} is missing from public/data/catalog.json`);
    }
  }

  return check;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fsp.readFile(filePath, "utf8")) as T;
}

async function loadDetailFileRecords(): Promise<DetailFileRecord[]> {
  const entries = await fsp.readdir(detailDir);
  const records = [];

  for (const entry of entries.filter((item) => item.endsWith(".json")).sort()) {
    const record = await readJson<CultivarRecord>(path.join(detailDir, entry));
    records.push({ fileName: entry, record });
  }

  return records;
}

function mergeChecks(checks: CheckResult[]): CheckResult {
  return checks.reduce((merged, check) => {
    merged.errors.push(...check.errors);
    merged.warnings.push(...check.warnings);
    return merged;
  }, result());
}

async function run() {
  const catalogRecords = await readJson<CultivarRecord[]>(path.join(publicDataDir, "catalog.json"));
  const mergedRecords = await readJson<CultivarRecord[]>(path.join(publicDataDir, "merged-cultivars.json"));
  const popularIds = await readJson<string[]>(path.join(publicDataDir, "popular-ids.json"));
  const awardRecords = await readJson<AwardSelection[]>(path.join(publicDataDir, "awards.json"));
  const detailFileRecords = await loadDetailFileRecords();
  const detailRecordsById = new Map(detailFileRecords.map(({ record }) => [record.id, record]));
  const allDetailRecords = [...detailRecordsById.values()];
  const checks = [
    checkCatalogDetailConsistency({ catalogRecords, detailRecordsById, mergedRecords }),
    checkDetailFileNameMatchesRecordId({ detailFileRecords }),
    checkCuratedIdsExist({ catalogRecords, popularIds, awardRecords }),
  ];

  if (process.env.CHECK_DATA_SKIP_IMAGE_PATHS !== "1") {
    checks.push(checkImagePathsExist({ records: [...catalogRecords, ...allDetailRecords] }));
  }

  return mergeChecks(checks);
}

function printCheck(check: CheckResult): void {
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
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
