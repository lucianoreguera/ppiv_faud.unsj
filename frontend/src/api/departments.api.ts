import { httpClient } from './http-client';
import type { DepartmentResponseDto } from '../types/openapi.types';

/**
 * Servicio de los 19 departamentos de San Juan (Capital primero, luego orden alfabético)
 * Endpoint público: GET /api/v1/departamentos
 */
export const departmentsApi = {
  list: (): Promise<DepartmentResponseDto[]> => {
    return httpClient.get<DepartmentResponseDto[]>('/departamentos', { skipAuth: true });
  },
};
