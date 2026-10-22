import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, MoveHorizontal, Plus, ShieldCheck } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { DrmSecurityShield, type DrmBlockedAction } from '../../components/viewer/DrmSecurityShield';
import { PdfThumbnails } from '../../components/viewer/PdfThumbnails';
import { ProtectedPdfCanvas } from '../../components/viewer/ProtectedPdfCanvas';
import { ViewerBlockedScreen } from '../../components/viewer/ViewerBlockedScreen';
import { ViewerCountdown } from '../../components/viewer/ViewerCountdown';
import { MAX_ZOOM, MIN_ZOOM, stepZoom, type ZoomMode } from '../../components/viewer/viewer-zoom';
import { useNotifications } from '../../context/NotificationsContext';
import { useToast } from '../../context/ToastContext';
import { useProtectedViewer } from '../../hooks/useProtectedViewer';

/**
 * Visor de lectura protegido `/visor/:prestamoId` (Figma pág. 14 · Spec FE-04 · RF04, RNF02).
 * Doble validación DRM (Figura 3), render en <canvas> con pdfjs-dist, marca de agua dinámica,
 * escudo antidescarga / antiimpresión y bloqueo inmediato ante vencimiento o revocación.
 */
const BLOCKED_ACTION_TITLE: Record<DrmBlockedAction, string> = {
  guardar: 'Descarga bloqueada',
  imprimir: 'Impresión bloqueada',
  copiar: 'Copia bloqueada',
  seleccionar: 'Selección bloqueada',
  'menu-contextual': 'Menú contextual deshabilitado',
  arrastrar: 'Acción bloqueada',
};
const BLOCKED_TOAST_THROTTLE_MS = 4000;

const LOADING_TEXT = {
  metadata: 'Validando el acceso DRM del préstamo…',
  document: 'Descargando el documento protegido…',
};

const iconButton =
  'inline-flex items-center justify-center w-7 h-7 lg:w-8 lg:h-8 rounded-[4px] bg-[#F3F4F6] text-faud-ink hover:bg-[#E5E7EB] disabled:text-status-disabled disabled:hover:bg-[#F3F4F6] disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faud-amber';

