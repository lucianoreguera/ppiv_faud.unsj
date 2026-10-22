import type { LoanItemDto } from '../types/openapi.types';

/**
 * Fechas y cuenta regresiva de los préstamos digitales (RF03, RF06).
 * El Backend informa `diasRestantes` / `horasRestantes` redondeados hacia arriba al momento de la consulta;
 * la SPA recalcula el tiempo restante en vivo a partir de `fechaVencimiento`.
 */
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const DATE_FORMAT = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const TIME_FORMAT = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 25/09/2026 */
export const formatDate = (iso: string | Date) => DATE_FORMAT.format(new Date(iso));

/** 25/09/2026 · 14:30 */
export const formatDateTime = (iso: string | Date) => {
  const date = new Date(iso);
  return `${DATE_FORMAT.format(date)} · ${TIME_FORMAT.format(date)}`;
};

export interface RemainingTime {
  expired: boolean;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  /** Alerta temprana: vence dentro de las próximas 24 horas */
  within24h: boolean;
}

export function getRemainingTime(fechaVencimiento: string, now = Date.now()): RemainingTime {
  const totalMs = new Date(fechaVencimiento).getTime() - now;
  if (!(totalMs > 0)) {
    return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, within24h: false };
  }
  return {
    expired: false,
    totalMs,
    days: Math.floor(totalMs / MS_PER_DAY),
    hours: Math.floor((totalMs % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((totalMs % MS_PER_HOUR) / MS_PER_MINUTE),
    within24h: totalMs <= MS_PER_DAY,
  };
}

/** "5 d 3 h" · "7 h 12 min" · "8 min" · "menos de 1 min" */
export function formatRemaining(remaining: RemainingTime): string {
  if (remaining.expired) return 'Vencido';
  if (remaining.days > 0) return remaining.hours > 0 ? `${remaining.days} d ${remaining.hours} h` : `${remaining.days} d`;
  if (remaining.hours > 0) return remaining.minutes > 0 ? `${remaining.hours} h ${remaining.minutes} min` : `${remaining.hours} h`;
  return remaining.minutes > 0 ? `${remaining.minutes} min` : 'menos de 1 min';
}

/** Porcentaje del plazo de 7 días ya consumido (barra de vigencia) */
export function elapsedRatio(loan: Pick<LoanItemDto, 'fechaInicio' | 'fechaVencimiento'>, now = Date.now()): number {
  const start = new Date(loan.fechaInicio).getTime();
  const end = new Date(loan.fechaVencimiento).getTime();
  if (!(end > start)) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/** Un préstamo ACTIVO deja de habilitar la lectura en cuanto pasa su fecha de vencimiento, aunque el Backend aún no lo haya sincronizado */
export const isLoanReadable = (loan: Pick<LoanItemDto, 'estado' | 'fechaVencimiento'>, now = Date.now()) =>
  loan.estado === 'ACTIVO' && !getRemainingTime(loan.fechaVencimiento, now).expired;

const RELATIVE = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

/** "hace 5 minutos" · "ayer" · fecha completa pasada una semana */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffMs = new Date(iso).getTime() - now;
  const abs = Math.abs(diffMs);
  if (abs < MS_PER_MINUTE) return 'recién';
  if (abs < MS_PER_HOUR) return RELATIVE.format(Math.round(diffMs / MS_PER_MINUTE), 'minute');
  if (abs < MS_PER_DAY) return RELATIVE.format(Math.round(diffMs / MS_PER_HOUR), 'hour');
  if (abs < 7 * MS_PER_DAY) return RELATIVE.format(Math.round(diffMs / MS_PER_DAY), 'day');
  return formatDate(iso);
}
