import { useCallback, useEffect, useRef, useState } from 'react';
import { loansApi } from '../api/loans.api';
import { ApiHttpError, getDrmToken, removeDrmToken } from '../api/http-client';
import { loadProtectedPdf, type ProtectedPdfDocument } from '../components/viewer/pdf-engine';
import type { LoanViewerMetadataResponseDto } from '../types/openapi.types';

/**
 * Sesión del Visor Protegido con doble validación DRM (Diagrama de Secuencia, Figura 3 · RF04, RNF02).
 * 1. GET /prestamos/:id/visor valida token y vigencia, y entrega marca de agua, segundos restantes y restricciones.
 * 2. GET /documentos/:documentoId/ver (respaldo: /prestamos/:id/contenido) descarga el PDF en memoria, sin URL pública.
 * 3. Mientras se lee, la vigencia se revalida cada minuto, al volver a la pestaña y al cambiar de página.
 *    Un 403 (vencido o revocado por Biblioteca) o el fin del plazo destruyen el documento y bloquean el visor.
 */
export const REVALIDATE_INTERVAL_MS = 60_000;
/** Al cambiar de página se revalida solo si la última validación tiene al menos este tiempo */
export const PAGE_REVALIDATE_MIN_MS = 15_000;

export type ViewerBlockReason = 'expired' | 'revoked-or-expired' | 'forbidden' | 'not-found';

export type ViewerState =
  | { status: 'loading'; step: 'metadata' | 'document' }
  | { status: 'ready' }
  | { status: 'blocked'; reason: ViewerBlockReason; message: string }
  | { status: 'error'; message: string };

/** Token DRM inválido (p. ej. firmado en otro entorno): se descarta y se reintenta con el JWT de sesión */
async function fetchViewerMetadata(prestamoId: string, signal?: AbortSignal) {
  const hasDrmToken = Boolean(getDrmToken(prestamoId));
  try {
    return await loansApi.viewerMetadata(prestamoId, { signal, suppressUnauthorizedEvent: hasDrmToken });
  } catch (error) {
    if (hasDrmToken && error instanceof ApiHttpError && error.status === 401) {
      removeDrmToken(prestamoId);
      return loansApi.viewerMetadata(prestamoId, { signal, useDrmToken: false });
    }
    throw error;
  }
}

async function downloadPdf(metadata: LoanViewerMetadataResponseDto, signal: AbortSignal): Promise<ArrayBuffer> {
  try {
    const { buffer } = await loansApi.documentStream(metadata.documento.id, metadata.prestamoId, { signal });
    return buffer;
  } catch (error) {
    if (error instanceof ApiHttpError && (error.code === 'NOT_FOUND' || error.code === 'SERVER_ERROR')) {
      const { buffer } = await loansApi.loanStream(metadata.prestamoId, { signal });
      return buffer;
    }
    throw error;
  }
}

const isAccessDenied = (error: unknown): error is ApiHttpError =>
  error instanceof ApiHttpError && (error.status === 403 || error.status === 404);

export interface ProtectedViewerSession {
  state: ViewerState;
  metadata: LoanViewerMetadataResponseDto | null;
  pdf: ProtectedPdfDocument | null;
  /** Instante (reloj local) en que vence el préstamo, calculado con `segundosRestantes` para no depender de la hora del equipo */
  expiresAt: number | null;
  retry: () => void;
  /** Avisar un cambio de página: revalida si la última validación no es reciente */
  notifyPageChange: () => void;
}

