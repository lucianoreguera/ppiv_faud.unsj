import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CalendarClock, FileSearch, Lock, Scale, ShieldCheck, Stamp, TimerOff } from 'lucide-react';
import { catalogApi } from '../../api/catalog.api';
import { ApiHttpError } from '../../api/http-client';
import { departmentLabel, type DocumentDetailLocationState } from '../../components/catalog/DocumentCard';
import { LoanActionButton } from '../../components/catalog/LoanActionButton';
import { RequestLoanModal } from '../../components/loans/RequestLoanModal';
import { Alert } from '../../components/ui/Alert';
import { AvailabilityBadge, KeywordTag, TIPO_DOCUMENTO_LABEL_LARGO } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { CornerAccents } from '../../components/ui/Decorations';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useDocumentLoanAction } from '../../hooks/useDocumentLoanAction';
import type { DocumentItemDto } from '../../types/openapi.types';

/**
 * Ficha bibliográfica (Figma págs. 12 y 19 · Spec FE-02) — GET /api/v1/documentos/:id
 * "Solicitar Préstamo Digital (7 días)" abre RequestLoanModal → POST /api/v1/prestamos (Spec FE-03).
 */
const HOW_IT_WORKS = [
  'Solicita el préstamo digital',
  'Lee online desde cualquier dispositivo',
  'Devolución automática en 7 días',
];

/** Condiciones de Préstamo Digital y Derechos de Autor (DRM 7 días · RF04 · RNF02) */
const LOAN_CONDITIONS = [
  { icon: CalendarClock, text: 'Acceso de lectura durante 7 días corridos desde que se otorga el préstamo.' },
  { icon: Lock, text: 'Lectura exclusiva en el Visor Protegido: sin descarga, impresión ni copia del contenido.' },
  { icon: Stamp, text: 'Cada página muestra una marca de agua con tu nombre y el código del préstamo.' },
  { icon: TimerOff, text: 'Al vencer el plazo, o si Biblioteca revoca el préstamo, el acceso se bloquea de inmediato.' },
  {
    icon: Scale,
    text: 'La obra está protegida por la Ley 11.723 de Propiedad Intelectual: su reproducción o difusión está prohibida.',
  },
];

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; doc: DocumentItemDto }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

const MetaItem: React.FC<{ label: string; value?: string | null; compact?: boolean }> = ({ label, value, compact }) => (
  <div>
    <dt className={`font-bold text-faud-muted ${compact ? 'text-[11px]' : 'text-[13px]'}`}>{label}</dt>
    <dd className={`text-faud-text ${compact ? 'text-caption mt-0.5' : 'text-[16px] mt-1'}`}>{value || '—'}</dd>
  </div>
);

