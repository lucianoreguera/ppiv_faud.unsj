import React from 'react';
import { Link } from 'react-router-dom';
import { AvailabilityBadge, Chip, KeywordTag, TIPO_DOCUMENTO_LABEL } from '../ui/Badge';
import { buttonClasses } from '../ui/Button';
import { CornerAccents } from '../ui/Decorations';
import type { DocumentItemDto } from '../../types/openapi.types';

/** Estado de navegación hacia la ficha: conserva la búsqueda para "volver al catálogo" */
export interface DocumentDetailLocationState {
  catalogSearch?: string;
}

export const departmentLabel = (doc: Pick<DocumentItemDto, 'departamentoOrigen'>) =>
  doc.departamentoOrigen?.nombre ?? 'Sin departamento';

/** Tarjeta de resultado del catálogo (Figma págs. 11 y 19) */
export const DocumentCard: React.FC<{
  doc: DocumentItemDto;
  highlight?: boolean;
  linkState?: DocumentDetailLocationState;
}> = ({ doc, highlight = false, linkState }) => {
  const departamento = departmentLabel(doc);

  return (
    <article className="relative bg-white rounded-card border border-faud-border-warm px-3 py-3 lg:px-6 lg:py-[18px] flex flex-col lg:flex-row lg:items-start gap-2 lg:gap-6">
      <CornerAccents
        corners={['tl', 'tr']}
        inset={-1}
        size={14}
        className={highlight ? 'border-faud-amber lg:border-faud-border-warm' : 'border-faud-border-warm'}
      />

      {/* Mobile: estado + tipo arriba */}
      <div className="lg:hidden flex items-center justify-between">
        <AvailabilityBadge disponible={doc.estaDisponible} size="xs" />
        <span className="text-[11px] font-bold text-faud-gold-dark">{TIPO_DOCUMENTO_LABEL[doc.tipo]}</span>
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-[15px] lg:text-[18px] font-bold text-faud-ink leading-snug">{doc.titulo}</h2>
        <div className="hidden lg:flex gap-2 mt-1.5">
          <Chip>{TIPO_DOCUMENTO_LABEL[doc.tipo]}</Chip>
          <Chip tone="green">{doc.carrera}</Chip>
        </div>
        <p className="hidden lg:block mt-2.5 text-body text-faud-muted">
          Autor: {doc.autor} · {doc.anio} · Dpto. {departamento}
        </p>
        <p className="lg:hidden mt-0.5 text-[11px] leading-snug text-faud-muted">
          Autor: {doc.autor} · {doc.anio}
          <br />
          Dpto. {departamento} · {doc.carrera}
        </p>
        {doc.palabrasClave.length > 0 && (
          <ul aria-label="Palabras clave" className="hidden lg:flex flex-wrap gap-1.5 mt-3">
            {doc.palabrasClave.slice(0, 4).map((kw) => (
              <li key={kw}>
                <KeywordTag size="sm" className="!h-6 !px-2.5 !text-[11px]">
                  {kw}
                </KeywordTag>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 lg:w-[175px] shrink-0">
        <AvailabilityBadge disponible={doc.estaDisponible} className="hidden lg:inline-flex" />
        <Link
          to={`/documentos/${doc.id}`}
          state={linkState}
          aria-label={`Ver detalle de ${doc.titulo}`}
          className={buttonClasses('secondary', 'md', 'w-full h-8 lg:h-10 text-caption lg:text-body rounded-input')}
        >
          Ver detalle
        </Link>
      </div>
    </article>
  );
};

/** Placeholder de carga con la misma silueta que la tarjeta */
export const DocumentCardSkeleton: React.FC = () => (
  <div aria-hidden="true" className="bg-white rounded-card border border-faud-border-warm px-3 py-3 lg:px-6 lg:py-5 animate-pulse">
    <div className="h-4 lg:h-5 w-3/4 rounded bg-faud-amber-light" />
    <div className="mt-3 h-3 w-1/3 rounded bg-status-inactive-bg" />
    <div className="mt-2 h-3 w-1/2 rounded bg-status-inactive-bg" />
  </div>
);
