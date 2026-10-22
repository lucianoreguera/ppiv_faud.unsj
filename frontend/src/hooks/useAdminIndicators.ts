import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loansApi } from '../api/loans.api';
import { usersApi } from '../api/users.api';
import type { AdminLoansMetricsDto, LoanItemDto, UserAdminItemDto, UserStatusCountersDto } from '../types/openapi.types';

/**
 * Indicadores rápidos del panel de Biblioteca (sidebar y portada `/admin`):
 * cuentas PENDIENTES (GET /usuarios?estado=PENDIENTE) y préstamos por vencer en 24h (GET /prestamos?porVencer24h=true).
 * Las páginas los refrescan después de aprobar, revocar o ejecutar el control de vigencia.
 */
export const ADMIN_PREVIEW_SIZE = 5;

export interface AdminIndicators {
  status: 'loading' | 'ready' | 'error';
  usuarios: UserStatusCountersDto | null;
  pendientes: UserAdminItemDto[];
  prestamos: AdminLoansMetricsDto | null;
  porVencer: LoanItemDto[];
}

export interface AdminOutletContext {
  indicators: AdminIndicators;
  refreshIndicators: () => void;
}

const INITIAL: AdminIndicators = { status: 'loading', usuarios: null, pendientes: [], prestamos: null, porVencer: [] };

export function useAdminIndicatorsLoader(): AdminOutletContext {
  const [indicators, setIndicators] = useState<AdminIndicators>(INITIAL);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      usersApi.list({ estado: 'PENDIENTE' }, controller.signal),
      loansApi.adminList({ porVencer24h: true, limit: ADMIN_PREVIEW_SIZE }, controller.signal),
    ]).then(([users, loans]) => {
      if (controller.signal.aborted) return;
      setIndicators((prev) => ({
        status: users.status === 'rejected' && loans.status === 'rejected' ? 'error' : 'ready',
        usuarios: users.status === 'fulfilled' ? users.value.contadores : prev.usuarios,
        pendientes: users.status === 'fulfilled' ? users.value.items.slice(0, ADMIN_PREVIEW_SIZE) : prev.pendientes,
        prestamos: loans.status === 'fulfilled' ? loans.value.metricas : prev.prestamos,
        porVencer: loans.status === 'fulfilled' ? loans.value.items : prev.porVencer,
      }));
    });
    return () => controller.abort();
  }, [version]);

  const refreshIndicators = useCallback(() => setVersion((v) => v + 1), []);

  return { indicators, refreshIndicators };
}

/** Acceso desde las páginas hijas de `<AdminLayout>` */
export const useAdminPanel = () => useOutletContext<AdminOutletContext>();
