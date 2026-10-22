import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

/**
 * Banner de aviso en línea (formularios de acceso, Fase 1)
 * - warning: bg #FFF3D0 · borde ámbar · texto #9A5B00 (cuenta PENDIENTE, 429)
 * - danger:  bg #F7E8E8 · texto #B3261E (cuenta RECHAZADA, credenciales inválidas)
 * - success: bg #F0F5F2 · texto #2D6A4F
 * - info:    bg #FFF9EC · borde cálido
 */
export type AlertVariant = 'warning' | 'danger' | 'success' | 'info';

const VARIANT_STYLES: Record<AlertVariant, { container: string; icon: React.ReactNode }> = {
  warning: {
    container: 'bg-status-warning-bg border-faud-amber/60 text-status-warning',
    icon: <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />,
  },
  danger: {
    container: 'bg-status-danger-bg border-status-danger/30 text-status-danger',
    icon: <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />,
  },
  success: {
    container: 'bg-status-success-bg border-status-success/30 text-status-success',
    icon: <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />,
  },
  info: {
    container: 'bg-faud-cream border-faud-border-warm text-faud-text',
    icon: <Info className="w-5 h-5 shrink-0 mt-0.5 text-faud-gold-dark" />,
  },
};

export interface AlertProps {
  variant?: AlertVariant;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, children, className = '' }) => {
  const style = VARIANT_STYLES[variant];
  return (
    <div
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-input border px-4 py-3 ${style.container} ${className}`}
    >
      {style.icon}
      <div className="min-w-0 text-caption lg:text-[13px] leading-relaxed">
        <p className="font-bold">{title}</p>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </div>
  );
};
