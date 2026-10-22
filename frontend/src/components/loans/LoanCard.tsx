import React from 'react';
import { Link } from 'react-router-dom';
import { Archive, BookOpenCheck, Undo2 } from 'lucide-react';
import { buttonClasses } from '../ui/Button';
import { CountdownBadge } from './CountdownBadge';
import { formatDate, formatDateTime } from '../../utils/loan-time';
import type { LoanItemDto } from '../../types/openapi.types';
import type { LoanStatusView } from './loan-status';

/** Acciones de un préstamo: abrir el Visor Protegido y devolver / archivar (PATCH /prestamos/:id/cerrar) */
export const LoanActions: React.FC<{
  loan: LoanItemDto;
  status: LoanStatusView;
  onClose: (loan: LoanItemDto) => void;
  layout?: 'row' | 'stack';
}> = ({ loan, status, onClose, layout = 'row' }) => {
  const full = layout === 'stack' ? 'w-full' : '';
  if (!status.readable && !status.close) return <span className="text-caption text-faud-muted">—</span>;

  return (
    <div className={layout === 'stack' ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
      {status.readable && (
        <Link
          to={`/visor/${loan.id}`}
          className={buttonClasses('primary', 'sm', `${full} rounded-[4px]`)}
          aria-label={`Abrir en Visor Protegido el préstamo ${loan.codigoFormateado}`}
        >
          <BookOpenCheck className="w-4 h-4" aria-hidden="true" />
          Abrir en Visor Protegido
        </Link>
      )}
      {status.close && (
        <button
          type="button"
          onClick={() => onClose(loan)}
          className={buttonClasses('neutral', 'sm', `${full} rounded-[4px]`)}
          aria-label={`${status.close === 'devolver' ? 'Devolver' : 'Archivar'} el préstamo ${loan.codigoFormateado}`}
        >
          {status.close === 'devolver' ? (
            <Undo2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Archive className="w-4 h-4" aria-hidden="true" />
          )}
          {status.close === 'devolver' ? 'Devolver' : 'Archivar'}
        </button>
      )}
    </div>
  );
};

/** Tarjeta mobile con barra superior de estado (Figma pág. 19) */
export const LoanCard: React.FC<{
  loan: LoanItemDto;
  status: LoanStatusView;
  now: number;
  onClose: (loan: LoanItemDto) => void;
}> = ({ loan, status, now, onClose }) => {
  const muted = !status.readable;
  return (
    <article
      aria-label={`Préstamo ${loan.codigoFormateado}`}
      className={`overflow-hidden rounded-[4px] ${muted ? 'bg-white/60' : 'bg-white'}`}
    >
      <div className={`h-[3px] ${status.bar}`} />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <CountdownBadge loan={loan} status={status} now={now} size="xs" />
          <span className="self-start text-[11px] font-bold text-faud-muted">{loan.codigoFormateado}</span>
        </div>
        <h2 className={`mt-1.5 text-body font-bold truncate ${muted ? 'text-faud-muted' : 'text-faud-ink'}`}>
          <Link to={`/documentos/${loan.documento.id}`} className="hover:underline">
            {loan.documento.titulo}
          </Link>
        </h2>
        <p className="text-[11px] text-faud-muted">{loan.documento.autor}</p>
        <p className={`text-[11px] mt-1 ${muted ? 'text-faud-muted' : 'text-faud-text'}`}>
          Inicia: {formatDate(loan.fechaInicio)} · Vence: {formatDateTime(loan.fechaVencimiento)}
        </p>
        <div className="mt-3">
          <LoanActions loan={loan} status={status} onClose={onClose} layout="stack" />
        </div>
      </div>
    </article>
  );
};
