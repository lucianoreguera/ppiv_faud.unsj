import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, KeywordTag } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CornerAccents } from '../../components/ui/Decorations';
import { useToast } from '../../context/ToastContext';
import { CATALOG_DOCUMENTS } from '../../mocks/figma-fixtures';

/** Ficha del documento y solicitud de préstamo (Figma págs. 12 y 19) — Fases 2 y 3 */
const HOW_IT_WORKS = [
  'Solicita el préstamo digital',
  'Lee online desde cualquier dispositivo',
  'Devolución automática en 7 días',
];

const MetaItem: React.FC<{ label: string; value?: string; compact?: boolean }> = ({ label, value, compact }) => (
  <div>
    <dt className={`font-bold text-faud-muted ${compact ? 'text-[11px]' : 'text-[13px]'}`}>{label}</dt>
    <dd className={`text-faud-text ${compact ? 'text-caption mt-0.5' : 'text-[16px] mt-1'}`}>{value ?? '—'}</dd>
  </div>
);

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams();
  const { showToast } = useToast();
  // Fase 2: reemplazar por GET /api/v1/documentos/:id
  const doc = CATALOG_DOCUMENTS.find((d) => d.id === id) ?? CATALOG_DOCUMENTS[0];
  const resumen = doc.resumen ?? CATALOG_DOCUMENTS[0].resumen ?? '';
  const palabrasClave = doc.palabrasClave ?? [];

  const requestLoan = () =>
    showToast({
      title: 'Solicitud de préstamo disponible en la Fase 3',
      description: 'El botón se conectará con POST /api/v1/prestamos.',
      variant: 'info',
    });

  return (
    <div className="px-5 lg:px-10 pt-4 lg:pt-6 pb-12">
      <nav aria-label="Ruta de navegación" className="hidden lg:block text-body text-faud-muted">
        <Link to="/catalogo" className="hover:text-faud-text">
          Catálogo
        </Link>{' '}
        / <span className="text-faud-text">{doc.titulo}</span>
      </nav>

      {/* ============ MOBILE (Figma pág. 19) ============ */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2">
          <Badge variant={doc.disponible ? 'success' : 'warning'} dot size="xs">
            {doc.disponible ? 'Disponible' : 'Prestado'}
          </Badge>
          <span className="text-[11px] font-bold text-faud-muted">{doc.tipoLabelLargo}</span>
        </div>
        <h1 className="mt-3 text-[18px] font-bold text-faud-ink leading-snug">{doc.titulo}</h1>
        <p className="text-caption text-faud-text mt-0.5">
          Autor: <strong>{doc.autor}</strong>
        </p>
        <p className="text-caption text-faud-text">
          Año: {doc.anio} · Dpto. {doc.departamento}
        </p>

        <div className="mt-5 rounded-card border-[1.5px] border-faud-amber bg-white p-3">
          <p className="text-body font-bold text-faud-ink">Préstamo digital de 7 días</p>
          <p className="text-[11px] text-faud-muted mt-1">Lectura online, revocación automática al vencer.</p>
          <Button onClick={requestLoan} disabled={!doc.disponible} fullWidth className="mt-3 h-11 text-[15px] rounded-input">
            Solicitar préstamo
          </Button>
        </div>

        <h2 className="mt-5 text-[15px] font-bold text-faud-ink">Resumen</h2>
        <p className="mt-1 text-caption leading-relaxed text-faud-text line-clamp-5">{resumen}</p>

        {palabrasClave.length > 0 && (
          <>
            <h2 className="mt-3 text-[15px] font-bold text-faud-ink">Palabras clave</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {palabrasClave.slice(0, 3).map((kw) => (
                <KeywordTag key={kw} size="sm">
                  {kw}
                </KeywordTag>
              ))}
            </div>
          </>
        )}

        <section className="mt-5 rounded-card border border-faud-border-warm bg-white p-3">
          <h2 className="text-body font-bold text-faud-ink">Ficha del documento</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <MetaItem compact label="Carrera" value={doc.carrera} />
            <MetaItem compact label="Director" value={doc.director} />
            <MetaItem compact label="Idioma" value={doc.idioma ?? 'Español'} />
            <MetaItem compact label="Formato original" value={doc.formato ?? 'PDF'} />
          </dl>
        </section>
      </div>

      {/* ============ DESKTOP (Figma pág. 12) ============ */}
      <div className="hidden lg:flex mt-7 gap-5 items-start">
        <article className="relative flex-1 min-w-0 bg-white rounded-card border border-faud-border-warm px-10 pt-10 pb-10">
          <CornerAccents corners={['tl', 'tr', 'bl']} inset={-1} size={40} className="border-faud-amber" />

          <h1 className="text-[32px] font-bold text-faud-ink leading-tight">{doc.titulo}</h1>
          {doc.subtitulo && <p className="text-[18px] text-faud-muted mt-1">{doc.subtitulo}</p>}

          <h2 className="mt-8 text-[18px] font-bold text-faud-ink">Resumen</h2>
          <p className="mt-1.5 text-[16px] leading-[1.5] text-faud-text max-w-[730px]">{resumen}</p>

          {palabrasClave.length > 0 && (
            <>
              <h2 className="mt-5 text-[18px] font-bold text-faud-ink">Palabras clave</h2>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {palabrasClave.map((kw) => (
                  <KeywordTag key={kw}>{kw}</KeywordTag>
                ))}
              </div>
            </>
          )}

          <div className="mt-12 border-t border-faud-border-warm" />

          <h2 className="mt-8 text-[18px] font-bold text-faud-ink">Ficha del documento</h2>
          <dl className="mt-6 grid grid-cols-[200px_200px_1fr] gap-y-7">
            <MetaItem label="Autor" value={doc.autor} />
            <MetaItem label="Tipo" value={doc.tipoLabelLargo} />
            <MetaItem label="Año" value={String(doc.anio)} />
            <MetaItem label="Carrera" value={doc.carrera} />
            <div className="col-span-2">
              <MetaItem label="Departamento de Origen" value={doc.departamento} />
            </div>
            <MetaItem label="Director" value={doc.director} />
          </dl>
        </article>

        <aside className="w-[400px] shrink-0 space-y-10">
          <section className="bg-white rounded-card border border-faud-border-warm px-6 pt-6 pb-24">
            <Badge variant={doc.disponible ? 'success' : 'warning'} dot size="lg">
              {doc.disponible ? 'Disponible' : 'Prestado'}
            </Badge>
            <h2 className="mt-4 text-[20px] font-bold text-faud-ink">Préstamo digital temporal</h2>
            <p className="mt-3 text-body text-faud-muted leading-relaxed">
              Al solicitar este documento, tendrás acceso de lectura durante{' '}
              <strong className="text-faud-ink">7 días</strong> en la plataforma.
            </p>
            <button
              type="button"
              onClick={requestLoan}
              disabled={!doc.disponible}
              className="mt-7 w-full h-14 rounded-input bg-faud-amber hover:bg-faud-gold-hover text-white text-[16px] font-bold transition-colors disabled:bg-status-inactive-bg disabled:text-status-disabled"
            >
              Solicitar préstamo digital
            </button>
            <p className="mt-4 text-caption text-faud-muted max-w-[240px]">
              El acceso se revocará automáticamente al cumplirse el plazo estipulado.
            </p>
          </section>

          <section className="bg-faud-cream rounded-card border border-faud-border-warm px-6 py-6">
            <h2 className="text-[16px] font-bold text-faud-ink">¿Cómo funciona?</h2>
            <ol className="mt-4 space-y-5">
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-body text-faud-text">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-faud-amber text-white text-[11px] font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
};
