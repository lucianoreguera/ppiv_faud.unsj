import { httpClient } from './http-client';
import type { DepartmentResponseDto, TerritorialMetricsResponseDto } from '../types/openapi.types';

/**
 * Servicio de los 19 departamentos de San Juan (Capital primero, luego orden alfabético)
 * Endpoints públicos: GET /api/v1/departamentos · GET /api/v1/departamentos/metricas
 */
export const departmentsApi = {
  list: (signal?: AbortSignal): Promise<DepartmentResponseDto[]> => {
    return httpClient.get<DepartmentResponseDto[]>('/departamentos', { skipAuth: true, signal });
  },

  /** Alcance territorial: documentos catalogados y usuarios de Capital frente a los 18 departamentos restantes */
  metrics: (signal?: AbortSignal): Promise<TerritorialMetricsResponseDto> => {
    return httpClient.get<TerritorialMetricsResponseDto>('/departamentos/metricas', { skipAuth: true, signal });
  },
};
