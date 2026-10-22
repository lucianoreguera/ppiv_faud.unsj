import { httpClient } from './http-client';
import type { MyLoansFilterParams, MyLoansListResponseDto } from '../types/openapi.types';

/**
 * Servicio de préstamos digitales del usuario autenticado (RF03)
 * Fase 2: solo la consulta de préstamos propios, usada por la Ficha Bibliográfica para detectar
 * un préstamo ACTIVO sobre la obra. La Fase 3 incorpora la solicitud y el cierre de préstamos.
 */
export const loansApi = {
  myLoans: (params: MyLoansFilterParams = {}, signal?: AbortSignal): Promise<MyLoansListResponseDto> => {
    return httpClient.get<MyLoansListResponseDto>('/prestamos/mis-prestamos', {
      params: params as Record<string, unknown>,
      signal,
    });
  },
};
