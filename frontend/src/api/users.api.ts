import { httpClient } from './http-client';
import type {
  UpdateUserStatusDto,
  UpdateUserStatusResponseDto,
  UsersFilterParams,
  UsersListResponseDto,
} from '../types/openapi.types';

/**
 * Validación de cuentas departamentales por Biblioteca (RF05 — Solo Admin)
 * Endpoints: GET /api/v1/usuarios · PATCH /api/v1/usuarios/:id/estado
 * Los contadores (`todos`, `pendientes`, `aprobados`, `rechazados`) cubren todo el padrón, sin importar los filtros.
 */
export const usersApi = {
  list: (params: UsersFilterParams = {}, signal?: AbortSignal): Promise<UsersListResponseDto> => {
    return httpClient.get<UsersListResponseDto>('/usuarios', {
      params: params as Record<string, unknown>,
      signal,
    });
  },

  /** Aprobar / rechazar una cuenta; al aprobarla el Backend despacha el correo CUENTA_APROBADA */
  updateStatus: (id: string, dto: UpdateUserStatusDto): Promise<UpdateUserStatusResponseDto> => {
    return httpClient.patch<UpdateUserStatusResponseDto>(`/usuarios/${encodeURIComponent(id)}/estado`, dto);
  },
};
