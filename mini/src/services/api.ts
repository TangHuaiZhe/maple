const DEFAULT_DATA_BASE_URL = process.env.TARO_APP_DATA_BASE_URL || 'http://127.0.0.1:4173'
const DEFAULT_ASSET_BASE_URL = process.env.TARO_APP_ASSET_BASE_URL || DEFAULT_DATA_BASE_URL
const DATA_VERSION = process.env.TARO_APP_DATA_VERSION || 'dev'
const REQUEST_TIMEOUT_MS = 10000
const MAX_RETRIES = 1
const RETRY_DELAY_MS = 250
const JSON_CACHE = new Map<string, unknown>()
const JSON_REQUEST_CACHE = new Map<string, Promise<unknown>>()

type JsonResponse = {
  statusCode: number
  data: unknown
}

type RequestError = Error & {
  statusCode?: number
}

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

function appendVersion(url: string) {
  if (!DATA_VERSION || /(?:[?&])v=/.test(url)) {
    return url
  }

  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(DATA_VERSION)}`
}

function isAbsoluteUrl(path: string) {
  return /^https?:\/\//.test(path)
}

export const DATA_BASE_URL = normalizeBaseUrl(DEFAULT_DATA_BASE_URL)
export const ASSET_BASE_URL = normalizeBaseUrl(DEFAULT_ASSET_BASE_URL)

export function buildDataUrl(path: string) {
  return appendVersion(joinUrl(DATA_BASE_URL, path))
}

export function resolveAssetUrl(path?: string | null) {
  if (!path) return ''
  const url = joinUrl(ASSET_BASE_URL, path)
  return isAbsoluteUrl(path) ? url : appendVersion(url)
}

function requestOnce<T>(path: string) {
  const url = buildDataUrl(path)
  return new Promise<JsonResponse>((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      timeout: REQUEST_TIMEOUT_MS,
      header: {
        Accept: 'application/json'
      },
      success: result => resolve({ statusCode: result.statusCode, data: result.data }),
      fail: reject
    })
  }).then(response => {
    if (response.statusCode >= 400) {
      const error = new Error(`HTTP ${response.statusCode} for ${url}`) as RequestError
      error.statusCode = response.statusCode
      throw error
    }

    if (typeof response.data === 'string') {
      const error = new Error(`Invalid JSON response from ${url}`) as RequestError
      error.statusCode = response.statusCode
      throw error
    }

    return response.data as T
  })
}

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export async function requestJson<T>(path: string, retries = MAX_RETRIES): Promise<T> {
  try {
    return await requestOnce<T>(path)
  } catch (error) {
    const requestError = error as RequestError
    const canRetry = retries > 0 && (!requestError.statusCode || requestError.statusCode >= 500)
    if (!canRetry) {
      throw error
    }

    await wait(RETRY_DELAY_MS)
    return requestJson<T>(path, retries - 1)
  }
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
