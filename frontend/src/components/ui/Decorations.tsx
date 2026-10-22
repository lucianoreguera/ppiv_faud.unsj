import React from 'react';

/**
 * 07 MOTIVOS DECORATIVOS ARQUITECTÓNICOS (Figma pág. 24)
 * Acentos de esquina: líneas doradas en esquinas de tarjetas y secciones hero.
 */
type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface CornerAccentsProps {
  corners?: Corner[];
  /** Distancia al borde del contenedor en px (0 = sobre el borde) */
  inset?: number;
  /** Largo de cada brazo de la "L" en px */
  size?: number;
  className?: string;
}

const CORNER_BORDERS: Record<Corner, string> = {
  tl: 'border-t-2 border-l-2',
  tr: 'border-t-2 border-r-2',
  bl: 'border-b-2 border-l-2',
  br: 'border-b-2 border-r-2',
};

export const CornerAccents: React.FC<CornerAccentsProps> = ({
  corners = ['tl', 'tr', 'bl', 'br'],
  inset = 20,
  size = 20,
  className = 'border-faud-gold-dark',
}) => (
  <>
    {corners.map((corner) => (
      <span
        key={corner}
        aria-hidden="true"
        className={`absolute pointer-events-none ${CORNER_BORDERS[corner]} ${className}`}
        style={{
          width: size,
          height: size,
          top: corner[0] === 't' ? inset : undefined,
          bottom: corner[0] === 'b' ? inset : undefined,
          left: corner[1] === 'l' ? inset : undefined,
          right: corner[1] === 'r' ? inset : undefined,
        }}
      />
    ))}
  </>
);

/** Ícono "i" circular usado en notas informativas (Figma págs. 6, 8, 9 y 13) */
export const InfoDot: React.FC<{ tone?: 'muted' | 'amber' | 'outline'; className?: string }> = ({
  tone = 'muted',
  className = '',
}) => {
  if (tone === 'outline') {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-full border-[1.5px] border-faud-gold-dark text-faud-gold-dark text-[11px] font-bold leading-none ${className}`}
      >
        i
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold leading-none ${
        tone === 'amber'
          ? 'w-5 h-5 bg-faud-amber text-faud-ink text-[11px]'
          : 'w-4 h-4 bg-[#E5E7EB] text-faud-text text-[10px]'
      } ${className}`}
    >
      i
    </span>
  );
};

/** Rectángulos áureos (motivo del panel de marca en Login / Registro) */
export const GoldenRatioMotif: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 324 201"
    fill="none"
    aria-hidden="true"
    className={className}
    stroke="#FFB606"
    strokeOpacity="0.28"
    strokeWidth="1"
  >
    <rect x="0.5" y="0.5" width="200" height="200" />
    <rect x="200.5" y="0.5" width="123" height="123" />
    <path d="M0.5 200.5 A200 200 0 0 1 200.5 0.5" />
    <path d="M200.5 0.5 A123 123 0 0 1 323.5 123.5" />
  </svg>
);
