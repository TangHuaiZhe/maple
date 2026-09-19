import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectReferencedImagePaths,
  formatBytes,
  loadRecords,
  scanImageFiles,
} from "./image-audit";
import type { CultivarRecord } from "../src/types";
import type { ImageFile } from "./image-audit";

interface ThumbnailOptions {
  coversOnly: boolean;
  help: boolean;
  includeAll: boolean;
  limit: number;
  minSourceBytes: number;
  publicRoot: string;
  sizes: number[];
  sourceDir: string;
  write: boolean;
}

interface ThumbnailJob {
  sourceFilePath: string;
  sourcePublicPath: string;
  thumbFilePath: string;
  thumbPublicPath: string;
  width: number;
}

type ThumbnailManifest = Record<string, Partial<Record<number, string>>>;

interface SharpPipeline {
  rotate(): SharpPipeline;
  resize(options: { width: number; withoutEnlargement: boolean }): SharpPipeline;
  webp(options: { quality: number }): SharpPipeline;
  toFile(filePath: string): Promise<unknown>;
}

type SharpFactory = (sourceFilePath: string) => SharpPipeline;

const appRoot = process.cwd();
const publicRoot = path.join(appRoot, "public");
const manifestPath = path.join(publicRoot, "data", "image-thumbs.json");
const defaultSizes = [480, 960];
const defaultMinSourceBytes = 250 * 1024;

function normalizePublicPath(value: unknown): string {
  const pathname = String(value || "").split("?")[0];
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.startsWith("/") ? decoded : `/${decoded}`;
  } catch {
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  }
}

function getTopLevelDirectory(publicPath: string): string {
  return normalizePublicPath(publicPath).replace(/^\/+/, "").split("/")[0] || "";
}

