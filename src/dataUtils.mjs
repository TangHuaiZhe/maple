const APP_BASE_URL = import.meta.env?.BASE_URL || "/";
export const DEPLOY_CACHE_BUST = "20260502-1";
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
  return /^\/?(data|rhs-images|mrmaple-images|herter-images|ncsu-images|coniferkingdom-images|jmac-images|user-images)\//.test(String(value || ""));
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
        result[key] = value.map((item) => resolveAppUrl(item, options));
        return result;
      }

      result[key] = resolveAppUrl(value, options);
      return result;
    }, { ...record.images })
    : record.images;

  return {
    ...record,
    cover_path: resolveAppUrl(record.cover_path, options),
    images: nextImages,
  };
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
  return fetch(resolveAppUrl(`/data/details/${id}.json`), { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error("无法加载该品种详情");
    }
    return response.json().then((record) => resolveRecordAssetPaths(localizeRecord(record)));
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
