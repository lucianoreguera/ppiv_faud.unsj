import React from 'react';
import { X } from 'lucide-react';
import type { EstadoPrestamo, EstadoValidacionUsuario, TipoDocumento } from '../../types/openapi.types';

/**
 * Badges de estado (Figma pág. 23)
 * - success:  bg #F0F5F2 · texto #2D6A4F (Disponible, Activo)
 * - warning:  bg #FFF3D0 · texto #9A5B00 (Por vencer, Prestado)
 * - alert:    bg #FFF7E5 · texto #9A5B00 · punto ámbar (Alerta 24h)
 * - danger:   bg #F7E8E8 · texto #B3261E (Vencido en panel admin, Rechazado)
 * - inactive: bg #F3F4F6 · texto #6B7280 (Vencido, deshabilitado)
 * - visor:    bg #FFB606 · texto #1A1A2E (Vigente en el visor)
 */
export type BadgeVariant = 'success' | 'warning' | 'alert' | 'danger' | 'inactive' | 'visor';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-status-success-bg text-status-success',
  warning: 'bg-status-warning-bg text-status-warning',
  alert: 'bg-status-alert-bg text-status-warning',
  danger: 'bg-status-danger-bg text-status-danger',
  inactive: 'bg-status-inactive-bg text-status-inactive',
  visor: 'bg-faud-amber text-faud-ink',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  alert: 'bg-faud-amber',
  danger: 'bg-status-danger',
  inactive: 'bg-status-inactive',
  visor: 'bg-faud-ink',
};

const SIZE_CLASSES = {
  xs: 'h-5 px-2 text-[11px]',
  sm: 'h-6 px-2.5 text-caption',
  lg: 'h-8 px-3 text-body',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Punto de color a la izquierda (catálogo y tabla de préstamos admin) */
  dot?: boolean;
  /** 'pill' r:15 (por defecto) · 'square' r:4 (tablas del panel admin) */
  shape?: 'pill' | 'square';
  /** xs: tarjetas mobile · sm: tablas y tarjetas desktop · lg: ficha del documento */
  size?: 'xs' | 'sm' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'inactive',
  dot = false,
  shape = 'pill',
  size = 'sm',
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1.5 font-bold whitespace-nowrap ${SIZE_CLASSES[size]} ${
      shape === 'pill' ? 'rounded-badge' : 'rounded-checkbox'
    } ${VARIANT_CLASSES[variant]} ${className}`}
  >
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[variant]}`} aria-hidden="true" />}
    {children}
  </span>
);

/** Chip rectangular de tipo de documento / carrera (tarjetas del catálogo, Figma pág. 11) */
export const Chip: React.FC<{ tone?: 'amber' | 'green'; children: React.ReactNode }> = ({
  tone = 'amber',
  children,
}) => (
  <span
    className={`inline-flex items-center h-[22px] px-2 rounded-checkbox text-caption font-bold ${
      tone === 'amber'
        ? 'bg-faud-amber-light text-faud-gold-dark'
        : 'bg-status-success-bg text-status-success'
    }`}
  >
    {children}
  </span>
);

/** Tag / Palabra clave (Figma pág. 23: bg #FFF3D0 · texto #E6A303 · r:16 · h:32 · pad 16px) */
export const KeywordTag: React.FC<{
  children: React.ReactNode;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ children, onRemove, size = 'md', className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-tag bg-faud-amber-light font-bold ${
      onRemove ? 'text-status-warning font-medium' : 'text-faud-gold-dark'
    } ${size === 'md' ? 'h-8 px-4 text-[13px]' : 'h-7 px-3 text-caption'} ${className}`}
  >
    {children}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="text-status-warning hover:text-faud-ink"
        aria-label={`Quitar ${String(children)}`}
      >
        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
    )}
  </span>
);

/** Tab pill (Figma pág. 23: activo bg #FFB606 texto #1A1A2E · inactivo blanco borde #E8DCC8 · r:20 · h:40) */
export const TabPill: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ active = false, onClick, children, className = '' }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`inline-flex items-center justify-center h-9 lg:h-10 px-4 lg:px-5 rounded-pill text-caption lg:text-body whitespace-nowrap transition-colors ${
      active
        ? 'bg-faud-amber text-faud-ink font-bold'
        : 'bg-white text-faud-muted border border-faud-border-warm hover:border-faud-amber'
    } ${className}`}
  >
    {children}
  </button>
);

/** Estado de validación de cuenta (panel de usuarios) */
export const UserStatusBadge: React.FC<{ estado: EstadoValidacionUsuario }> = ({ estado }) => {
  const map: Record<EstadoValidacionUsuario, { variant: BadgeVariant; label: string }> = {
    APROBADO: { variant: 'success', label: 'Aprobado' },
    PENDIENTE: { variant: 'warning', label: 'Pendiente' },
    RECHAZADO: { variant: 'danger', label: 'Rechazado' },
  };
  const cfg = map[estado];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

/** Estado de préstamo con alerta temprana 24h (Figma págs. 9, 13 y 23) */
export const LoanStatusBadge: React.FC<{
  estado: EstadoPrestamo;
  porVencer24h?: boolean;
  diasRestantes?: number;
}> = ({ estado, porVencer24h = false, diasRestantes }) => {
  if (estado === 'ACTIVO' && porVencer24h) {
    return <Badge variant="warning">Por vencer · {diasRestantes ?? 1} día</Badge>;
  }
  const map: Record<EstadoPrestamo, { variant: BadgeVariant; label: string }> = {
    ACTIVO: {
      variant: 'success',
      label: diasRestantes !== undefined ? `Activo · ${diasRestantes} días` : 'Activo',
    },
    SOLICITADO: { variant: 'warning', label: 'Solicitado' },
    REVOCADO: { variant: 'danger', label: 'Revocado' },
    RECHAZADO: { variant: 'danger', label: 'Rechazado' },
    VENCIDO: { variant: 'inactive', label: 'Vencido' },
    CERRADO: { variant: 'inactive', label: 'Cerrado' },
  };
  const cfg = map[estado];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  TESIS: 'Tesis',
  MONOGRAFIA: 'Monografía',
  INVESTIGACION: 'Investigación',
  OTROS: 'Otros',
};
