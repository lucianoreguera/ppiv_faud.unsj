import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notificationsApi } from '../api/notifications.api';
import { useAuth } from './AuthContext';
import type { NotificationCountersDto, NotificationItemDto } from '../types/openapi.types';

/**
 * Estado compartido de la campana de notificaciones (Spec FE-03, regla 4 · RF06).
 * - Consulta GET /api/v1/notificaciones?limit=5 al iniciar sesión y cada minuto mientras la pestaña está visible.
 * - `markRead` / `markAllRead` actualizan la campana al instante e incrementan `version`,
 *   que la bandeja `/notificaciones` usa para volver a consultar su página.
 */
export const BELL_PREVIEW_LIMIT = 5;
const POLL_INTERVAL_MS = 60_000;

export interface NotificationsContextValue {
  counters: NotificationCountersDto | null;
  latest: NotificationItemDto[];
  /** Cambia tras cada marcado de lectura */
  version: number;
  refresh: () => void;
  markRead: (id: string, leida?: boolean) => Promise<void>;
  markAllRead: () => Promise<number>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const authenticated = status === 'authenticated';
  const [counters, setCounters] = useState<NotificationCountersDto | null>(null);
  const [latest, setLatest] = useState<NotificationItemDto[]>([]);
  const [version, setVersion] = useState(0);
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => {
    if (!authenticated) return;
    const requestId = ++requestIdRef.current;
    notificationsApi
      .list({ limit: BELL_PREVIEW_LIMIT })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setCounters(response.contadores);
        setLatest(response.items);
      })
      .catch(() => {
        // La campana conserva el último estado conocido; un 401 cierra la sesión vía http-client
      });
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) {
      requestIdRef.current++;
      setCounters(null);
      setLatest([]);
      return;
    }
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [authenticated, refresh]);

  const markRead = useCallback(
    async (id: string, leida = true) => {
      await notificationsApi.markRead(id, leida);
      const wasRead = latest.find((n) => n.id === id)?.leida;
      setLatest((items) => items.map((n) => (n.id === id ? { ...n, leida } : n)));
      if (wasRead !== undefined && wasRead !== leida) {
        setCounters((c) =>
          c ? { ...c, noLeidas: c.noLeidas + (leida ? -1 : 1), leidas: c.leidas + (leida ? 1 : -1) } : c,
        );
      }
      setVersion((v) => v + 1);
      refresh();
    },
    [latest, refresh],
  );

  const markAllRead = useCallback(async () => {
    const { actualizadas } = await notificationsApi.markAllRead();
    setLatest((items) => items.map((n) => ({ ...n, leida: true })));
    setCounters((c) => (c ? { ...c, noLeidas: 0, leidas: c.total } : c));
    setVersion((v) => v + 1);
    refresh();
    return actualizadas;
  }, [refresh]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ counters, latest, version, refresh, markRead, markAllRead }),
    [counters, latest, version, refresh, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications debe utilizarse dentro de un <NotificationsProvider>');
  }
  return context;
}
