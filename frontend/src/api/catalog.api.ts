import { httpClient, type UploadProgress } from './http-client';
import type {
  CatalogFilterParams,
  CreateDocumentMultipartDto,
  DeleteDocumentResponseDto,
  DocumentItemDto,
  DocumentMutationResponseDto,
  DocumentsListResponseDto,
  UpdateDocumentDto,
} from '../types/openapi.types';

export interface DocumentUploadOptions {
  signal?: AbortSignal;
  onUploadProgress?: (progress: UploadProgress) => void;
}

/** Campos de texto del multipart; `palabrasClave` viaja como JSON para conservar las comas internas */
function toDocumentFormData(dto: Partial<CreateDocumentMultipartDto>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(dto)) {
    if (value === undefined || value === null || key === 'archivo') continue;
    form.append(key, key === 'palabrasClave' && Array.isArray(value) ? JSON.stringify(value) : String(value));
  }
  if (dto.archivo) form.append('archivo', dto.archivo, dto.archivo.name);
  return form;
}

/**
 * Servicio del catálogo académico (RF01, RF02)
 * Públicos: GET /api/v1/documentos · GET /api/v1/documentos/:id — nunca exponen la ruta física ni el binario del PDF.
 * Solo Admin: POST /api/v1/documentos (multipart) · PATCH /api/v1/documentos/:id · DELETE /api/v1/documentos/:id
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

  /** Alta con PDF de hasta 50 MB y progreso de subida */
  create: (dto: CreateDocumentMultipartDto, options: DocumentUploadOptions = {}): Promise<DocumentMutationResponseDto> => {
    return httpClient.upload<DocumentMutationResponseDto>('/documentos', toDocumentFormData(dto), {
      method: 'POST',
      ...options,
    });
  },

  /** Metadatos y disponibilidad en JSON; si se reemplaza el PDF, multipart con progreso */
  update: (
    id: string,
    dto: UpdateDocumentDto,
    archivo?: File | null,
    options: DocumentUploadOptions = {},
  ): Promise<DocumentMutationResponseDto> => {
    const endpoint = `/documentos/${encodeURIComponent(id)}`;
    if (archivo) {
      return httpClient.upload<DocumentMutationResponseDto>(endpoint, toDocumentFormData({ ...dto, archivo }), {
        method: 'PATCH',
        ...options,
      });
    }
    return httpClient.patch<DocumentMutationResponseDto>(endpoint, dto, { signal: options.signal });
  },

  /** 409 si el documento tiene préstamos activos o historial de préstamos (se sugiere suspenderlo) */
  remove: (id: string): Promise<DeleteDocumentResponseDto> => {
    return httpClient.delete<DeleteDocumentResponseDto>(`/documentos/${encodeURIComponent(id)}`);
  },
};
