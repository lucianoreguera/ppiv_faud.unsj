import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

/**
 * Motor de renderizado del Visor Protegido (RF04, RNF02) sobre pdfjs-dist.
 * - pdfjs se carga bajo demanda: solo descarga su código quien abre el visor.
 * - El PDF llega como ArrayBuffer y se transfiere al worker: el hilo principal no conserva una copia del archivo.
 * - Cada página se pinta en un <canvas>; no se crea capa de texto, enlaces ni anotaciones (nada que seleccionar o copiar).
 * - Cada página lleva además un sello con la marca de agua impreso en los píxeles del canvas,
 *   que sigue presente aunque se quite la capa DOM de `DynamicWatermark`.
 */

/** pdf.js mide en puntos (1/72"); el 100% del visor equivale al tamaño real en píxeles CSS (96 dpi) */
export const PDF_TO_CSS_UNITS = 96 / 72;

/** Densidad máxima del canvas: más nitidez en pantallas HiDPI sin disparar la memoria con zoom alto */
const MAX_PIXEL_RATIO = 2;
const MAX_CANVAS_PIXELS = 16_777_216;

export interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface ProtectedPdfPage {
  /** Ancho y alto en píxeles CSS al 100% */
  width: number;
  height: number;
  /** Pinta la página en el canvas a `scale` (1 = 100%) y estampa el sello de marca de agua si se indica */
  render: (canvas: HTMLCanvasElement, scale: number, stamp?: string) => PdfRenderTask;
}

export interface ProtectedPdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<ProtectedPdfPage>;
  /** Libera el documento en el worker y descarta el buffer del PDF */
  destroy: () => Promise<void>;
}

/** El render se canceló porque cambió la página o el zoom (no es un error) */
export const isRenderCancelled = (error: unknown) =>
  error instanceof Error && error.name === 'RenderingCancelledException';

let pdfjsLoader: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs() {
  pdfjsLoader ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(
    ([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    },
  );
  return pdfjsLoader;
}

function stampWatermark(ctx: CanvasRenderingContext2D, text: string, width: number, height: number, ratio: number) {
  const fontSize = Math.max(8, Math.round(width / 60));
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(154, 91, 0, 0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, fontSize * 1.5, width - fontSize * 2);
  ctx.fillText(text, width / 2, height - fontSize * 1.5, width - fontSize * 2);
  ctx.restore();
}

function wrapPage(page: PDFPageProxy): ProtectedPdfPage {
  const base = page.getViewport({ scale: PDF_TO_CSS_UNITS });

  return {
    width: base.width,
    height: base.height,
    render: (canvas, scale, stamp) => {
      const viewport = page.getViewport({ scale: scale * PDF_TO_CSS_UNITS });
      const maxRatio = Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height));
      const ratio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, maxRatio));

      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { promise: Promise.reject(new Error('El navegador no permite dibujar en <canvas>.')), cancel: () => {} };
      }

      const task = page.render({
        canvasContext: ctx,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        annotationMode: 0, // AnnotationMode.DISABLE: sin enlaces ni formularios
      });

      return {
        promise: task.promise.then(() => {
          if (stamp) stampWatermark(ctx, stamp, viewport.width, viewport.height, ratio);
        }),
        cancel: () => task.cancel(),
      };
    },
  };
}

export async function loadProtectedPdf(buffer: ArrayBuffer): Promise<ProtectedPdfDocument> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    enableXfa: false,
    disableAutoFetch: true,
  });
  const doc: PDFDocumentProxy = await loadingTask.promise;

  return {
    numPages: doc.numPages,
    getPage: async (pageNumber) => wrapPage(await doc.getPage(pageNumber)),
    destroy: () => loadingTask.destroy(),
  };
}