export const ViewerPage: React.FC = () => {
  const { prestamoId } = useParams<{ prestamoId: string }>();
  const { state, metadata, pdf, expiresAt, retry, notifyPageChange } = useProtectedViewer(prestamoId);
  const { showToast } = useToast();
  const { refresh: refreshNotifications } = useNotifications();

  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<ZoomMode>({ kind: 'auto' });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [renderError, setRenderError] = useState(false);
  const lastBlockedToastRef = useRef(0);

  const totalPages = pdf?.numPages ?? 0;
  const reading = state.status === 'ready' && pdf && metadata ? { pdf, metadata } : null;
  const ready = reading !== null;

  useEffect(() => {
    setPage(1);
    setRenderError(false);
  }, [pdf]);

  // Al bloquearse el visor, la campana recoge el aviso PRESTAMO_VENCIDO / PRESTAMO_REVOCADO
  useEffect(() => {
    if (state.status === 'blocked') refreshNotifications();
  }, [state.status, refreshNotifications]);

  const goToPage = useCallback(
    (target: number) => {
      const next = Math.min(Math.max(1, target), totalPages);
      if (!totalPages || next === page) return;
      setPage(next);
      notifyPageChange();
    },
    [page, totalPages, notifyPageChange],
  );

  // Navegación con teclado: ← → · RePág / AvPág · Inicio / Fin
  useEffect(() => {
    if (!ready) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const keyActions: Record<string, number> = {
        ArrowRight: page + 1,
        PageDown: page + 1,
        ArrowLeft: page - 1,
        PageUp: page - 1,
        Home: 1,
        End: totalPages,
      };
      const target = keyActions[event.key];
      if (target === undefined) return;
      event.preventDefault();
      goToPage(target);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ready, page, totalPages, goToPage]);

  const handleBlockedAction = useCallback(
    (action: DrmBlockedAction) => {
      const now = Date.now();
      if (now - lastBlockedToastRef.current < BLOCKED_TOAST_THROTTLE_MS) return;
      lastBlockedToastRef.current = now;
      showToast({
        variant: 'warning',
        title: BLOCKED_ACTION_TITLE[action],
        description: 'El Visor Protegido no permite descargar, imprimir ni copiar el documento (RNF02).',
      });
    },
    [showToast],
  );

  const handleRenderError = useCallback(() => setRenderError(true), []);

  return (
    <DrmSecurityShield className="h-screen flex flex-col bg-[#E5E7EB]" onBlockedAction={handleBlockedAction}>
      {/* Barra superior */}
      <header className="shrink-0 h-topbar lg:h-navbar bg-faud-dark text-faud-text-cream grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 lg:px-6">
        <Link to="/mis-prestamos" className="inline-flex items-center gap-2 text-body hover:text-white" aria-label="Volver a Mis préstamos">
          <ArrowLeft className="w-5 h-5 lg:w-4 lg:h-4" />
          <span className="hidden lg:inline">Volver a Mis préstamos</span>
        </Link>
        <div className="min-w-0 text-left lg:text-center">
          <h1 className="text-caption lg:text-[15px] font-normal lg:font-bold truncate">
            {metadata?.documento.titulo ?? 'Visor Protegido'}
          </h1>
          {metadata && (
            <p className="hidden lg:block text-caption text-faud-text-cream/70 truncate">
              {metadata.documento.autor} · Préstamo {metadata.codigoFormateado}
            </p>
          )}
        </div>
        {ready && expiresAt !== null ? <ViewerCountdown expiresAt={expiresAt} /> : <span />}
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Miniaturas */}
        {reading && (
          <aside className="hidden lg:block w-sidebar shrink-0 bg-[#F9FAFB] border-r border-[#D1D5DB] overflow-y-auto py-6">
            <PdfThumbnails pdf={reading.pdf} currentPage={page} watermark={reading.metadata.marcaAgua} onSelect={goToPage} />
          </aside>
        )}

        {/* Lienzo de lectura */}
        <main className="flex-1 min-w-0 overflow-auto">
          {state.status === 'loading' && (
            <div role="status" className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              <span className="w-10 h-10 border-4 border-faud-amber border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <p className="text-body text-faud-text">{LOADING_TEXT[state.step]}</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="h-full flex items-center justify-center px-4">
              <div className="max-w-[480px] w-full space-y-4">
                <Alert variant="danger" title="No se pudo abrir el Visor Protegido">
                  {state.message}
                </Alert>
                <div className="flex gap-3">
                  <Button onClick={retry}>Reintentar</Button>
                  <Link to="/mis-prestamos" className="inline-flex items-center text-body font-bold text-faud-gold-dark hover:underline">
                    Volver a Mis préstamos
                  </Link>
                </div>
              </div>
            </div>
          )}

          {state.status === 'blocked' && (
            <div className="min-h-full flex items-center justify-center px-4 py-10">
              <ViewerBlockedScreen reason={state.reason} message={state.message} metadata={metadata} />
            </div>
          )}

          {reading &&
            (renderError ? (
              <div className="h-full flex items-center justify-center px-4">
                <div className="max-w-[480px] w-full space-y-4">
                  <Alert variant="danger" title="No se pudo mostrar la página">
                    El documento no pudo renderizarse en este navegador. Reintentá la apertura del visor.
                  </Alert>
                  <Button onClick={retry}>Reintentar</Button>
                </div>
              </div>
            ) : (
              <ProtectedPdfCanvas
                pdf={reading.pdf}
                pageNumber={page}
                zoom={zoom}
                watermark={reading.metadata.marcaAgua}
                onScaleChange={setZoomPercent}
                onError={handleRenderError}
              />
            ))}
        </main>
      </div>

      {/* Barra inferior: paginación, zoom y restricciones DRM */}
      {ready && (
        <footer className="shrink-0 h-12 bg-white border-t border-faud-amber-light grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 lg:px-6">
          <p className="text-[11px] lg:text-body text-faud-muted" aria-live="polite">
            <span className="lg:hidden">
              Pág. {page} / {totalPages}
            </span>
            <span className="hidden lg:inline">
              Página {page} de {totalPages} · Zoom {zoomPercent}%
            </span>
          </p>
          <div className="flex items-center justify-center gap-1.5 lg:gap-2">
            <button type="button" className={iconButton} onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="Página anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" className={iconButton} onClick={() => goToPage(page + 1)} disabled={page >= totalPages} aria-label="Página siguiente">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="w-px h-5 bg-faud-border-warm mx-1 lg:mx-3" aria-hidden="true" />
            <button
              type="button"
              className={iconButton}
              onClick={() => setZoom({ kind: 'percent', value: stepZoom(zoomPercent, -1) })}
              disabled={zoomPercent <= MIN_ZOOM}
              aria-label="Reducir zoom"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`${iconButton} hidden sm:inline-flex w-auto lg:w-auto px-2 text-caption font-bold`}
              onClick={() => setZoom({ kind: 'percent', value: 100 })}
              aria-label="Zoom al 100%"
            >
              100%
            </button>
            <button
              type="button"
              className={iconButton}
              onClick={() => setZoom({ kind: 'percent', value: stepZoom(zoomPercent, 1) })}
              disabled={zoomPercent >= MAX_ZOOM}
              aria-label="Aumentar zoom"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`${iconButton} ${zoom.kind === 'fit-width' ? 'ring-1 ring-faud-amber' : ''}`}
              onClick={() => setZoom({ kind: 'fit-width' })}
              aria-label="Ajustar al ancho"
              aria-pressed={zoom.kind === 'fit-width'}
            >
              <MoveHorizontal className="w-4 h-4" />
            </button>
          </div>
          <span className="justify-self-end inline-flex items-center gap-1.5 h-6 lg:h-7 px-2 rounded-[4px] bg-faud-amber-light text-status-warning text-[10px] lg:text-caption font-bold">
            <ShieldCheck className="w-3.5 h-3.5 hidden sm:block" aria-hidden="true" />
            <span className="lg:hidden">Solo lectura</span>
            <span className="hidden lg:inline">Descarga e impresión deshabilitadas</span>
          </span>
        </footer>
      )}
    </DrmSecurityShield>
  );
};
