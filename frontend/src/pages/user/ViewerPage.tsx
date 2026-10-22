import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { VIEWER_FIXTURE } from '../../mocks/figma-fixtures';

/**
 * Visor de lectura protegido (Figma págs. 14 y 19).
 * Fase 4 reemplaza la página de ejemplo por el render en <canvas> con pdfjs-dist
 * y toma la marca de agua de GET /api/v1/prestamos/:id/visor.
 */
const ZOOM_STEPS = [50, 75, 100, 125, 150, 200];
const THUMBNAILS = [1, 2, 3];

/** Página de muestra del prototipo (bloques grises = texto e imagen) */
const SamplePage: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <>
    <h2 className={`font-bold text-faud-ink leading-tight ${compact ? 'text-[15px]' : 'text-[32px]'}`}>
      {compact ? 'Accesibilidad Urbana' : VIEWER_FIXTURE.tituloPagina}
    </h2>
    <p className={`text-faud-muted ${compact ? 'text-[9px] mt-0.5' : 'text-[18px] mt-0.5'}`}>
      {compact ? 'Capítulo 1: Fundamentos' : VIEWER_FIXTURE.subtituloPagina}
    </p>
    <div className={compact ? 'mt-5 space-y-[7px]' : 'mt-12 space-y-3'}>
      {['100%', '94%', '97%', '89%', '43%'].map((w) => (
        <div key={w} className={`${compact ? 'h-1.5' : 'h-3'} bg-[#E5E7EB]`} style={{ width: w }} />
      ))}
    </div>
    <div
      className={`relative border border-[#E5E7EB] bg-[#F9FAFB] overflow-hidden ${
        compact ? 'mt-3 h-[105px]' : 'mt-8 h-[300px]'
      }`}
    >
      <svg aria-hidden="true" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d="M0 100L100 0" stroke="#E5E7EB" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden ${
          compact ? 'w-7 h-7 rounded-full bg-[#E5E7EB]' : 'w-20 h-20 rounded-t-full'
        }`}
      >
        {!compact && (
          <>
            <div className="h-1/2 bg-[#E5E7EB]" />
            <div className="h-1/2 bg-[#D1D5DB]" />
          </>
        )}
      </div>
    </div>
    <div className={compact ? 'mt-3 space-y-[7px]' : 'mt-10 space-y-3'}>
      {['100%', '97%', '91%'].map((w) => (
        <div key={w} className={`${compact ? 'h-1.5' : 'h-3'} bg-[#E5E7EB]`} style={{ width: w }} />
      ))}
    </div>
  </>
);

/** Marca de agua diagonal en tono dorado con el titular y el código del préstamo */
const Watermark: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
    {(compact
      ? [
          { top: '44%', left: '50%' },
          { top: '68%', left: '50%' },
        ]
      : [
          { top: '34%', left: '48%' },
          { top: '60%', left: '58%' },
        ]
    ).map(({ top, left }) => (
      <span
        key={top}
        className={`absolute whitespace-nowrap font-bold text-faud-gold-dark ${
          compact ? 'text-[19px]' : 'text-[58px]'
        }`}
        style={{ top, left, transform: 'translate(-50%, -50%) rotate(-45deg)' }}
      >
        {VIEWER_FIXTURE.marcaAgua}
      </span>
    ))}
  </div>
);

