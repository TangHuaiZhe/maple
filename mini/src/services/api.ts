const DEFAULT_DATA_BASE_URL = process.env.TARO_APP_DATA_BASE_URL || 'http://127.0.0.1:4173'
const DEFAULT_ASSET_BASE_URL = process.env.TARO_APP_ASSET_BASE_URL || DEFAULT_DATA_BASE_URL
const JSON_CACHE = new Map<string, unknown>()
const JSON_REQUEST_CACHE = new Map<string, Promise<unknown>>()

function normalizeBaseUrl(baseUrl: string) {
  return String(baseUrl || '').replace(/\/+$/, '')
}

function joinUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBaseUrl}${normalizedPath}`
}

export const DATA_BASE_URL = normalizeBaseUrl(DEFAULT_DATA_BASE_URL)
export const ASSET_BASE_URL = normalizeBaseUrl(DEFAULT_ASSET_BASE_URL)

export function buildDataUrl(path: string) {
  return joinUrl(DATA_BASE_URL, path)
}

export function resolveAssetUrl(path?: string | null) {
  if (!path) return ''
  return joinUrl(ASSET_BASE_URL, path)
}

export async function requestJson<T>(path: string) {
  const url = buildDataUrl(path)
  const response = await new Promise<WechatMiniprogram.RequestSuccessCallbackResult<T>>((resolve, reject) => {
    wx.request<T>({
      url,
      method: 'GET',
      header: {
        Accept: 'application/json'
      },
      success: resolve,
      fail: reject
    })
  })

  if (response.statusCode >= 400) {
    throw new Error(`HTTP ${response.statusCode} for ${url}`)
  }

  if (typeof response.data === 'string') {
    throw new Error(`Invalid JSON response from ${url}`)
  }

  return response.data
}

export function peekCachedJson<T>(path: string) {
  return JSON_CACHE.has(path) ? JSON_CACHE.get(path) as T : null
}

export function requestJsonCached<T>(path: string) {
  const cachedValue = peekCachedJson<T>(path)
  if (cachedValue) {
    return Promise.resolve(cachedValue)
  }

  const pendingRequest = JSON_REQUEST_CACHE.get(path)
  if (pendingRequest) {
    return pendingRequest as Promise<T>
  }

  const request = requestJson<T>(path)
    .then((data) => {
      JSON_CACHE.set(path, data)
      return data
    })
    .finally(() => {
      JSON_REQUEST_CACHE.delete(path)
    })

  JSON_REQUEST_CACHE.set(path, request as Promise<unknown>)
  return request
}
