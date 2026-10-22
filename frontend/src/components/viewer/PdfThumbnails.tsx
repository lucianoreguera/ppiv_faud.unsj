import React, { useEffect, useRef, useState } from 'react';
import type { ProtectedPdfDocument } from './pdf-engine';

const THUMBNAIL_WIDTH = 120;

/** Miniatura que se renderiza recién al entrar en pantalla (documentos de cientos de páginas) */
const PdfThumbnail: React.FC<{
  pdf: ProtectedPdfDocument;
  pageNumber: number;
  active: boolean;
  watermark: string;
  onSelect: (pageNumber: number) => void;
}> = ({ pdf, pageNumber, active, watermark, onSelect }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = buttonRef.current;
    if (visible || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelTask: (() => void) | undefined;
    let cancelled = false;
    pdf
      .getPage(pageNumber)
      .then((page) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const task = page.render(canvas, THUMBNAIL_WIDTH / page.width, watermark);
        cancelTask = task.cancel;
        return task.promise;
      })
      // Una miniatura cancelada o fallida no interrumpe la lectura: queda el número de página
      .catch(() => undefined);
    return () => {
      cancelled = true;
      cancelTask?.();
    };
  }, [visible, pdf, pageNumber, watermark]);

  useEffect(() => {
    if (active) buttonRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  return (
    <li className="flex flex-col items-center gap-2">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onSelect(pageNumber)}
        aria-label={`Ir a la página ${pageNumber}`}
        aria-current={active ? 'page' : undefined}
        className={`w-[141px] min-h-[100px] flex items-center justify-center bg-white p-2.5 ${
          active ? 'border-2 border-faud-amber' : 'border border-[#E5E7EB] hover:border-faud-gold-dark'
        }`}
      >
        <canvas ref={canvasRef} draggable={false} className="block max-w-full" />
      </button>
      <span className={`text-caption ${active ? 'font-bold text-faud-ink' : 'text-faud-muted'}`}>{pageNumber}</span>
    </li>
  );
};

/** Columna de miniaturas del visor desktop (Figma pág. 14) */
export const PdfThumbnails: React.FC<{
  pdf: ProtectedPdfDocument;
  currentPage: number;
  watermark: string;
  onSelect: (pageNumber: number) => void;
}> = ({ pdf, currentPage, watermark, onSelect }) => (
  <nav aria-label="Páginas del documento">
    <ul className="flex flex-col items-center gap-6">
      {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
        <PdfThumbnail
          key={n}
          pdf={pdf}
          pageNumber={n}
          active={n === currentPage}
          watermark={watermark}
          onSelect={onSelect}
        />
      ))}
    </ul>
  </nav>
);
