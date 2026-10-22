import { httpClient } from './http-client';
import type {
  MarkAllNotificationsReadResponseDto,
  MarkNotificationReadResponseDto,
  NotificationsFilterParams,
  NotificationsListResponseDto,
} from '../types/openapi.types';

/**
 * Bandeja de notificaciones del usuario autenticado (RF06)
 * Endpoints: GET /api/v1/notificaciones · PATCH /api/v1/notificaciones/:id/leida
 *            PATCH /api/v1/notificaciones/marcar-todas-leidas
 * Los contadores (`noLeidas`, `leidas`, `porTipo`) siempre cubren toda la bandeja, sin importar los filtros.
 */
export const notificationsApi = {
  list: (params: NotificationsFilterParams = {}, signal?: AbortSignal): Promise<NotificationsListResponseDto> => {
    return httpClient.get<NotificationsListResponseDto>('/notificaciones', {
      params: params as Record<string, unknown>,
      signal,
    });
  },

  markRead: (id: string, leida = true): Promise<MarkNotificationReadResponseDto> => {
    return httpClient.patch<MarkNotificationReadResponseDto>(`/notificaciones/${encodeURIComponent(id)}/leida`, {
      leida,
    });
  },

  markAllRead: (): Promise<MarkAllNotificationsReadResponseDto> => {
    return httpClient.patch<MarkAllNotificationsReadResponseDto>('/notificaciones/marcar-todas-leidas');
  },
};
