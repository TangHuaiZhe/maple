import fs from "node:fs/promises";
import path from "node:path";

export const appRoot = process.cwd();
export const sourceRoot = path.join(appRoot, "data-source");
export const enhancedJson = path.join(sourceRoot, "Resource/园艺/raw/merged-cultivars-with-rhs.json");
export const rhsImagesRoot = path.join(sourceRoot, "Resource/园艺/raw/rhs-images");
export const mrMapleImagesRoot = path.join(sourceRoot, "Resource/园艺/raw/mrmaple-images");
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 3;
export const herterImagesRoot = path.join(sourceRoot, "Resource/园艺/raw/herter-images");
export const ncsuImagesRoot = path.join(sourceRoot, "Resource/园艺/raw/ncsu-images");
export const coniferImagesRoot = path.join(sourceRoot, "Resource/园艺/raw/coniferkingdom-images");

const HTML_ENTITY_MAP = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

export function hasContent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

export function stripHtml(text) {
  if (!hasContent(text)) return "";
  return decodeHtmlEntities(String(text).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function normalizeText(text) {
  return decodeHtmlEntities(String(text || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

export function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&([a-z]+);/gi, (match, value) => HTML_ENTITY_MAP[value.toLowerCase()] || match);
}

export function sanitizePathSegment(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "item";
}

export function getArgValue(name) {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  const arg = process.argv.find((value) => value === exact || value.startsWith(prefix));

  if (!arg) return null;
  if (arg === exact) {
    const index = process.argv.indexOf(arg);
    return process.argv[index + 1] && !process.argv[index + 1].startsWith("--")
      ? process.argv[index + 1]
      : "true";
  }

  return arg.slice(prefix.length);
}

export function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function loadRecords() {
  const raw = await fs.readFile(enhancedJson, "utf8");
  return JSON.parse(raw);
}

export async function saveRecords(records) {
  await fs.writeFile(enhancedJson, JSON.stringify(records, null, 2), "utf8");
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(response, attempt) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }

  return 1500 * (attempt + 1);
}

async function fetchWithRetry(url, init = {}) {
  const { retries = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...rest,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if ((response.status === 429 || response.status >= 500) && attempt < retries - 1) {
        await sleep(getRetryDelayMs(response, attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt === retries - 1) {
        throw error;
      }

      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError || new Error(`Request failed for ${url}`);
}

export async function fetchText(url, init = {}) {
  const response = await fetchWithRetry(url, {
    ...init,
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; japanese-maple-showcase-web/1.0)",
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

export async function fetchJson(url, init = {}) {
  const response = await fetchWithRetry(url, {
    ...init,
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; japanese-maple-showcase-web/1.0)",
      accept: "application/json,text/plain,*/*",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

export async function downloadBinary(url, targetPath, init = {}) {
  const response = await fetchWithRetry(url, {
    ...init,
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; japanese-maple-showcase-web/1.0)",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: init.referer || undefined,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(targetPath, buffer);

  return {
    bytes: buffer.length,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

export function parseIdsFilter() {
  const raw = getArgValue("ids");
  return raw ? new Set(raw.split(",").map((value) => value.trim()).filter(Boolean)) : null;
}

export function parseLimit(defaultValue = 20) {
  const raw = getArgValue("limit");
  return raw ? Number.parseInt(raw, 10) || defaultValue : defaultValue;
}
