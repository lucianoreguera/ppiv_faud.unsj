import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Lock, ShieldAlert } from 'lucide-react';
import { buttonClasses } from '../ui/Button';
import { formatDateTime } from '../../utils/loan-time';
import type { ViewerBlockReason } from '../../hooks/useProtectedViewer';
import type { LoanViewerMetadataResponseDto } from '../../types/openapi.types';

const CONTENT: Record<ViewerBlockReason, { title: string; icon: React.ReactNode }> = {
  'revoked-or-expired': {
    title: 'Acceso Bloqueado: El préstamo ha vencido o fue revocado',
    icon: <Lock className="w-8 h-8" />,
  },
  expired: {
    title: 'Acceso Bloqueado: El préstamo ha vencido o fue revocado',
    icon: <Lock className="w-8 h-8" />,
  },
  forbidden: { title: 'Acceso denegado al Visor Protegido', icon: <ShieldAlert className="w-8 h-8" /> },
  'not-found': { title: 'Préstamo no encontrado', icon: <FileQuestion className="w-8 h-8" /> },
};

/**
 * Pantalla de bloqueo inmediato del Visor (Spec FE-04, regla 4 · 403 Forbidden).
 * Se muestra cuando el Backend rechaza la validación o cuando se cumple el plazo con el visor abierto;
 * para entonces el documento ya fue destruido de la memoria.
 */
export const ViewerBlockedScreen: React.FC<{
  reason: ViewerBlockReason;
  message: string;
  metadata: LoanViewerMetadataResponseDto | null;
}> = ({ reason, message, metadata }) => {
  const { title, icon } = CONTENT[reason];
  const detail =
    reason === 'expired' && metadata
      ? `El plazo de 7 días del préstamo ${metadata.codigoFormateado} finalizó el ${formatDateTime(metadata.fechaVencimiento)}. El documento se cerró y se descartó de la memoria.`
      : message;

  return (
    <section
      role="alert"
      aria-labelledby="viewer-blocked-title"
      className="max-w-[520px] w-full mx-auto bg-white rounded-card shadow-card border border-faud-border-warm px-6 py-10 lg:px-10 text-center"
    >
      <span className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-status-danger-bg text-status-danger">
        {icon}
      </span>
      <h2 id="viewer-blocked-title" className="text-h3 text-faud-ink">
        {title}
      </h2>
      <p className="mt-3 text-body text-faud-muted">{detail}</p>
      {metadata && (
        <p className="mt-4 text-caption text-faud-text">
          <span className="font-bold">Préstamo {metadata.codigoFormateado}</span> · {metadata.documento.titulo}
        </p>
      )}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/mis-prestamos" className={buttonClasses('primary', 'md')}>
          Ir a Mis préstamos
        </Link>
        <Link to="/catalogo" className={buttonClasses('neutral', 'md')}>
          Explorar el catálogo
        </Link>
      </div>
    </section>
  );
};
