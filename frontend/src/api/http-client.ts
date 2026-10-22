import type { ApiErrorPayload, DrmHeadersMetadata } from '../types/openapi.types';

export const AUTH_TOKEN_STORAGE_KEY = 'faud_auth_token';
export const AUTH_USER_STORAGE_KEY = 'faud_auth_user';
export const DRM_TOKENS_STORAGE_KEY = 'faud_drm_tokens';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_REJECTED'
  | 'DRM_BLOCKED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR';

export class ApiHttpError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly rawMessages: string[];
  public readonly retryAfterSeconds?: number;
  public readonly path?: string;

  constructor(params: {
    message: string;
    status: number;
    code: ApiErrorCode;
    rawMessages?: string[];
    retryAfterSeconds?: number;
    path?: string;
  }) {
    super(params.message);
    this.name = 'ApiHttpError';
    this.status = params.status;
    this.code = params.code;
    this.rawMessages = params.rawMessages ?? [params.message];
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.path = params.path;
  }
}

/**
 * Obtiene la URL base del Backend configurada por entorno (.env)
 */
export function getApiBaseUrl(): string {
  const rawUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
  return rawUrl.replace(/\/+$/, '');
}

// ============================================================================
// Gestión de Tokens JWT de Sesión y Tokens DRM (7 días)
// ============================================================================

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignorar errores de almacenamiento en entornos restringidos
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  } catch {
    // Ignorar errores
  }
}

export function getDrmTokensMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRM_TOKENS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function getDrmToken(prestamoId: string): string | null {
  const map = getDrmTokensMap();
  return map[prestamoId] ?? null;
}

export function setDrmToken(prestamoId: string, drmToken: string): void {
  try {
    const map = getDrmTokensMap();
    map[prestamoId] = drmToken;
    localStorage.setItem(DRM_TOKENS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignorar errores
  }
}

export function removeDrmToken(prestamoId: string): void {
  try {
    const map = getDrmTokensMap();
    delete map[prestamoId];
    localStorage.setItem(DRM_TOKENS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignorar errores
  }
}

export function clearAllDrmTokens(): void {
  try {
    localStorage.removeItem(DRM_TOKENS_STORAGE_KEY);
  } catch {
    // Ignorar errores
  }
}

// ============================================================================
// Serialización de Query Params y Extracción de Cabeceras DRM
// ============================================================================

export function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    searchParams.append(key, String(value));
  }
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

export function extractDrmHeaders(headers: Headers): DrmHeadersMetadata {
  const watermarkUri = headers.get('X-DRM-Watermark-URI');
  let decodedWatermark = headers.get('X-DRM-Watermark') ?? undefined;
  if (!decodedWatermark && watermarkUri) {
    try {
      decodedWatermark = decodeURIComponent(watermarkUri);
    } catch {
      decodedWatermark = watermarkUri;
    }
  }

  const parseNum = (val: string | null): number | undefined => {
    if (val === null || val.trim() === '') return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  };

  const parseBool = (val: string | null): boolean | undefined => {
    if (val === null) return undefined;
    return val.toLowerCase() === 'true';
  };

  return {
    loanId: headers.get('X-DRM-Loan-Id') ?? undefined,
    loanCode: headers.get('X-DRM-Loan-Code') ?? undefined,
    documentId: headers.get('X-DRM-Document-Id') ?? undefined,
    watermark: decodedWatermark,
    expiresAt: headers.get('X-DRM-Expires-At') ?? undefined,
    remainingDays: parseNum(headers.get('X-DRM-Remaining-Days')),
    remainingHours: parseNum(headers.get('X-DRM-Remaining-Hours')),
    porVencer24h: parseBool(headers.get('X-DRM-Por-Vencer-24h')),
    allowDownload: parseBool(headers.get('X-DRM-Allow-Download')),
    allowPrint: parseBool(headers.get('X-DRM-Allow-Print')),
    allowCopy: parseBool(headers.get('X-DRM-Allow-Copy')),
  };
}

// ============================================================================
// Clasificación Semántica de Errores HTTP (401, 403, 409, 429)
// ============================================================================

function classifyErrorCode(status: number, messageText: string): ApiErrorCode {
  const normalized = messageText.toLowerCase();

  if (status === 401) return 'UNAUTHORIZED';

  if (status === 403) {
    if (normalized.includes('pendiente')) return 'ACCOUNT_PENDING';
    if (normalized.includes('rechazad')) return 'ACCOUNT_REJECTED';
    if (
      normalized.includes('vencido') ||
      normalized.includes('revocado') ||
      normalized.includes('drm') ||
      normalized.includes('visor')
    ) {
      return 'DRM_BLOCKED';
    }
    return 'FORBIDDEN';
  }

  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  return 'SERVER_ERROR';
}

async function parseHttpError(response: Response, endpoint: string): Promise<ApiHttpError> {
  const status = response.status;
  const retryAfterHeader =
    response.headers.get('Retry-After') ?? response.headers.get('X-RateLimit-Reset');
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  let rawMessages: string[] = [];
  let mainMessage = `Error HTTP ${status} al comunicarse con el servidor.`;

  try {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as Partial<ApiErrorPayload>;
      if (Array.isArray(payload.message)) {
        rawMessages = payload.message.map(String);
        mainMessage = rawMessages.join(' · ');
      } else if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
        rawMessages = [payload.message];
        mainMessage = payload.message;
      }
    } else {
      const text = await response.text();
      if (text.trim().length > 0) {
        mainMessage = text.trim();
        rawMessages = [mainMessage];
      }
    }
  } catch {
    // Mantener mensaje por defecto si el cuerpo no es legible
  }

  if (status === 429 && retryAfterSeconds && !Number.isNaN(retryAfterSeconds)) {
    mainMessage = `Demasiadas solicitudes. Por favor aguarde ${retryAfterSeconds} segundos antes de reintentar.`;
  }

  const code = classifyErrorCode(status, mainMessage);

  const apiError = new ApiHttpError({
    message: mainMessage,
    status,
    code,
    rawMessages,
    retryAfterSeconds:
      retryAfterSeconds && !Number.isNaN(retryAfterSeconds) ? retryAfterSeconds : undefined,
    path: endpoint,
  });

  if (typeof window !== 'undefined') {
    if (status === 401 && !endpoint.includes('/auth/login')) {
      window.dispatchEvent(new CustomEvent('faud:unauthorized', { detail: apiError }));
    }
    if (status === 429) {
      window.dispatchEvent(new CustomEvent('faud:rate-limit', { detail: apiError }));
    }
  }

  return apiError;
}