function parseArgs(argv: string[]): ThumbnailOptions {
  const options = {
    coversOnly: false,
    help: false,
    includeAll: false,
    limit: Number.POSITIVE_INFINITY,
    minSourceBytes: Number(process.env.THUMB_MIN_SOURCE_BYTES || defaultMinSourceBytes),
    publicRoot,
    sizes: defaultSizes,
    sourceDir: "",
    write: false,
  };

  for (const arg of argv) {
    if (arg === "--all") {
      options.includeAll = true;
    } else if (arg === "--covers-only") {
      options.coversOnly = true;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (arg.startsWith("--min-source-bytes=")) {
      options.minSourceBytes = Number(arg.slice("--min-source-bytes=".length));
    } else if (arg.startsWith("--sizes=")) {
      options.sizes = arg
        .slice("--sizes=".length)
        .split(",")
        .map((size) => Number(size.trim()))
        .filter(Boolean);
    } else if (arg.startsWith("--source-dir=")) {
      options.sourceDir = arg.slice("--source-dir=".length).replace(/^\/+|\/+$/g, "");
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }

  return options;
}

function collectCoverImagePaths(records: CultivarRecord[] = []): Set<string> {
  return new Set((records || [])
    .flatMap((record) => [
      record.cover_path,
      record.images?.public_cover_path,
    ])
    .filter(Boolean)
    .map(normalizePublicPath));
}

function printHelp() {
  console.log(`Generate responsive WebP thumbnails under public/thumbs.

Usage:
  npm run image:thumbs
  npm run image:thumbs:write -- --source-dir=mrmaple-images --limit=100

Options:
  --write                 Generate files. Without it, only prints a dry-run plan.
  --all                   Include unreferenced and small source images.
  --covers-only           Generate thumbnails only for catalog cover images.
  --source-dir=<dir>      Restrict to one public image directory.
  --sizes=480,960         Thumbnail widths. Default: 480,960.
  --min-source-bytes=<n>  Skip non-cover sources smaller than this. Default: 256000.
  --limit=<n>             Limit planned/generated jobs.
`);
}

export function createThumbnailPublicPath(sourcePublicPath: string, width: number): string {
  const normalized = normalizePublicPath(sourcePublicPath);
  const parsed = path.posix.parse(normalized);
  return path.posix.join(
    "/thumbs",
    parsed.dir.replace(/^\/+/, ""),
    `${parsed.name}-w${width}.webp`,
  );
}

export function planThumbnailJobs({
  coverPaths = new Set(),
  existingThumbPaths = new Set(),
  imageFiles,
  includeAll = false,
  coversOnly = false,
  minSourceBytes = defaultMinSourceBytes,
  publicRoot: root = publicRoot,
  referencedPaths,
  sizes = defaultSizes,
  sourceDir = "",
}: {
  coverPaths?: Set<string>;
  existingThumbPaths?: Set<string>;
  imageFiles: ImageFile[];
  includeAll?: boolean;
  coversOnly?: boolean;
  minSourceBytes?: number;
  publicRoot?: string;
  referencedPaths?: Set<string>;
  sizes?: number[];
  sourceDir?: string;
}): ThumbnailJob[] {
  const jobs = [];
  const normalizedCoverPaths = new Set([...coverPaths].map(normalizePublicPath));
  const normalizedReferencedPaths = referencedPaths
    ? new Set([...referencedPaths].map(normalizePublicPath))
    : referencedPaths;

  const prioritizedImageFiles = [...(imageFiles || [])].sort((a, b) => (
    b.size - a.size || normalizePublicPath(a.publicPath).localeCompare(normalizePublicPath(b.publicPath))
  ));

  for (const file of prioritizedImageFiles) {
    const sourcePublicPath = normalizePublicPath(file.publicPath);

    if (sourcePublicPath.startsWith("/thumbs/")) {
      continue;
    }

    if (sourceDir && getTopLevelDirectory(sourcePublicPath) !== sourceDir) {
      continue;
    }

    const isReferenced = normalizedReferencedPaths?.has(sourcePublicPath);
    const isCover = normalizedCoverPaths.has(sourcePublicPath);

    if (coversOnly && !isCover) {
      continue;
    }

    if (!includeAll && !isReferenced) {
      continue;
    }

    if (!includeAll && !isCover && file.size < minSourceBytes) {
      continue;
    }

    for (const width of sizes) {
      const thumbPublicPath = createThumbnailPublicPath(sourcePublicPath, width);
      if (existingThumbPaths.has(thumbPublicPath)) {
        continue;
      }

      jobs.push({
        sourceFilePath: file.filePath || path.join(root, sourcePublicPath.replace(/^\/+/, "")),
        sourcePublicPath,
        thumbFilePath: path.join(root, thumbPublicPath.replace(/^\/+/, "")),
        thumbPublicPath,
        width,
      });
    }
  }

  return jobs;
}

export function createThumbnailManifest({
  existingThumbPaths = new Set(),
  generatedJobs = [],
  imageFiles,
  sizes = defaultSizes,
}: {
  existingThumbPaths?: Set<string>;
  generatedJobs?: ThumbnailJob[];
  imageFiles: ImageFile[];
  sizes?: number[];
}): ThumbnailManifest {
  const availableThumbPaths = new Set([
    ...existingThumbPaths,
    ...generatedJobs.map((job) => job.thumbPublicPath),
  ]);
  const manifest: ThumbnailManifest = {};

  for (const file of imageFiles || []) {
    const sourcePublicPath = normalizePublicPath(file.publicPath);
    if (sourcePublicPath.startsWith("/thumbs/")) {
      continue;
    }

    for (const width of sizes) {
      const thumbPublicPath = createThumbnailPublicPath(sourcePublicPath, width);
      if (!availableThumbPaths.has(thumbPublicPath)) {
        continue;
      }

      manifest[sourcePublicPath] = {
        ...(manifest[sourcePublicPath] || {}),
        [width]: thumbPublicPath,
      };
    }
  }

  return manifest;
}

async function writeThumbnailManifest({
  existingThumbPaths,
  generatedJobs,
  imageFiles,
  sizes,
}: {
  existingThumbPaths: Set<string>;
  generatedJobs: ThumbnailJob[];
  imageFiles: ImageFile[];
  sizes: number[];
}): Promise<ThumbnailManifest> {
  const manifest = createThumbnailManifest({
    existingThumbPaths,
    generatedJobs,
    imageFiles,
    sizes,
  });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function generateThumbnail(job: ThumbnailJob, sharp: SharpFactory): Promise<void> {
  await fs.mkdir(path.dirname(job.thumbFilePath), { recursive: true });
  await sharp(job.sourceFilePath)
    .rotate()
    .resize({ width: job.width, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(job.thumbFilePath);
}

function printPlan({
  jobs,
  options,
  totalImageFiles,
  totalExistingThumbs,
}: {
  jobs: ThumbnailJob[];
  options: ThumbnailOptions;
  totalImageFiles: number;
  totalExistingThumbs: number;
}): void {
  const mode = options.write ? "write" : "dry-run";
  const sourceScope = options.sourceDir || "all image directories";

  console.log(`Thumbnail plan (${mode}): ${jobs.length} jobs`);
  console.log(`Source scope: ${sourceScope}`);
  console.log(`Sizes: ${options.sizes.join(", ")}`);
  console.log(`Minimum source size: ${formatBytes(options.minSourceBytes)} unless cover image`);
  console.log(`Scanned: ${totalImageFiles} source files, ${totalExistingThumbs} existing thumbnails`);

  for (const job of jobs.slice(0, 20)) {
    console.log(`- ${job.sourcePublicPath} -> ${job.thumbPublicPath}`);
  }

  if (jobs.length > 20) {
    console.log(`- ... ${jobs.length - 20} more`);
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const [records, imageFiles, thumbFiles] = await Promise.all([
    loadRecords(),
    scanImageFiles(options.sourceDir ? [options.sourceDir] : undefined),
    scanImageFiles(["thumbs"]),
  ]);
  const referencedPaths = collectReferencedImagePaths(records);
  const coverPaths = collectCoverImagePaths(records);
  const existingThumbPaths = new Set(thumbFiles.map((file) => file.publicPath));
  const jobs = planThumbnailJobs({
    coverPaths,
    coversOnly: options.coversOnly,
    existingThumbPaths,
    imageFiles,
    includeAll: options.includeAll,
    minSourceBytes: options.minSourceBytes,
    publicRoot: options.publicRoot,
    referencedPaths,
    sizes: options.sizes,
    sourceDir: options.sourceDir,
  }).slice(0, options.limit);

  printPlan({
    jobs,
    options,
    totalExistingThumbs: thumbFiles.length,
    totalImageFiles: imageFiles.length,
  });

  if (!options.write || !jobs.length) {
    return;
  }

  let sharp: SharpFactory;
  try {
    sharp = (await import("sharp")).default as unknown as SharpFactory;
  } catch {
    throw new Error("Missing dependency: run `npm install` before generating thumbnails.");
  }

  let generated = 0;
  const generatedJobs: ThumbnailJob[] = [];
  for (const job of jobs) {
    await generateThumbnail(job, sharp);
    existingThumbPaths.add(job.thumbPublicPath);
    generatedJobs.push(job);
    generated += 1;
  }

  console.log(`Generated ${generated} thumbnails.`);
  const manifest = await writeThumbnailManifest({
    existingThumbPaths,
    generatedJobs,
    imageFiles,
    sizes: options.sizes,
  });
  console.log(`Wrote ${Object.keys(manifest).length} manifest entries to public/data/image-thumbs.json.`);
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
