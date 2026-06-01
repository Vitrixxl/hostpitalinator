const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  (import.meta.env.DEV ? "http://127.0.0.1:4000" : "")
const API_AUTH_TOKEN_KEY = "hospitalinator.apiToken"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type ApiErrorEnvelope = {
  error?: {
    code?: string
    message?: string
  }
}

export class ApiRequestError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code
  }
}

type ApiRequestOptions = {
  method?: HttpMethod
  body?: unknown
  signal?: AbortSignal
  token?: string
}

export function getApiAuthToken() {
  return localStorage.getItem(API_AUTH_TOKEN_KEY)
}

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function setApiAuthToken(token: string) {
  localStorage.setItem(API_AUTH_TOKEN_KEY, token)
}

export function clearApiAuthToken() {
  localStorage.removeItem(API_AUTH_TOKEN_KEY)
}

export async function callApi<TResponse>(
  path: string,
  options: ApiRequestOptions = {}
) {
  const response = await callApiResponse(path, options)

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response.json() as Promise<TResponse>
}

export function callApiResponse(
  path: string,
  options: ApiRequestOptions = {}
) {
  const token = options.token ?? getApiAuthToken()
  const headers = new Headers()

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })
}

async function toApiError(response: Response) {
  let message = `Requete API refusee (${response.status})`
  let code: string | undefined

  try {
    const body = (await response.json()) as ApiErrorEnvelope
    message = body.error?.message ?? message
    code = body.error?.code
  } catch {
    // Non-JSON errors keep the generic HTTP status message.
  }

  return new ApiRequestError(message, response.status, code)
}