// ============================================================================
// Cliente HTTP Tipado con Interceptores JWT y DRM
// ============================================================================

export interface HttpRequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, unknown>;
  body?: unknown;
  drmToken?: string | null;
  prestamoId?: string;
  skipAuth?: boolean;
}

export interface BinaryStreamResponse {
  buffer: ArrayBuffer;
  drmHeaders: DrmHeadersMetadata;
  contentType: string | null;
}

function buildRequestUrl(endpoint: string, params?: Record<string, unknown>): string {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api/v1')
      ? `${baseUrl}${endpoint.replace(/^\/api\/v1/, '')}`
      : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  return `${cleanEndpoint}${buildQueryString(params)}`;
}

function buildRequestHeaders(options: HttpRequestOptions): Headers {
  const headers = new Headers(options.headers);

  if (!options.skipAuth && !headers.has('Authorization')) {
    const authToken = getAuthToken();
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
  }

  const resolvedDrmToken =
    options.drmToken ?? (options.prestamoId ? getDrmToken(options.prestamoId) : null);

  if (resolvedDrmToken && !headers.has('x-drm-token')) {
    headers.set('x-drm-token', resolvedDrmToken);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${resolvedDrmToken}`);
    }
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  return headers;
}

function pickRequestInit(options: HttpRequestOptions): RequestInit {
  return {
    method: options.method,
    signal: options.signal,
    credentials: options.credentials,
    mode: options.mode,
    cache: options.cache,
    redirect: options.redirect,
    referrer: options.referrer,
    referrerPolicy: options.referrerPolicy,
    integrity: options.integrity,
    keepalive: options.keepalive,
  };
}

export async function httpRequest<TResponse>(
  endpoint: string,
  options: HttpRequestOptions = {},
): Promise<TResponse> {
  const url = buildRequestUrl(endpoint, options.params);
  const headers = buildRequestHeaders(options);
  const fetchInit = pickRequestInit(options);

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const serializedBody: BodyInit | undefined =
    options.body === undefined
      ? undefined
      : isFormData
        ? (options.body as FormData)
        : JSON.stringify(options.body);

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchInit,
      headers,
      body: serializedBody,
    });
  } catch (err) {
    throw new ApiHttpError({
      message:
        err instanceof Error && err.message
          ? `No se pudo conectar con el servidor Backend (${err.message}).`
          : 'Error de red al conectar con el Backend FAUD-UNSJ.',
      status: 0,
      code: 'NETWORK_ERROR',
      path: endpoint,
    });
  }

  if (!response.ok) {
    throw await parseHttpError(response, endpoint);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function httpRequestBinary(
  endpoint: string,
  options: HttpRequestOptions = {},
): Promise<BinaryStreamResponse> {
  const url = buildRequestUrl(endpoint, options.params);
  const headers = buildRequestHeaders({
    ...options,
    headers: {
      Accept: 'application/pdf, application/octet-stream',
      ...(options.headers as Record<string, string>),
    },
  });
  const fetchInit = pickRequestInit(options);

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchInit,
      method: fetchInit.method ?? 'GET',
      headers,
    });
  } catch (err) {
    throw new ApiHttpError({
      message:
        err instanceof Error && err.message
          ? `Error de conexión al descargar el stream protegido (${err.message}).`
          : 'Error de red al conectar con el Visor DRM.',
      status: 0,
      code: 'NETWORK_ERROR',
      path: endpoint,
    });
  }

  if (!response.ok) {
    throw await parseHttpError(response, endpoint);
  }

  const buffer = await response.arrayBuffer();
  const drmHeaders = extractDrmHeaders(response.headers);

  return {
    buffer,
    drmHeaders,
    contentType: response.headers.get('Content-Type'),
  };
}

export const httpClient = {
  get: <T>(endpoint: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>) =>
    httpRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>) =>
    httpRequest<T>(endpoint, { ...options, method: 'POST', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>) =>
    httpRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>) =>
    httpRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  getBinary: (endpoint: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>) =>
    httpRequestBinary(endpoint, { ...options, method: 'GET' }),
};