export function useProtectedViewer(prestamoId: string | undefined): ProtectedViewerSession {
  const [state, setState] = useState<ViewerState>({ status: 'loading', step: 'metadata' });
  const [metadata, setMetadata] = useState<LoanViewerMetadataResponseDto | null>(null);
  const [pdf, setPdf] = useState<ProtectedPdfDocument | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  const pdfRef = useRef<ProtectedPdfDocument | null>(null);
  const blockedRef = useRef(false);
  const lastValidationRef = useRef(0);
  /** Identifica la sesión de carga vigente: las respuestas de una sesión anterior se descartan */
  const sessionRef = useRef(0);

  const releaseDocument = useCallback(() => {
    const current = pdfRef.current;
    pdfRef.current = null;
    setPdf(null);
    if (current) void current.destroy();
  }, []);

  const applyMetadata = useCallback((meta: LoanViewerMetadataResponseDto) => {
    lastValidationRef.current = Date.now();
    setMetadata(meta);
    setExpiresAt(Date.now() + Math.max(0, meta.segundosRestantes) * 1000);
  }, []);

  const block = useCallback(
    (reason: ViewerBlockReason, message: string) => {
      blockedRef.current = true;
      releaseDocument();
      if (prestamoId && reason !== 'forbidden') removeDrmToken(prestamoId);
      setState({ status: 'blocked', reason, message });
    },
    [prestamoId, releaseDocument],
  );

  const handleAccessError = useCallback(
    (error: ApiHttpError) => {
      if (error.status === 404) block('not-found', error.message);
      else block(error.code === 'DRM_BLOCKED' ? 'revoked-or-expired' : 'forbidden', error.message);
    },
    [block],
  );

  // Carga inicial: metadatos → stream → documento pdf.js
  useEffect(() => {
    if (!prestamoId) return;
    const session = ++sessionRef.current;
    const controller = new AbortController();
    const isStale = () => controller.signal.aborted || session !== sessionRef.current;

    blockedRef.current = false;
    setState({ status: 'loading', step: 'metadata' });
    setMetadata(null);
    setExpiresAt(null);

    void (async () => {
      try {
        const meta = await fetchViewerMetadata(prestamoId, controller.signal);
        if (isStale()) return;
        applyMetadata(meta);
        setState({ status: 'loading', step: 'document' });

        const buffer = await downloadPdf(meta, controller.signal);
        if (isStale()) return;

        const doc = await loadProtectedPdf(buffer);
        if (isStale() || blockedRef.current) {
          void doc.destroy();
          return;
        }
        pdfRef.current = doc;
        setPdf(doc);
        setState({ status: 'ready' });
      } catch (error) {
        if (isStale()) return;
        if (isAccessDenied(error)) {
          handleAccessError(error);
        } else if (error instanceof ApiHttpError) {
          setState({ status: 'error', message: error.message });
        } else {
          setState({
            status: 'error',
            message: 'El archivo del documento no pudo abrirse en el Visor Protegido. Reintentá en unos minutos.',
          });
        }
      }
    })();

    return () => {
      controller.abort();
      releaseDocument();
    };
  }, [prestamoId, attempt, applyMetadata, handleAccessError, releaseDocument]);

  const revalidate = useCallback(async () => {
    if (!prestamoId || blockedRef.current) return;
    const session = sessionRef.current;
    lastValidationRef.current = Date.now();
    try {
      const meta = await fetchViewerMetadata(prestamoId);
      if (session === sessionRef.current && !blockedRef.current) applyMetadata(meta);
    } catch (error) {
      // Un error de red o del servidor no corta la lectura: se reintenta en la próxima revalidación
      if (session === sessionRef.current && isAccessDenied(error)) handleAccessError(error);
    }
  }, [prestamoId, applyMetadata, handleAccessError]);

  const ready = state.status === 'ready';

  // Revalidación periódica y al volver a la pestaña
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => void revalidate(), REVALIDATE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void revalidate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, revalidate]);

  // Fin del plazo de 7 días con el visor abierto: bloqueo inmediato y sincronización con el Backend (ACTIVO → VENCIDO)
  useEffect(() => {
    if (!ready || expiresAt === null || !prestamoId) return;
    const timer = window.setTimeout(() => {
      block('expired', 'El plazo de 7 días del préstamo finalizó. El documento se cerró y se descartó de la memoria.');
      void loansApi.viewerMetadata(prestamoId, { suppressUnauthorizedEvent: true }).catch(() => undefined);
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [ready, expiresAt, prestamoId, block]);

  const notifyPageChange = useCallback(() => {
    if (Date.now() - lastValidationRef.current >= PAGE_REVALIDATE_MIN_MS) void revalidate();
  }, [revalidate]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, metadata, pdf, expiresAt, retry, notifyPageChange };
}
