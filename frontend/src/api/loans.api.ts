import { httpClient, type BinaryStreamResponse } from './http-client';
import type {
  AdminLoansFilterParams,
  AdminLoansListResponseDto,
  CreateLoanResponseDto,
  LoanStateTransitionResponseDto,
  LoanViewerMetadataResponseDto,
  MyLoansFilterParams,
  MyLoansListResponseDto,
} from '../types/openapi.types';

/** Opciones de las consultas DRM del Visor Protegido */
export interface DrmRequestOptions {
  signal?: AbortSignal;
  /** Envía el token DRM guardado del préstamo (`x-drm-token`); sin él, el Backend valida con el JWT de sesión */
  useDrmToken?: boolean;
  /** Un 401 no cierra la sesión: el token DRM puede ser inválido aunque la sesión siga vigente */
  suppressUnauthorizedEvent?: boolean;
}

const drmOptions = (prestamoId: string, options: DrmRequestOptions) => ({
  signal: options.signal,
  prestamoId: options.useDrmToken === false ? undefined : prestamoId,
  suppressUnauthorizedEvent: options.suppressUnauthorizedEvent,
});

/**
 * Servicio de préstamos digitales (RF03, RF04)
 * Endpoints: POST /api/v1/prestamos · GET /api/v1/prestamos/mis-prestamos · PATCH /api/v1/prestamos/:id/cerrar
 * Solo Admin: GET /api/v1/prestamos · PATCH /api/v1/prestamos/:id/revocar
 * Visor Protegido (Figura 3): GET /api/v1/prestamos/:id/visor · GET /api/v1/documentos/:id/ver · GET /api/v1/prestamos/:id/contenido
 */
export const loansApi = {
  /** Otorga un préstamo ACTIVO de 7 días y emite el tokenAcceso DRM (409 si ya hay uno activo o la obra está suspendida) */
  request: (documentoId: string): Promise<CreateLoanResponseDto> => {
    return httpClient.post<CreateLoanResponseDto>('/prestamos', { documentoId });
  },

  myLoans: (params: MyLoansFilterParams = {}, signal?: AbortSignal): Promise<MyLoansListResponseDto> => {
    return httpClient.get<MyLoansListResponseDto>('/prestamos/mis-prestamos', {
      params: params as Record<string, unknown>,
      signal,
    });
  },

  /** Devolución anticipada (ACTIVO) o archivo (VENCIDO / REVOCADO) → CERRADO */
  close: (prestamoId: string): Promise<LoanStateTransitionResponseDto> => {
    return httpClient.patch<LoanStateTransitionResponseDto>(`/prestamos/${encodeURIComponent(prestamoId)}/cerrar`);
  },

  /** Tablero de Biblioteca (Solo Admin): métricas globales + listado paginado con filtros */
  adminList: (params: AdminLoansFilterParams = {}, signal?: AbortSignal): Promise<AdminLoansListResponseDto> => {
    return httpClient.get<AdminLoansListResponseDto>('/prestamos', {
      params: params as Record<string, unknown>,
      signal,
    });
  },

  /** ACTIVO → REVOCADO (Solo Admin): el visor del titular queda bloqueado en el acto (409 si no está ACTIVO) */
  revoke: (prestamoId: string, motivo?: string): Promise<LoanStateTransitionResponseDto> => {
    return httpClient.patch<LoanStateTransitionResponseDto>(
      `/prestamos/${encodeURIComponent(prestamoId)}/revocar`,
      motivo ? { motivo } : {},
    );
  },

  /** Validación de vigencia y metadatos del visor: marca de agua, segundos restantes y restricciones DRM (403 si venció o fue revocado) */
  viewerMetadata: (prestamoId: string, options: DrmRequestOptions = {}): Promise<LoanViewerMetadataResponseDto> => {
    return httpClient.get<LoanViewerMetadataResponseDto>(
      `/prestamos/${encodeURIComponent(prestamoId)}/visor`,
      drmOptions(prestamoId, options),
    );
  },

  /** Stream binario del PDF por documento (Figura 3), descargado en memoria */
  documentStream: (
    documentoId: string,
    prestamoId: string,
    options: DrmRequestOptions = {},
  ): Promise<BinaryStreamResponse> => {
    return httpClient.getBinary(`/documentos/${encodeURIComponent(documentoId)}/ver`, drmOptions(prestamoId, options));
  },

  /** Stream binario del PDF por préstamo (respaldo de /documentos/:id/ver) */
  loanStream: (prestamoId: string, options: DrmRequestOptions = {}): Promise<BinaryStreamResponse> => {
    return httpClient.getBinary(`/prestamos/${encodeURIComponent(prestamoId)}/contenido`, drmOptions(prestamoId, options));
  },
};
