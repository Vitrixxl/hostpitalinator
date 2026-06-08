const CONFIGURED_API_BASE_URL =
  process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
const API_AUTH_TOKEN_KEY = "hospitalinator.apiToken";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  cache?: RequestCache;
  signal?: AbortSignal;
  token?: string;
};

export function getApiAuthToken() {
  return localStorage.getItem(API_AUTH_TOKEN_KEY);
}

export function getApiBaseUrl() {
  return getLoopbackAlignedApiBaseUrl();
}

export function setApiAuthToken(token: string) {
  localStorage.setItem(API_AUTH_TOKEN_KEY, token);
}

export function clearApiAuthToken() {
  localStorage.removeItem(API_AUTH_TOKEN_KEY);
}

export async function callApi<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
) {
  const response = await callApiResponse(path, options);

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.json() as Promise<TResponse>;
}

export function callApiResponse(path: string, options: ApiRequestOptions = {}) {
  const token = options.token ?? getApiAuthToken();
  const headers = new Headers();
  const apiBaseUrl = getApiBaseUrl();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: options.cache,
    signal: options.signal,
  });
}

function getLoopbackAlignedApiBaseUrl() {
  if (!CONFIGURED_API_BASE_URL || typeof window === "undefined") {
    return CONFIGURED_API_BASE_URL;
  }

  try {
    const apiUrl = new URL(CONFIGURED_API_BASE_URL);
    const pageHost = window.location.hostname;
    const shouldUsePageLoopbackHost =
      (apiUrl.hostname === "127.0.0.1" && pageHost === "localhost") ||
      (apiUrl.hostname === "localhost" && pageHost === "127.0.0.1");

    if (shouldUsePageLoopbackHost) {
      apiUrl.hostname = pageHost;
      return apiUrl.toString().replace(/\/$/, "");
    }
  } catch {
    return CONFIGURED_API_BASE_URL;
  }

  return CONFIGURED_API_BASE_URL;
}

async function toApiError(response: Response) {
  let message = `Requete API refusee (${response.status})`;
  let code: string | undefined;

  try {
    const body = (await response.json()) as ApiErrorEnvelope;
    message = body.error?.message ?? message;
    code = body.error?.code;
  } catch {
    // Non-JSON errors keep the generic HTTP status message.
  }

  return new ApiRequestError(message, response.status, code);
}
