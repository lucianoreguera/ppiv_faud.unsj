import { httpClient } from './http-client';
import type {
  CatalogFilterParams,
  DocumentItemDto,
  DocumentsListResponseDto,
} from '../types/openapi.types';

/**
 * Servicio público del catálogo académico (RF02)
 * Endpoints: GET /api/v1/documentos · GET /api/v1/documentos/:id
 * Nunca expone la ruta física ni el binario del PDF.
 */
export const catalogApi = {
  list: (params: CatalogFilterParams, signal?: AbortSignal): Promise<DocumentsListResponseDto> => {
    return httpClient.get<DocumentsListResponseDto>('/documentos', {
      params: params as Record<string, unknown>,
      skipAuth: true,
      signal,
    });
  },

  getById: (id: string, signal?: AbortSignal): Promise<DocumentItemDto> => {
    return httpClient.get<DocumentItemDto>(`/documentos/${encodeURIComponent(id)}`, {
      skipAuth: true,
      signal,
    });
  },
};
