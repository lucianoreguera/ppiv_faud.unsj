import { httpClient } from './http-client';
import type { HealthResponseDto } from '../types/openapi.types';

/**
 * Servicio para verificar el estado operativo del Backend y la conexión con PostgreSQL 16
 * Endpoint: GET /api/v1/health
 */
export const healthApi = {
  checkHealth: (): Promise<HealthResponseDto> => {
    return httpClient.get<HealthResponseDto>('/health', { skipAuth: true });
  },
};
