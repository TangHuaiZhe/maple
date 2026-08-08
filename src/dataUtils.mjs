const APP_BASE_URL = import.meta.env?.BASE_URL || "/";
const ASSET_BASE_URL = import.meta.env?.VITE_ASSET_BASE_URL || APP_BASE_URL;
export const DEPLOY_CACHE_BUST = "20260808-1";
const FAVORITES_STORAGE_KEY = "maple-favorites";

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

export function readFavoriteIds(storage = globalThis.window?.localStorage) {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    return uniqueValues(JSON.parse(raw || "[]").map((item) => String(item || "")).filter(Boolean));
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids, storage = globalThis.window?.localStorage) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(uniqueValues(ids)));
  } catch {}
}

export function normalizeCultivarToken(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

export function mergeLocalizedValue(baseValue, localizedValue) {
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
    const merged = { ...baseValue };

    Object.entries(localizedValue).forEach(([key, value]) => {
      merged[key] = mergeLocalizedValue(baseValue[key], value);
    });

    return merged;
  }

  return localizedValue;
}

export function shouldAppendCacheBust(value) {
  return /^\/?(data|thumbs|rhs-images|mrmaple-images|herter-images|ncsu-images|coniferkingdom-images|jmac-images|user-images)\//.test(String(value || ""));
}

export function appendCacheBust(url, cacheBust = DEPLOY_CACHE_BUST) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${cacheBust}`;
}

export function resolveAppUrl(value, { baseUrl = APP_BASE_URL, cacheBust = DEPLOY_CACHE_BUST } = {}) {
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

export function resolveAssetUrl(value, options = {}) {
  return resolveAppUrl(value, {
    ...options,
    baseUrl: options.baseUrl || ASSET_BASE_URL,
  });
}

export function getAssetPathname(value, { baseUrl = APP_BASE_URL } = {}) {
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

export function resolveThumbnailUrl(imageUrl, thumbnailManifest = {}, width = 480, options = {}) {
  const publicPath = getAssetPathname(imageUrl, options);
  const thumbnailPath = thumbnailManifest?.[publicPath]?.[width];

  if (!thumbnailPath) {
    return imageUrl;
  }

  return resolveAssetUrl(thumbnailPath, options);
}

export function setRecordPrimaryCover(record, imageUrl, options = {}) {
  return {
    ...record,
    selected_cover_path: getAssetPathname(imageUrl, options),
  };
}

export function applyPrimaryCoverSelection(record, imageUrl) {
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

export function hasRecordImages(record) {
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

export function removeImageFromDetailRecord(record, imageUrl) {
  if (!record || !record.images) {
    return record;
  }

  const toComparablePath = (value) => {
    const pathname = getAssetPathname(value);
    const match = pathname.match(/\/(?:data|thumbs|rhs-images|mrmaple-images|herter-images|ncsu-images|coniferkingdom-images|jmac-images|user-images)\/.*$/);
    return match ? match[0] : pathname;
  };
  const targetPathname = toComparablePath(imageUrl);
  const nextImages = { ...record.images };

  [
    "public_paths",
    "public_rhs_paths",
    "public_mrmaple_paths",
    "public_herter_paths",
    "public_ncsu_paths",
    "public_conifer_paths",
    "public_jmac_paths",
    "public_user_paths",
  ].forEach((key) => {
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

export function resolveRecordAssetPaths(record, options) {
  if (!record) {
    return record;
  }

  const imageKeys = [
    "public_cover_path",
    "public_rhs_paths",
    "public_mrmaple_paths",
    "public_herter_paths",
    "public_ncsu_paths",
    "public_conifer_paths",
    "public_jmac_paths",
    "public_user_paths",
  ];

  const nextImages = record.images
    ? imageKeys.reduce((result, key) => {
      const value = record.images[key];

      if (Array.isArray(value)) {
        result[key] = value.map((item) => resolveAssetUrl(item, options));
        return result;
      }

      result[key] = resolveAssetUrl(value, options);
      return result;
    }, { ...record.images })
    : record.images;

  return {
    ...record,
    cover_path: resolveAssetUrl(record.cover_path, options),
    images: nextImages,
  };
}

export function loadThumbnailManifest() {
  return fetch(resolveAppUrl("/data/image-thumbs.json"), { cache: "no-store" }).then((response) => {
    if (response.status === 404) {
      return {};
    }

    if (!response.ok) {
      return {};
    }

    return response.json();
  }).catch(() => ({}));
}

export function loadAwardRecords({
  fetchImpl = globalThis.fetch,
  baseUrl = APP_BASE_URL,
  cacheBust = DEPLOY_CACHE_BUST,
} = {}) {
  return fetchImpl(resolveAppUrl("/data/awards.json", { baseUrl, cacheBust }), { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error("无法加载 awards.json");
    }
    return response.json();
  });
}

export function localizeRecord(record) {
  return {
    ...record,
    descriptions_en: record.descriptions,
    rhs_en: record.rhs,
    descriptions: mergeLocalizedValue(record.descriptions, record.descriptions_zh),
    rhs: mergeLocalizedValue(record.rhs, record.rhs_zh),
  };
}

export function loadCatalog() {
  return fetch(resolveAppUrl("/data/catalog.json"), { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error("无法加载 catalog.json");
    }
    return response.json().then((records) => records.map((record) => resolveRecordAssetPaths(record)));
  });
}

export function loadCultivar(id) {
  return fetch(resolveAppUrl(`/data/details/${id}.json`), { cache: "no-store" }).then(async (response) => {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok) {
      const error = new Error(response.status === 404 ? "该详情页 ID 不存在于当前数据集中。" : "无法加载该品种详情");
      if (response.status === 404) {
        error.code = "NOT_FOUND";
      }
      throw error;
    }

    if (!contentType.includes("application/json")) {
      const error = new Error("该详情页 ID 不存在于当前数据集中。");
      error.code = "NOT_FOUND";
      throw error;
    }

    try {
      const record = await response.json();
      return resolveRecordAssetPaths(localizeRecord(record));
    } catch {
      const error = new Error("该详情页 ID 不存在于当前数据集中。");
      error.code = "NOT_FOUND";
      throw error;
    }
  });
}

export function loadDevRecord(id) {
  return fetch(resolveAppUrl(`/__dev/record/${id}`), { cache: "no-store" }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "无法加载开发编辑数据");
    }
    return payload.record;
  });
}

export function saveDevRecord(id, record) {
  return fetch(resolveAppUrl(`/__dev/record/${id}`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ record }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "保存失败");
    }
    return payload.record;
  });
}

export function mutateDevImage(id, imageUrl, action, options = {}) {
  return fetch(resolveAppUrl(`/__dev/image-action/${id}`, options), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ imagePath: imageUrl, action }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "操作失败");
    }
    return payload;
  });
}
