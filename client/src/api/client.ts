import type { ErrorDetail } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ErrorDetail[]

  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type Method = 'GET' | 'POST'

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown }
}

let onUnauthorized: (() => void) | null = null

/** Called when a signed-in request gets a 401, so the app can drop the session. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again."
const FALLBACK_MESSAGE = 'Something went wrong on our side. Try again in a moment.'

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE)
  }

  if (response.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.()
  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (data as ErrorBody | null)?.error
    const details = Array.isArray(error?.details) ? (error.details as ErrorDetail[]) : []
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? FALLBACK_MESSAGE,
      details,
    )
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : FALLBACK_MESSAGE
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {}
  const result: Record<string, string> = {}
  for (const detail of error.details) {
    const raw = detail.field ?? detail.path
    const field = Array.isArray(raw) ? raw[raw.length - 1] : raw
    if (field !== undefined && !(field in result)) result[String(field)] = detail.message
  }
  return result
}
