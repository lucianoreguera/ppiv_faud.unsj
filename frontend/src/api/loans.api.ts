import { httpClient } from './http-client';
import type {
  CreateLoanResponseDto,
  LoanStateTransitionResponseDto,
  MyLoansFilterParams,
  MyLoansListResponseDto,
} from '../types/openapi.types';

/**
 * Servicio de préstamos digitales del usuario autenticado (RF03)
 * Endpoints: POST /api/v1/prestamos · GET /api/v1/prestamos/mis-prestamos · PATCH /api/v1/prestamos/:id/cerrar
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
};
