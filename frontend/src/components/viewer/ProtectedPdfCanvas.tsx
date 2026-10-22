import React, { useEffect, useRef, useState } from 'react';
import { DynamicWatermark } from './DynamicWatermark';
import { isRenderCancelled, type ProtectedPdfDocument, type ProtectedPdfPage } from './pdf-engine';
import { resolveZoomScale, type ZoomMode } from './viewer-zoom';

/** Ancho disponible del área de lectura (se recalcula al redimensionar la ventana) */
function useElementWidth(ref: React.RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export interface ProtectedPdfCanvasProps {
  pdf: ProtectedPdfDocument;
  pageNumber: number;
  zoom: ZoomMode;
  watermark: string;
  /** Zoom efectivo en % (para la barra inferior y los botones − / +) */
  onScaleChange?: (percent: number) => void;
  onError?: (error: unknown) => void;
}

/**
 * Renderizador seguro en <canvas> (Spec FE-04, regla 2): una página por vez, sin <iframe>, <embed> ni visor nativo,
 * con la marca de agua dinámica superpuesta. Al desmontarse vacía los píxeles del canvas.
 */
export const ProtectedPdfCanvas: React.FC<ProtectedPdfCanvasProps> = ({
  pdf,
  pageNumber,
  zoom,
  watermark,
  onScaleChange,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerWidth = useElementWidth(containerRef);
  const [page, setPage] = useState<ProtectedPdfPage | null>(null);
  const [rendering, setRendering] = useState(true);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    pdf
      .getPage(pageNumber)
      .then((loaded) => {
        if (!cancelled) setPage(loaded);
      })
      .catch((error) => {
        if (!cancelled) onErrorRef.current?.(error);
      });
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  const scale = page ? resolveZoomScale(zoom, page.width, containerWidth) : 1;

  useEffect(() => {
    if (page) onScaleChange?.(Math.round(scale * 100));
  }, [page, scale, onScaleChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!page || !canvas || (zoom.kind !== 'percent' && containerWidth === 0)) return;
    setRendering(true);
    const task = page.render(canvas, scale, watermark);
    task.promise
      .then(() => setRendering(false))
      .catch((error) => {
        if (!isRenderCancelled(error)) onErrorRef.current?.(error);
      });
    return () => task.cancel();
  }, [page, scale, watermark, zoom.kind, containerWidth]);

  useEffect(
    () => () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
    [],
  );

  const width = page ? Math.floor(page.width * scale) : undefined;
  const height = page ? Math.floor(page.height * scale) : undefined;

  return (
    // Bloque con margen automático (no flex centrado): con zoom alto la página desborda hacia la derecha y se puede desplazar
    <div ref={containerRef} className="w-full min-h-full px-2 lg:px-4 py-2 lg:py-8">
      <div
        className={`relative mx-auto bg-white shadow-card ${page ? '' : 'w-full max-w-[794px] aspect-[1/1.414]'}`}
        style={page ? { width, height } : undefined}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Página ${pageNumber} de ${pdf.numPages}`}
          draggable={false}
          className="block"
        />
        {page && <DynamicWatermark text={watermark} scale={scale} />}
        {(!page || rendering) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60" aria-hidden="true">
            <span className="w-8 h-8 border-[3px] border-faud-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};
