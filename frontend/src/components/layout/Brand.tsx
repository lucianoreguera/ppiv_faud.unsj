import React from 'react';
import { Plus } from 'lucide-react';

/** Logos institucionales UNSJ y FAUD (extraídos de los prototipos Figma) */
export const UnsjLogo: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <img
    src="/brand/unsj-logo.png"
    alt="Universidad Nacional de San Juan"
    className={`object-contain select-none ${className}`}
    draggable={false}
  />
);

export const FaudLogo: React.FC<{ className?: string }> = ({ className = 'h-16' }) => (
  <img
    src="/brand/faud-logo.png"
    alt="FAUD · Facultad de Arquitectura, Urbanismo y Diseño"
    className={`object-contain select-none ${className}`}
    draggable={false}
  />
);

/**
 * Isotipo cuadrado ámbar.
 * - 'plus': panel de administración (Figma págs. 7, 8, 9 y 17)
 * - 'block': navegación del alumno sobre fondo oscuro (Figma págs. 13 y 19)
 */
export const BrandMark: React.FC<{ icon?: 'plus' | 'block'; className?: string }> = ({
  icon = 'plus',
  className = 'w-6 h-6',
}) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center justify-center shrink-0 rounded-[5px] bg-faud-amber text-faud-ink ${className}`}
  >
    {icon === 'plus' ? (
      <Plus className="w-[70%] h-[70%]" strokeWidth={3.5} />
    ) : (
      <svg viewBox="0 0 24 24" className="w-[55%] h-[55%]" fill="currentColor">
        <path d="M4 3h8.5L20 21h-5.4l-1.3-3.4H10V21H4V3z" />
      </svg>
    )}
  </span>
);

/** Nombre del proyecto + subtítulo institucional (01 MARCA E IDENTIDAD, Figma pág. 21) */
export const BrandWordmark: React.FC<{
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}> = ({
  subtitle = 'FAUD-UNSJ · Préstamo Digital Interdepartamental',
  titleClassName = 'text-faud-amber text-[20px]',
  subtitleClassName = 'text-faud-muted text-caption',
}) => (
  <span className="flex flex-col min-w-0">
    <span className={`font-bold leading-tight tracking-tight ${titleClassName}`}>Repositorio FAUD</span>
    {subtitle && <span className={`leading-tight mt-0.5 truncate ${subtitleClassName}`}>{subtitle}</span>}
  </span>
);
