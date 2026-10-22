import { AlarmClock, BookOpenCheck, ShieldOff, TimerOff, UserCheck, type LucideIcon } from 'lucide-react';
import type { NotificationItemDto, TipoNotificacion } from '../../types/openapi.types';

/** Presentación de cada tipo de aviso (RF06): etiqueta, ícono, tono y destino dentro de la SPA */
export interface NotificationMeta {
  label: string;
  icon: LucideIcon;
  /** Clases del círculo del ícono */
  tone: string;
  to: string;
}

export const NOTIFICATION_META: Record<TipoNotificacion, NotificationMeta> = {
  PRESTAMO_OTORGADO: {
    label: 'Préstamo otorgado',
    icon: BookOpenCheck,
    tone: 'bg-status-success-bg text-status-success',
    to: '/mis-prestamos?tab=activos',
  },
  PROXIMO_VENCIMIENTO_24H: {
    label: 'Vence en 24 horas',
    icon: AlarmClock,
    tone: 'bg-status-warning-bg text-status-warning',
    to: '/mis-prestamos?tab=por-vencer',
  },
  PRESTAMO_VENCIDO: {
    label: 'Préstamo vencido',
    icon: TimerOff,
    tone: 'bg-status-inactive-bg text-status-inactive',
    to: '/mis-prestamos?tab=historial',
  },
  PRESTAMO_REVOCADO: {
    label: 'Préstamo revocado',
    icon: ShieldOff,
    tone: 'bg-status-danger-bg text-status-danger',
    to: '/mis-prestamos?tab=historial',
  },
  CUENTA_APROBADA: {
    label: 'Cuenta aprobada',
    icon: UserCheck,
    tone: 'bg-status-success-bg text-status-success',
    to: '/catalogo',
  },
};

/** El Backend siempre redacta `mensaje`; si llegara vacío se arma uno con el préstamo asociado */
export const notificationText = (n: NotificationItemDto) =>
  n.mensaje?.trim() ||
  `${NOTIFICATION_META[n.tipo].label}: ${n.prestamo.codigoFormateado} · “${n.prestamo.documento.titulo}”.`;
