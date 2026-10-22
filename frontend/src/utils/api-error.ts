import { ApiHttpError } from '../api/http-client';

/** Mensaje legible de un error de la API para avisos y alertas en línea */
export const describeApiError = (error: unknown): string =>
  error instanceof ApiHttpError && error.code === 'NETWORK_ERROR'
    ? 'No pudimos comunicarnos con el Repositorio FAUD. Verificá tu conexión e intentá nuevamente.'
    : error instanceof Error && error.message
      ? error.message
      : 'Intentá nuevamente en unos instantes.';

export const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
