import type {
  AssetUrlOptions,
  AwardSelection,
  CodedError,
  CultivarImages,
  CultivarRecord,
  DevRecordPayload,
  StorageLike,
  ThumbnailManifest,
} from "./types";

const APP_BASE_URL = import.meta.env?.BASE_URL || "/";
const ASSET_BASE_URL = import.meta.env?.VITE_ASSET_BASE_URL || APP_BASE_URL;
export const DEPLOY_CACHE_BUST = "20260808-1";
const FAVORITES_STORAGE_KEY = "maple-favorites";

export function hasContent(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function uniqueValues<T>(values: Array<T | null | undefined | false | "">): T[] {
  return [...new Set(values.filter((value): value is T => Boolean(value)))];
}

export function readFavoriteIds(storage: StorageLike | undefined = globalThis.window?.localStorage): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    return uniqueValues((JSON.parse(raw || "[]") as unknown[]).map((item) => String(item || "")).filter(Boolean));
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids: string[], storage: StorageLike | undefined = globalThis.window?.localStorage) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(uniqueValues(ids)));
  } catch {}
}

export function normalizeCultivarToken(text: string | null | undefined) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

export function mergeLocalizedValue(baseValue: unknown, localizedValue: unknown): unknown {
  if (!hasContent(localizedValue)) {
    return baseValue;
  }

  if (
    baseValue &&
    localizedValue &&
    typeof baseValue === "object" &&
    typeof localizedValue === "object" &&
    !Array.isArray(baseValue) &&
    !Array.isArray(localizedValue)
  ) {
    const merged: Record<string, unknown> = { ...(baseValue as Record<string, unknown>) };

    Object.entries(localizedValue).forEach(([key, value]) => {
      merged[key] = mergeLocalizedValue((baseValue as Record<string, unknown>)[key], value);
    });

    return merged;
  }

  return localizedValue;
}

export function shouldAppendCacheBust(value: string | null | undefined) {
  return /^\/?(data|thumbs|rhs-images|mrmaple-images|herter-images|ncsu-images|coniferkingdom-images|jmac-images|user-images)\//.test(String(value || ""));
}

