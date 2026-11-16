import { BASE_URL } from '../../api/baseurl'

// FastAPI on :8000 in dev (see api/baseurl.tsx), same origin in production.
const API_BASE = `${BASE_URL}/api`

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // ignore — non-JSON error body
    }
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

export function get<T>(path: string, params?: Record<string, string | number | boolean | string[] | undefined | null>): Promise<T> {
  const query = buildQuery(params)
  return request<T>(`${path}${query}`)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined })
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

export function buildQuery(params?: Record<string, string | number | boolean | string[] | undefined | null>): string {
  if (!params) return ''
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'All') continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') usp.append(key, String(item))
      }
      continue
    }
    usp.set(key, String(value))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export function downloadUrl(path: string, params?: Record<string, string | number | boolean | string[] | undefined | null>): string {
  return `${API_BASE}${path}${buildQuery(params)}`
}
