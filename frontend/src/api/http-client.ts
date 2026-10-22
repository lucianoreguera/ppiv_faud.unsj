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
  // X-DRM-Watermark viaja en Latin-1 (los caracteres fuera de rango llegan como "?"): se prefiere la versión URI-encoded
  const watermarkUri = headers.get('X-DRM-Watermark-URI');
  let decodedWatermark: string | undefined;
  if (watermarkUri) {
    try {
      decodedWatermark = decodeURIComponent(watermarkUri);
    } catch {
      decodedWatermark = undefined;
    }
  }
  decodedWatermark ??= headers.get('X-DRM-Watermark') ?? undefined;

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

async function parseHttpError(
  response: Response,
  endpoint: string,
  suppressUnauthorizedEvent = false,
): Promise<ApiHttpError> {
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
    if (status === 401 && !suppressUnauthorizedEvent && !endpoint.includes('/auth/login')) {
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
  /** Un 401 no cierra la sesión (p. ej. token DRM inválido que todavía puede reintentarse con el JWT de sesión) */
  suppressUnauthorizedEvent?: boolean;
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
    throw await parseHttpError(response, endpoint, options.suppressUnauthorizedEvent);
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
    throw await parseHttpError(response, endpoint, options.suppressUnauthorizedEvent);
  }

  const buffer = await response.arrayBuffer();
  const drmHeaders = extractDrmHeaders(response.headers);

  return {
    buffer,
    drmHeaders,
    contentType: response.headers.get('Content-Type'),
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0 a 100 */
  percent: number;
}

export interface HttpUploadOptions {
  method?: 'POST' | 'PATCH';
  signal?: AbortSignal;
  onUploadProgress?: (progress: UploadProgress) => void;
}

/**
 * Envío multipart con progreso de subida (catálogo de PDFs de hasta 50 MB, Fase 5).
 * `fetch` no informa el avance del cuerpo, por eso se usa XMLHttpRequest con los mismos
 * encabezados JWT y la misma clasificación de errores que `httpRequest`.
 */
export function httpUpload<TResponse>(
  endpoint: string,
  body: FormData,
  options: HttpUploadOptions = {},
): Promise<TResponse> {
  const url = buildRequestUrl(endpoint);
  const headers = buildRequestHeaders({ body });

  return new Promise<TResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? 'POST', url);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));

    const networkError = (message: string) =>
      new ApiHttpError({ message, status: 0, code: 'NETWORK_ERROR', path: endpoint });

    const abort = () => xhr.abort();
    if (options.signal?.aborted) {
      reject(new DOMException('Carga cancelada.', 'AbortError'));
      return;
    }
    options.signal?.addEventListener('abort', abort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onUploadProgress) return;
      options.onUploadProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      });
    };

    xhr.onerror = () => {
      options.signal?.removeEventListener('abort', abort);
      reject(networkError('No se pudo conectar con el servidor Backend para subir el archivo.'));
    };

    xhr.onabort = () => {
      options.signal?.removeEventListener('abort', abort);
      reject(new DOMException('Carga cancelada.', 'AbortError'));
    };

    xhr.onload = () => {
      options.signal?.removeEventListener('abort', abort);
      const responseHeaders = new Headers();
      xhr
        .getAllResponseHeaders()
        .trim()
        .split(/[\r\n]+/)
        .forEach((line) => {
          const index = line.indexOf(':');
          if (index > 0) responseHeaders.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
        });

      if (xhr.status < 200 || xhr.status >= 300) {
        if (xhr.status < 200 || xhr.status > 599) {
          reject(networkError(`Respuesta inválida del servidor (HTTP ${xhr.status}).`));
          return;
        }
        const response = new Response(xhr.responseText, { status: xhr.status, headers: responseHeaders });
        void parseHttpError(response, endpoint).then(reject);
        return;
      }

      if (xhr.status === 204 || !xhr.responseText) {
        resolve(undefined as TResponse);
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as TResponse);
      } catch {
        reject(networkError('La respuesta del servidor no es un JSON válido.'));
      }
    };

    xhr.send(body);
  });
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

  upload: <T>(endpoint: string, body: FormData, options?: HttpUploadOptions) => httpUpload<T>(endpoint, body, options),
};