export function appendCacheBust(url: string, cacheBust = DEPLOY_CACHE_BUST) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${cacheBust}`;
}

export function resolveAppUrl(value: string | null | undefined, { baseUrl = APP_BASE_URL, cacheBust = DEPLOY_CACHE_BUST }: AssetUrlOptions = {}) {
  if (!value) {
    return value;
  }

  const normalized = String(value);
  if (
    /^(?:[a-z]+:)?\/\//i.test(normalized)
    || normalized.startsWith("data:")
    || normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  if (normalized.startsWith("/")) {
    const resolved = `${base}${normalized.slice(1)}`;
    return shouldAppendCacheBust(normalized) ? appendCacheBust(resolved, cacheBust) : resolved;
  }

  const resolved = `${base}${normalized}`;
  return shouldAppendCacheBust(normalized) ? appendCacheBust(resolved, cacheBust) : resolved;
}

export function resolveAssetUrl(value: string | null | undefined, options: AssetUrlOptions = {}) {
  return resolveAppUrl(value, {
    ...options,
    baseUrl: options.baseUrl || ASSET_BASE_URL,
  });
}

export function getAssetPathname(value: string | null | undefined, { baseUrl = APP_BASE_URL }: AssetUrlOptions = {}) {
  const rawValue = String(value || "");
  if (!rawValue) {
    return "";
  }

  let pathname = rawValue.split(/[?#]/)[0];

  try {
    pathname = new URL(rawValue, "https://example.invalid").pathname;
  } catch {}

  try {
    pathname = decodeURIComponent(pathname);
  } catch {}

  const basePath = new URL(baseUrl, "https://example.invalid").pathname;
  if (basePath !== "/" && pathname.startsWith(basePath)) {
    pathname = `/${pathname.slice(basePath.length)}`;
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function resolveThumbnailUrl(
  imageUrl: string | null | undefined,
  thumbnailManifest: ThumbnailManifest = {},
  width: 480 | 960 = 480,
  options: AssetUrlOptions = {},
) {
  const publicPath = getAssetPathname(imageUrl, options);
  const thumbnailPath = thumbnailManifest?.[publicPath]?.[width];

  if (!thumbnailPath) {
    return imageUrl;
  }

  return resolveAssetUrl(thumbnailPath, options);
}

export function setRecordPrimaryCover(record: CultivarRecord, imageUrl: string, options: AssetUrlOptions = {}): CultivarRecord {
  return {
    ...record,
    selected_cover_path: getAssetPathname(imageUrl, options),
  };
}

export function applyPrimaryCoverSelection(record: CultivarRecord | null, imageUrl: string) {
  if (!record) {
    return record;
  }

  const nextImages = record.images
    ? {
        ...record.images,
        public_cover_path: imageUrl,
        public_paths: Array.isArray(record.images.public_paths)
          ? uniqueValues([imageUrl, ...record.images.public_paths])
          : record.images.public_paths,
      }
    : record.images;

  return {
    ...record,
    cover_path: imageUrl,
    images: nextImages,
  };
}

export function hasRecordImages(record: CultivarRecord | null | undefined) {
  if (!record) {
    return false;
  }

  return uniqueValues([
    record.cover_path,
    record.images?.public_cover_path,
    ...(record.images?.public_rhs_paths || []),
    ...(record.images?.public_mrmaple_paths || []),
    ...(record.images?.public_herter_paths || []),
    ...(record.images?.public_ncsu_paths || []),
    ...(record.images?.public_conifer_paths || []),
    ...(record.images?.public_jmac_paths || []),
    ...(record.images?.public_user_paths || []),
  ]).length > 0;
}

export function removeImageFromDetailRecord(record: CultivarRecord | null, imageUrl: string) {
  if (!record || !record.images) {
    return record;
  }

  const toComparablePath = (value: string | null | undefined) => {
    const pathname = getAssetPathname(value);
    const match = pathname.match(/\/(?:data|thumbs|rhs-images|mrmaple-images|herter-images|ncsu-images|coniferkingdom-images|jmac-images|user-images)\/.*$/);
    return match ? match[0] : pathname;
  };
  const targetPathname = toComparablePath(imageUrl);
  const nextImages: CultivarImages = { ...record.images };

  ([
    "public_paths",
    "public_rhs_paths",
    "public_mrmaple_paths",
    "public_herter_paths",
    "public_ncsu_paths",
    "public_conifer_paths",
    "public_jmac_paths",
    "public_user_paths",
  ] as Array<"public_paths" | "public_rhs_paths" | "public_mrmaple_paths" | "public_herter_paths" | "public_ncsu_paths" | "public_conifer_paths" | "public_jmac_paths" | "public_user_paths">).forEach((key) => {
    if (!Array.isArray(nextImages[key])) return;
    nextImages[key] = nextImages[key].filter((value) => toComparablePath(value) !== targetPathname);
  });

  const nextCover = toComparablePath(nextImages.public_cover_path) === targetPathname
    ? (nextImages.public_paths?.[0] || null)
    : nextImages.public_cover_path;

  nextImages.public_cover_path = nextCover;
  nextImages.public_count = Array.isArray(nextImages.public_paths) ? nextImages.public_paths.length : nextImages.public_count;

  return {
    ...record,
    cover_path: toComparablePath(record.cover_path) === targetPathname ? (nextCover || null) : record.cover_path,
    images: nextImages,
  };
}

export function resolveRecordAssetPaths(record: CultivarRecord | null, options: AssetUrlOptions = {}) {
  if (!record) {
    return record;
  }

  const imageKeys: Array<
    "public_rhs_paths" | "public_mrmaple_paths" | "public_herter_paths" | "public_ncsu_paths" | "public_conifer_paths" | "public_jmac_paths" | "public_user_paths"
  > = [
    "public_rhs_paths",
    "public_mrmaple_paths",
    "public_herter_paths",
    "public_ncsu_paths",
    "public_conifer_paths",
    "public_jmac_paths",
    "public_user_paths",
  ];

  const nextImages = record.images ? { ...record.images } : record.images;

  if (nextImages) {
    nextImages.public_cover_path = resolveAssetUrl(nextImages.public_cover_path, options);
    imageKeys.forEach((key) => {
      const value = nextImages[key];
      if (Array.isArray(value)) {
        nextImages[key] = value.map((item) => resolveAssetUrl(item, options)).filter((item): item is string => Boolean(item));
      }
    });
  }

  return {
    ...record,
    cover_path: resolveAssetUrl(record.cover_path, options),
    images: nextImages,
  };
}

export function loadThumbnailManifest(): Promise<ThumbnailManifest> {
  return fetch(resolveAppUrl("/data/image-thumbs.json")!, { cache: "no-store" }).then((response) => {
    if (response.status === 404) {
      return {};
    }

    if (!response.ok) {
      return {};
    }

    return response.json() as Promise<ThumbnailManifest>;
  }).catch(() => ({} as ThumbnailManifest));
}

export function loadAwardRecords({
  fetchImpl = globalThis.fetch,
  baseUrl = APP_BASE_URL,
  cacheBust = DEPLOY_CACHE_BUST,
}: { fetchImpl?: typeof fetch; baseUrl?: string; cacheBust?: string } = {}): Promise<AwardSelection[]> {
  return fetchImpl(resolveAppUrl("/data/awards.json", { baseUrl, cacheBust })!, { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error("无法加载 awards.json");
    }
    return response.json() as Promise<AwardSelection[]>;
  });
}

export function localizeRecord(record: CultivarRecord): CultivarRecord {
  return {
    ...record,
    descriptions_en: record.descriptions,
    rhs_en: record.rhs,
    descriptions: mergeLocalizedValue(record.descriptions, record.descriptions_zh) as CultivarRecord["descriptions"],
    rhs: mergeLocalizedValue(record.rhs, record.rhs_zh) as CultivarRecord["rhs"],
  };
}

export function loadCatalog(): Promise<CultivarRecord[]> {
  return fetch(resolveAppUrl("/data/catalog.json")!, { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error("无法加载 catalog.json");
    }
    return response.json().then((records: CultivarRecord[]) => records.map((record) => resolveRecordAssetPaths(record)!));
  });
}

export function loadCultivar(id: string): Promise<CultivarRecord> {
  return fetch(resolveAppUrl(`/data/details/${id}.json`)!, { cache: "no-store" }).then(async (response) => {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok) {
      const error: CodedError = new Error(response.status === 404 ? "该详情页 ID 不存在于当前数据集中。" : "无法加载该品种详情");
      if (response.status === 404) {
        error.code = "NOT_FOUND";
      }
      throw error;
    }

    if (!contentType.includes("application/json")) {
      const error: CodedError = new Error("该详情页 ID 不存在于当前数据集中。");
      error.code = "NOT_FOUND";
      throw error;
    }

    try {
      const record = await response.json() as CultivarRecord;
      return resolveRecordAssetPaths(localizeRecord(record))!;
    } catch {
      const error: CodedError = new Error("该详情页 ID 不存在于当前数据集中。");
      error.code = "NOT_FOUND";
      throw error;
    }
  });
}

export function loadDevRecord(id: string): Promise<CultivarRecord | undefined> {
  return fetch(resolveAppUrl(`/__dev/record/${id}`)!, { cache: "no-store" }).then(async (response) => {
    const payload = await response.json().catch(() => ({})) as DevRecordPayload;
    if (!response.ok) {
      throw new Error(payload.error || "无法加载开发编辑数据");
    }
    return payload.record;
  });
}

export function saveDevRecord(id: string, record: CultivarRecord): Promise<CultivarRecord | undefined> {
  return fetch(resolveAppUrl(`/__dev/record/${id}`)!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ record }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({})) as DevRecordPayload;
    if (!response.ok) {
      throw new Error(payload.error || "保存失败");
    }
    return payload.record;
  });
}

export function mutateDevImage(id: string, imageUrl: string, action: string, options: AssetUrlOptions = {}) {
  return fetch(resolveAppUrl(`/__dev/image-action/${id}`, options)!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ imagePath: imageUrl, action }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({})) as DevRecordPayload;
    if (!response.ok) {
      throw new Error(payload.error || "操作失败");
    }
    return payload;
  });
}
