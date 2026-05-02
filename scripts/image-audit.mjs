import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = process.cwd();
const publicRoot = path.join(appRoot, "public");
const dataRoot = path.join(publicRoot, "data");
const detailsRoot = path.join(dataRoot, "details");
const defaultImageDirs = [
  "mrmaple-images",
  "rhs-images",
  "herter-images",
  "ncsu-images",
  "coniferkingdom-images",
  "jmac-images",
  "user-images",
];
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
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

function isPublicImagePath(value) {
  return /^\/[^/]/.test(String(value || ""));
}

function normalizePublicPath(value) {
  const pathname = String(value || "").split("?")[0];
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function collectRecordImagePaths(record) {
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

  return values.filter(isPublicImagePath).map(normalizePublicPath);
}

export function collectReferencedImagePaths(records) {
  return new Set((records || []).flatMap(collectRecordImagePaths));
}

export function summarizeImageFiles(imageFiles) {
  const byDirectory = new Map();
  const total = { files: 0, bytes: 0 };

  for (const file of imageFiles || []) {
    const directory = String(file.publicPath || "").replace(/^\/+/, "").split("/")[0] || "(unknown)";
    const current = byDirectory.get(directory) || { directory, files: 0, bytes: 0 };

    current.files += 1;
    current.bytes += file.size;
    total.files += 1;
    total.bytes += file.size;

    byDirectory.set(directory, current);
  }

  return {
    directories: [...byDirectory.values()].sort((a, b) => b.bytes - a.bytes || a.directory.localeCompare(b.directory)),
    total,
  };
}

export function createImageAuditReport({
  imageFiles,
  referencedPaths,
  oversizedThresholdBytes,
  limit = 20,
}) {
  const summary = summarizeImageFiles(imageFiles);
  const sortedBySize = [...imageFiles].sort((a, b) => b.size - a.size || a.publicPath.localeCompare(b.publicPath));

  return {
    ...summary,
    oversizedFiles: sortedBySize
      .filter((file) => file.size >= oversizedThresholdBytes)
      .slice(0, limit),
    unreferencedFiles: sortedBySize
      .filter((file) => !referencedPaths.has(file.publicPath))
      .slice(0, limit),
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function loadRecords() {
  const catalogRecords = await readJson(path.join(dataRoot, "catalog.json"));
  const detailEntries = await fs.readdir(detailsRoot);
  const detailRecords = [];

  for (const entry of detailEntries.filter((item) => item.endsWith(".json")).sort()) {
    detailRecords.push(await readJson(path.join(detailsRoot, entry)));
  }

  return [...catalogRecords, ...detailRecords];
}

async function scanImageDir(dirName) {
  const dirPath = path.join(publicRoot, dirName);
  const files = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const filePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(filePath);
        continue;
      }

      if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      const stat = await fs.stat(filePath);
      const relativePath = path.relative(path.join(publicRoot, dirName), filePath).split(path.sep).join("/");
      files.push({
        publicPath: `/${dirName}/${relativePath}`,
        size: stat.size,
      });
    }
  }

  await walk(dirPath);
  return files;
}

async function scanImageFiles(imageDirs = defaultImageDirs) {
  const nested = await Promise.all(imageDirs.map(scanImageDir));
  return nested.flat();
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function printReport(report, { oversizedThresholdBytes }) {
  console.log(`Image audit: ${report.total.files} files, ${formatBytes(report.total.bytes)}`);
  console.log("");
  console.log("By directory:");
  for (const directory of report.directories) {
    console.log(`- ${directory.directory}: ${directory.files} files, ${formatBytes(directory.bytes)}`);
  }

  console.log("");
  console.log(`Largest files at or above ${formatBytes(oversizedThresholdBytes)}:`);
  if (!report.oversizedFiles.length) {
    console.log("- none");
  } else {
    for (const file of report.oversizedFiles) {
      console.log(`- ${formatBytes(file.size)} ${file.publicPath}`);
    }
  }

  console.log("");
  console.log("Largest unreferenced files:");
  if (!report.unreferencedFiles.length) {
    console.log("- none");
  } else {
    for (const file of report.unreferencedFiles) {
      console.log(`- ${formatBytes(file.size)} ${file.publicPath}`);
    }
  }
}

async function run() {
  const oversizedThresholdBytes = Number(process.env.IMAGE_AUDIT_LARGE_BYTES || 1024 * 1024);
  const limit = Number(process.env.IMAGE_AUDIT_LIMIT || 20);
  const [records, imageFiles] = await Promise.all([
    loadRecords(),
    scanImageFiles(),
  ]);
  const referencedPaths = collectReferencedImagePaths(records);
  const report = createImageAuditReport({
    imageFiles,
    referencedPaths,
    oversizedThresholdBytes,
    limit,
  });

  printReport(report, { oversizedThresholdBytes });
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  run().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
