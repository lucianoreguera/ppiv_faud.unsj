import type { BadgeVariant } from '../ui/Badge';
import { formatRemaining, getRemainingTime, isLoanReadable } from '../../utils/loan-time';
import type { EstadoPrestamo, LoanItemDto, MyLoansCountersDto } from '../../types/openapi.types';

/**
 * Presentación del estado de un préstamo en "Mis préstamos" (Figma págs. 13 y 19 · RF03, RF06).
 * Un ACTIVO cuyo plazo ya pasó se muestra como vencido aunque el Backend aún no lo haya sincronizado.
 */
export interface LoanStatusView {
  variant: BadgeVariant;
  label: string;
  /** Barra superior de la tarjeta mobile y relleno de la barra de vigencia */
  bar: string;
  readable: boolean;
  porVencer: boolean;
  /** Acción de PATCH /prestamos/:id/cerrar disponible desde el estado actual (Figura 5) */
  close: 'devolver' | 'archivar' | null;
}

const FINISHED: Record<Exclude<EstadoPrestamo, 'ACTIVO'>, Omit<LoanStatusView, 'readable' | 'porVencer'>> = {
  VENCIDO: { variant: 'inactive', label: 'Vencido', bar: 'bg-status-disabled', close: 'archivar' },
  REVOCADO: { variant: 'danger', label: 'Revocado por Biblioteca', bar: 'bg-status-danger', close: 'archivar' },
  CERRADO: { variant: 'inactive', label: 'Devuelto', bar: 'bg-status-disabled', close: null },
  RECHAZADO: { variant: 'danger', label: 'Solicitud rechazada', bar: 'bg-status-danger', close: null },
  SOLICITADO: { variant: 'warning', label: 'Solicitado', bar: 'bg-faud-amber', close: null },
};

export function getLoanStatus(loan: LoanItemDto, now = Date.now()): LoanStatusView {
  if (loan.estado !== 'ACTIVO') return { ...FINISHED[loan.estado], readable: false, porVencer: false };

  if (!isLoanReadable(loan, now)) {
    return { variant: 'inactive', label: 'Vencido', bar: 'bg-status-disabled', readable: false, porVencer: false, close: null };
  }

  const remaining = getRemainingTime(loan.fechaVencimiento, now);
  return remaining.within24h
    ? {
        variant: 'warning',
        label: `Por vencer · ${formatRemaining(remaining)}`,
        bar: 'bg-status-warning',
        readable: true,
        porVencer: true,
        close: 'devolver',
      }
    : {
        variant: 'success',
        label: `Activo · ${formatRemaining(remaining)}`,
        bar: 'bg-status-success',
        readable: true,
        porVencer: false,
        close: 'devolver',
      };
}

/** Pestañas de "Mis préstamos" (Spec FE-03, regla 2) con contadores de GET /prestamos/mis-prestamos */
export type MyLoansTab = 'activos' | 'por-vencer' | 'historial' | 'todos';

const HISTORY_STATES: readonly EstadoPrestamo[] = ['VENCIDO', 'REVOCADO', 'CERRADO'];

export const MY_LOANS_TABS: {
  id: MyLoansTab;
  label: string;
  count: (c: MyLoansCountersDto) => number;
  matches: (loan: LoanItemDto) => boolean;
  empty: string;
}[] = [
  {
    id: 'activos',
    label: 'Activos',
    count: (c) => c.activos,
    matches: (l) => l.estado === 'ACTIVO',
    empty: 'No tenés préstamos activos.',
  },
  {
    id: 'por-vencer',
    label: 'Por vencer 24h',
    count: (c) => c.porVencer24h,
    matches: (l) => l.porVencer24h,
    empty: 'Ningún préstamo vence en las próximas 24 horas.',
  },
  {
    id: 'historial',
    label: 'Vencidos / Historial',
    count: (c) => c.vencidos + c.revocados + c.cerrados,
    matches: (l) => HISTORY_STATES.includes(l.estado),
    empty: 'Todavía no tenés préstamos vencidos, revocados ni devueltos.',
  },
  {
    id: 'todos',
    label: 'Todos',
    count: (c) => c.todos,
    matches: () => true,
    empty: 'Todavía no solicitaste ningún préstamo.',
  },
];

export const parseMyLoansTab = (value: string | null): MyLoansTab =>
  MY_LOANS_TABS.some((t) => t.id === value) ? (value as MyLoansTab) : 'activos';