const LoanConditions: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <section
    aria-labelledby={compact ? 'condiciones-mobile' : 'condiciones-desktop'}
    className={`rounded-card border border-faud-border-warm bg-white ${compact ? 'p-3' : 'px-6 py-6'}`}
  >
    <h2
      id={compact ? 'condiciones-mobile' : 'condiciones-desktop'}
      className={`flex items-center gap-2 font-bold text-faud-ink ${compact ? 'text-body' : 'text-[16px]'}`}
    >
      <ShieldCheck className="w-5 h-5 text-faud-gold-dark shrink-0" />
      Condiciones del préstamo digital y derechos de autor
    </h2>
    <ul className={compact ? 'mt-3 space-y-2.5' : 'mt-4 space-y-3.5'}>
      {LOAN_CONDITIONS.map(({ icon: Icon, text }) => (
        <li key={text} className={`flex items-start gap-2.5 text-faud-text ${compact ? 'text-caption' : 'text-body'}`}>
          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-faud-gold-dark" aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  </section>
);

const DetailSkeleton: React.FC = () => (
  <div aria-hidden="true" className="mt-4 lg:mt-7 flex flex-col lg:flex-row gap-5 animate-pulse">
    <div className="flex-1 bg-white rounded-card border border-faud-border-warm p-5 lg:p-10 space-y-4">
      <div className="h-7 w-3/4 rounded bg-faud-amber-light" />
      <div className="h-4 w-full rounded bg-status-inactive-bg" />
      <div className="h-4 w-5/6 rounded bg-status-inactive-bg" />
      <div className="h-4 w-2/3 rounded bg-status-inactive-bg" />
    </div>
    <div className="lg:w-[400px] h-48 bg-white rounded-card border border-faud-border-warm" />
  </div>
);

export const DocumentDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [requestOpen, setRequestOpen] = useState(false);

  const catalogSearch = (location.state as DocumentDetailLocationState | null)?.catalogSearch ?? '';
  const catalogPath = `/catalogo${catalogSearch}`;

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    catalogApi
      .getById(id, controller.signal)
      .then((doc) => {
        if (!controller.signal.aborted) setState({ status: 'ready', doc });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // 400 (UUID inválido por ParseUUIDPipe) y 404 se presentan como documento inexistente
        if (error instanceof ApiHttpError && (error.status === 404 || error.status === 400)) {
          setState({ status: 'not-found' });
          return;
        }
        setState({
          status: 'error',
          message:
            error instanceof ApiHttpError && error.code === 'NETWORK_ERROR'
              ? 'No pudimos comunicarnos con el Repositorio FAUD. Verificá tu conexión e intentá nuevamente.'
              : error instanceof Error
                ? error.message
                : 'Intentá nuevamente en unos instantes.',
        });
      });
    return () => controller.abort();
  }, [id, reloadToken]);

  const doc = state.status === 'ready' ? state.doc : null;
  const { action: loanAction, refresh: refreshLoanAction } = useDocumentLoanAction(doc);

  const requestLoan = () => setRequestOpen(true);

  const handleGranted = useCallback(() => {
    refreshLoanAction();
    refreshNotifications();
  }, [refreshLoanAction, refreshNotifications]);

  /** 409 / 404: la obra pudo ser suspendida o ya existe un préstamo activo → se actualizan ficha y botón sin parpadeo */
  const handleRejected = useCallback(() => {
    refreshLoanAction();
    catalogApi
      .getById(id)
      .then((fresh) => setState({ status: 'ready', doc: fresh }))
      .catch((error: unknown) => {
        if (error instanceof ApiHttpError && error.status === 404) setState({ status: 'not-found' });
      });
  }, [id, refreshLoanAction]);

  if (state.status === 'loading') {
    return (
      <div className="px-5 lg:px-10 pt-4 lg:pt-6 pb-12" role="status">
        <span className="sr-only">Cargando ficha del documento…</span>
        <DetailSkeleton />
      </div>
    );
  }

  if (state.status === 'not-found' || state.status === 'error') {
    return (
      <div className="px-5 lg:px-10 pt-8 lg:pt-12 pb-12">
        <section className="max-w-lg mx-auto bg-white rounded-card border border-faud-border-warm p-8 text-center">
          <FileSearch className="w-10 h-10 mx-auto text-faud-gold-dark" strokeWidth={1.75} />
          {state.status === 'not-found' ? (
            <>
              <h1 className="mt-4 text-h3 text-faud-ink">Documento no encontrado</h1>
              <p className="mt-2 text-body text-faud-muted">
                La obra que buscás no existe o fue retirada del catálogo por la Biblioteca FAUD-UNSJ.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-h3 text-faud-ink">No pudimos cargar la ficha</h1>
              <Alert variant="danger" title="Error al consultar el documento" className="mt-4 text-left">
                {state.message}
              </Alert>
              <button
                type="button"
                onClick={() => setReloadToken((t) => t + 1)}
                className={buttonClasses('primary', 'md', 'mt-5 mr-3')}
              >
                Reintentar
              </button>
            </>
          )}
          <Link to={catalogPath} className={buttonClasses('secondary', 'md', 'mt-5')}>
            Volver al catálogo
          </Link>
        </section>
      </div>
    );
  }

  const ficha = state.doc;
  const departamento = departmentLabel(ficha);
  const tipoLargo = TIPO_DOCUMENTO_LABEL_LARGO[ficha.tipo];

  return (
    <div className="px-5 lg:px-10 pt-4 lg:pt-6 pb-12">
      <nav aria-label="Ruta de navegación" className="hidden lg:block text-body text-faud-muted">
        <Link to={catalogPath} className="hover:text-faud-text">
          Catálogo
        </Link>{' '}
        / <span className="text-faud-text">{ficha.titulo}</span>
      </nav>

      {/* ============ MOBILE (Figma pág. 19) ============ */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2">
          <AvailabilityBadge disponible={ficha.estaDisponible} size="xs" />
          <span className="text-[11px] font-bold text-faud-muted">{tipoLargo}</span>
        </div>
        <h1 className="mt-3 text-[18px] font-bold text-faud-ink leading-snug">{ficha.titulo}</h1>
        <p className="text-caption text-faud-text mt-0.5">
          Autor: <strong>{ficha.autor}</strong>
        </p>
        <p className="text-caption text-faud-text">
          Año: {ficha.anio} · Dpto. {departamento}
        </p>

        <div className="mt-5 rounded-card border-[1.5px] border-faud-amber bg-white p-3">
          <p className="text-body font-bold text-faud-ink">Préstamo digital de 7 días</p>
          <p className="text-[11px] text-faud-muted mt-1">Lectura online, revocación automática al vencer.</p>
          <LoanActionButton action={loanAction} size="mobile" onRequest={requestLoan} className="mt-3" />
        </div>

        <h2 className="mt-5 text-[15px] font-bold text-faud-ink">Resumen</h2>
        <p className="mt-1 text-caption leading-relaxed text-faud-text">{ficha.resumen}</p>

        {ficha.palabrasClave.length > 0 && (
          <>
            <h2 className="mt-3 text-[15px] font-bold text-faud-ink">Palabras clave</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {ficha.palabrasClave.map((kw) => (
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
            <MetaItem compact label="Carrera" value={ficha.carrera} />
            <MetaItem compact label="Tipo" value={tipoLargo} />
            <MetaItem compact label="Director" value={ficha.director} />
            <MetaItem compact label="Formato" value="PDF · Visor protegido" />
          </dl>
        </section>

        <div className="mt-5">
          <LoanConditions compact />
        </div>
      </div>

      {/* ============ DESKTOP (Figma pág. 12) ============ */}
      <div className="hidden lg:flex mt-7 gap-5 items-start">
        <article className="relative flex-1 min-w-0 bg-white rounded-card border border-faud-border-warm px-10 pt-10 pb-10">
          <CornerAccents corners={['tl', 'tr', 'bl']} inset={-1} size={40} className="border-faud-amber" />

          <h1 className="text-[32px] font-bold text-faud-ink leading-tight">{ficha.titulo}</h1>
          <p className="text-[18px] text-faud-muted mt-1">
            {tipoLargo} · {ficha.carrera} · {ficha.anio}
          </p>

          <h2 className="mt-8 text-[18px] font-bold text-faud-ink">Resumen</h2>
          <p className="mt-1.5 text-[16px] leading-[1.5] text-faud-text max-w-[730px]">{ficha.resumen}</p>

          {ficha.palabrasClave.length > 0 && (
            <>
              <h2 className="mt-5 text-[18px] font-bold text-faud-ink">Palabras clave</h2>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {ficha.palabrasClave.map((kw) => (
                  <KeywordTag key={kw}>{kw}</KeywordTag>
                ))}
              </div>
            </>
          )}

          <div className="mt-12 border-t border-faud-border-warm" />

          <h2 className="mt-8 text-[18px] font-bold text-faud-ink">Ficha del documento</h2>
          <dl className="mt-6 grid grid-cols-[200px_200px_1fr] gap-y-7">
            <MetaItem label="Autor" value={ficha.autor} />
            <MetaItem label="Tipo" value={tipoLargo} />
            <MetaItem label="Año" value={String(ficha.anio)} />
            <MetaItem label="Carrera" value={ficha.carrera} />
            <div className="col-span-2">
              <MetaItem label="Departamento de Origen" value={departamento} />
            </div>
            <MetaItem label="Director" value={ficha.director} />
          </dl>
        </article>

        <aside className="w-[400px] shrink-0 space-y-5">
          <section className="bg-white rounded-card border border-faud-border-warm px-6 pt-6 pb-8">
            <AvailabilityBadge disponible={ficha.estaDisponible} size="lg" />
            <h2 className="mt-4 text-[20px] font-bold text-faud-ink">Préstamo digital temporal</h2>
            <p className="mt-3 text-body text-faud-muted leading-relaxed">
              Al solicitar este documento, tendrás acceso de lectura durante{' '}
              <strong className="text-faud-ink">7 días</strong> en la plataforma.
            </p>
            <LoanActionButton action={loanAction} onRequest={requestLoan} className="mt-7" />
            <p className="mt-4 text-caption text-faud-muted max-w-[280px]">
              El acceso se revocará automáticamente al cumplirse el plazo estipulado.
            </p>
          </section>

          <LoanConditions />

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

      {user && (
        <RequestLoanModal
          open={requestOpen}
          documento={ficha}
          userName={user.nombre}
          onClose={() => setRequestOpen(false)}
          onGranted={handleGranted}
          onRejected={handleRejected}
        />
      )}
    </div>
  );
};