export const ViewerPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(2);
  const zoom = ZOOM_STEPS[zoomIndex];

  // Escudo DRM básico: sin menú contextual ni atajos de guardar / imprimir / copiar (RNF02)
  useEffect(() => {
    const blockKeys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'c'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', blockKeys);
    return () => window.removeEventListener('keydown', blockKeys);
  }, []);

  const zoomOut = () => setZoomIndex((i) => Math.max(0, i - 1));
  const zoomIn = () => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1));

  return (
    <div className="drm-protected-view h-screen flex flex-col bg-[#E5E7EB]" onContextMenu={(e) => e.preventDefault()}>
      {/* Top bar */}
      <header className="shrink-0 h-topbar lg:h-navbar bg-faud-dark text-faud-text-cream grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 lg:px-6">
        <Link to="/mis-prestamos" className="inline-flex items-center gap-2 text-body hover:text-white" aria-label="Volver a Mis préstamos">
          <ArrowLeft className="w-5 h-5 lg:w-4 lg:h-4" />
          <span className="hidden lg:inline">Volver a Mis préstamos</span>
        </Link>
        <h1 className="text-caption lg:text-[15px] font-normal lg:font-bold truncate">{VIEWER_FIXTURE.titulo}</h1>
        <span className="justify-self-end inline-flex items-center h-6 lg:h-7 px-3 lg:px-6 rounded-pill bg-faud-amber text-faud-ink text-[10px] lg:text-caption font-bold whitespace-nowrap">
          Vigente · vence en {VIEWER_FIXTURE.diasRestantes} días
        </span>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Miniaturas */}
        <aside className="hidden lg:block w-sidebar shrink-0 bg-[#F9FAFB] border-r border-[#D1D5DB] overflow-y-auto py-6">
          <ul className="flex flex-col items-center gap-6">
            {THUMBNAILS.map((n) => (
              <li key={n} className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(n)}
                  aria-label={`Ir a la página ${n}`}
                  className={`w-[141px] h-[199px] bg-white p-3 ${
                    page === n ? 'border-2 border-faud-amber' : 'border border-[#E5E7EB]'
                  }`}
                >
                  {n === 1 && (
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-[85%] bg-[#D1D5DB]" />
                      {['100%', '93%', '97%'].map((w) => (
                        <div key={w} className="h-1 bg-[#E5E7EB]" style={{ width: w }} />
                      ))}
                    </div>
                  )}
                  {n === 2 && (
                    <div className="space-y-1.5">
                      <div className="h-1 bg-[#E5E7EB]" />
                      <div className="h-1 w-[95%] bg-[#E5E7EB]" />
                      <div className="h-[80px] bg-[#F3F4F6]" />
                    </div>
                  )}
                </button>
                <span className={`text-caption ${page === n ? 'font-bold text-faud-ink' : 'text-faud-muted'}`}>{n}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Lienzo de lectura */}
        <main className="flex-1 min-w-0 overflow-auto px-2 lg:px-0 pt-2 lg:pt-8">
          <div
            className="relative mx-auto bg-white origin-top"
            style={{ width: `min(100%, ${(840 * zoom) / 100}px)` }}
          >
            <div className="lg:hidden relative px-4 pt-6 pb-10 min-h-[calc(100vh-112px)]">
              <SamplePage compact />
              <Watermark compact />
            </div>
            <div className="hidden lg:block relative px-[70px] pt-10 pb-16 min-h-[1000px]" style={{ zoom: zoom / 100 }}>
              <SamplePage />
              <Watermark />
            </div>
          </div>
        </main>
      </div>

      {/* Barra inferior */}
      <footer className="shrink-0 h-12 lg:h-12 bg-white border-t border-faud-amber-light grid grid-cols-[1fr_auto_1fr] items-center px-3 lg:px-6">
        <p className="text-[11px] lg:text-body text-faud-muted">
          <span className="lg:hidden">
            Pág. {page} / {VIEWER_FIXTURE.totalPaginas}
          </span>
          <span className="hidden lg:inline">
            Página {page} de {VIEWER_FIXTURE.totalPaginas} · Zoom {zoom}%
          </span>
        </p>
        <div className="flex items-center gap-2 lg:gap-14">
          <button type="button" onClick={zoomOut} aria-label="Reducir zoom" className="w-7 h-7 lg:w-8 lg:h-8 rounded-[4px] bg-[#F3F4F6] text-faud-ink font-bold hover:bg-[#E5E7EB]">
            -
          </button>
          <button type="button" onClick={zoomIn} aria-label="Aumentar zoom" className="w-7 h-7 lg:w-8 lg:h-8 rounded-[4px] bg-[#F3F4F6] text-faud-ink font-bold hover:bg-[#E5E7EB]">
            +
          </button>
        </div>
        <span className="justify-self-end inline-flex items-center h-6 lg:h-7 px-5 lg:px-2 rounded-[4px] bg-faud-amber-light text-status-warning text-[10px] lg:text-caption font-bold">
          <span className="lg:hidden">Solo lectura</span>
          <span className="hidden lg:inline">Descarga e impresión deshabilitadas</span>
        </span>
      </footer>
    </div>
  );
};
