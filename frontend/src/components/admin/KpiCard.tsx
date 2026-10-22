import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Tarjeta de métrica del panel admin (Figma pág. 9): barra de color superior, etiqueta y valor.
 * Puede ser estática, un enlace (`to`) o un filtro rápido (`onClick` + `active`).
 */
export interface KpiCardProps {
  label: string;
  /** Etiqueta corta para mobile */
  short?: string;
  value: number | null;
  bar: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, short, value, bar, hint, to, onClick, active, className = '' }) => {
  const interactive = Boolean(to || onClick);
  const classes = `relative block text-left w-full bg-white rounded-[4px] lg:rounded-card border overflow-hidden px-2.5 pt-3.5 pb-2.5 lg:px-6 lg:pt-7 lg:pb-5 transition-colors ${
    active ? 'border-faud-amber ring-1 ring-faud-amber' : 'border-faud-border-warm'
  } ${interactive ? 'hover:border-faud-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faud-amber' : ''} ${className}`;

  const content = (
    <>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] lg:h-1 ${bar}`} />
      <span className="block text-[10px] lg:text-body text-faud-muted">
        {short ? (
          <>
            <span className="lg:hidden">{short}</span>
            <span className="hidden lg:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
      <span className="block text-[18px] lg:text-[32px] font-bold text-faud-ink leading-tight mt-1 lg:mt-0">
        {value ?? '—'}
      </span>
      {hint && <span className="hidden lg:block text-caption text-faud-muted mt-0.5">{hint}</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={`${label}: ${value ?? 'sin datos'}`}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
};
