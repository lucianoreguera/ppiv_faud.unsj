import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, LogIn } from 'lucide-react';
import type { LoanAction } from '../../hooks/useDocumentLoanAction';

/**
 * Botón de acción de la ficha según sesión, préstamo activo y disponibilidad (Spec FE-02).
 * desktop: h-56 texto 16 (Figma pág. 12) · mobile: h-44 texto 15 (Figma pág. 19)
 */
const BASE =
  'w-full inline-flex items-center justify-center gap-2 rounded-input font-bold text-center leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faud-amber focus-visible:ring-offset-2';

const SIZE = {
  desktop: 'min-h-14 px-4 py-3 text-[16px]',
  mobile: 'min-h-11 px-3 py-2.5 text-[15px]',
};

const PRIMARY = 'bg-faud-amber hover:bg-faud-gold-hover text-white';
const DISABLED = 'bg-status-inactive-bg text-status-disabled cursor-not-allowed';

export const LoanActionButton: React.FC<{
  action: LoanAction;
  size?: keyof typeof SIZE;
  onRequest: () => void;
  className?: string;
}> = ({ action, size = 'desktop', onRequest, className = '' }) => {
  const classes = (tone: string) => `${BASE} ${SIZE[size]} ${tone} ${className}`;

  switch (action.kind) {
    case 'checking':
      return (
        <button type="button" disabled className={classes(DISABLED)}>
          <span
            className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          Verificando disponibilidad…
        </button>
      );
    case 'login':
      return (
        <Link to={action.to} className={classes(PRIMARY)}>
          <LogIn className="w-5 h-5 shrink-0" />
          Iniciar sesión para solicitar préstamo (7 días)
        </Link>
      );
    case 'open-viewer':
      return (
        <Link
          to={action.to}
          className={classes('bg-status-success hover:bg-status-success/90 text-white')}
          title={`Préstamo ${action.codigo}`}
        >
          <BookOpenCheck className="w-5 h-5 shrink-0" />
          Ya tenés un préstamo activo · Abrir en Visor Protegido
        </Link>
      );
    case 'request':
      return (
        <button type="button" onClick={onRequest} className={classes(PRIMARY)}>
          Solicitar Préstamo Digital (7 días)
        </button>
      );
    case 'unavailable':
      return (
        <button type="button" disabled className={classes(DISABLED)}>
          Material temporalmente no disponible por Biblioteca
        </button>
      );
  }
};
