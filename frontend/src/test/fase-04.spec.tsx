import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  clearAllDrmTokens,
  clearAuthToken,
  extractDrmHeaders,
  getAuthToken,
  getDrmToken,
  setDrmToken,
} from '../api/http-client';
import { PRINT_LOCK_CLASS } from '../components/viewer/DrmSecurityShield';
import { resolveZoomScale, stepZoom } from '../components/viewer/viewer-zoom';
import { formatCountdown } from '../utils/loan-time';
import type { LoanViewerMetadataResponseDto, NotificationsListResponseDto } from '../types/openapi.types';
import { json, mockBackend, profile, renderAt, requestedUrls, startSession } from './test-utils';

// ============================================================================
// pdf.js no puede ejecutarse en jsdom (sin canvas ni worker): se reemplaza el motor por un documento simulado
// ============================================================================

const engine = vi.hoisted(() => ({ loadProtectedPdf: vi.fn() }));

vi.mock('../components/viewer/pdf-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/viewer/pdf-engine')>()),
  loadProtectedPdf: engine.loadProtectedPdf,
}));

function fakePdf(numPages = 3) {
  const render = vi.fn((_canvas: HTMLCanvasElement, _scale: number, _stamp?: string) => ({
    promise: Promise.resolve(),
    cancel: vi.fn(),
  }));
  const getPage = vi.fn(async (_pageNumber: number) => ({ width: 794, height: 1123, render }));
  const destroy = vi.fn(() => Promise.resolve());
  engine.loadProtectedPdf.mockResolvedValue({ numPages, getPage, destroy });
  return { render, getPage, destroy };
}

// ============================================================================
// Fixtures alineadas con la verificación de la Fase 3 (préstamo #0016 de Ana Pérez)
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LOAN_ID = 'loan-16';
const DOC_ID = 'doc-accesibilidad';
const WATERMARK = 'Ana Pérez · Préstamo #0016';
const DRM_BLOCKED = 'El préstamo ha vencido o fue revocado. El acceso al documento ha sido bloqueado.';
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7 documento protegido');

const viewerMetadata = (segundosRestantes = (5 * DAY + 2 * HOUR + 10 * 60 * 1000) / 1000): LoanViewerMetadataResponseDto => {
  const vence = Date.now() + segundosRestantes * 1000;
  return {
    prestamoId: LOAN_ID,
    codigoReferencia: 16,
    codigoFormateado: '#0016',
    estado: 'ACTIVO',
    fechaInicio: new Date(vence - 7 * DAY).toISOString(),
    fechaVencimiento: new Date(vence).toISOString(),
    diasRestantes: Math.ceil(segundosRestantes / 86400),
    horasRestantes: Math.ceil(segundosRestantes / 3600),
    segundosRestantes,
    porVencer24h: segundosRestantes <= 86400,
    marcaAgua: WATERMARK,
    drm: {
      permitirDescarga: false,
      permitirImpresion: false,
      permitirCopia: false,
      duracionMaximaDias: 7,
      marcaAgua: WATERMARK,
    },
    usuario: {
      id: 'u-ana',
      nombre: 'Ana Pérez',
      email: 'ana.perez@jachal.gov.ar',
      departamento: { id: 'd-jachal', nombre: 'Jáchal', esCapital: false },
    },
    documento: {
      id: DOC_ID,
      titulo: 'Accesibilidad urbana en San Juan',
      autor: 'M. Morales',
      director: null,
      carrera: 'Urbanismo',
      tipo: 'TESIS',
      anio: 2023,
      disponible: true,
      departamentoOrigen: { id: 'd-capital', nombre: 'Capital', esCapital: true },
    },
    streamDocumentoUrl: `/api/v1/documentos/${DOC_ID}/ver`,
    streamPrestamoUrl: `/api/v1/prestamos/${LOAN_ID}/contenido`,
  };
};

const pdfResponse = () =>
  new Response(PDF_BYTES.slice(), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'X-DRM-Watermark-URI': encodeURIComponent(WATERMARK),
      'X-DRM-Loan-Code': '#0016',
    },
  });

const EMPTY_NOTIFICATIONS: NotificationsListResponseDto = {
  contadores: {
    total: 0,
    noLeidas: 0,
    leidas: 0,
    porTipo: { CUENTA_APROBADA: 0, PRESTAMO_OTORGADO: 0, PROXIMO_VENCIMIENTO_24H: 0, PRESTAMO_VENCIDO: 0, PRESTAMO_REVOCADO: 0 },
  },
  meta: { total: 0, page: 1, limit: 5, totalPages: 0 },
  items: [],
};

const headerOf = (fetchMock: ReturnType<typeof mockBackend>, path: string, name: string, call = 0) => {
  const calls = fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.replace(/^\/api\/v1/, '') === path);
  return new Headers((calls[call]?.[1] as RequestInit | undefined)?.headers).get(name);
};

/** Backend con sesión de Ana y préstamo #0016 vigente; `overrides` reemplaza rutas puntuales */
function backend(overrides: Parameters<typeof mockBackend>[0] = {}) {
  return mockBackend({
    'GET /auth/profile': () => json(profile()),
    'GET /notificaciones': () => json(EMPTY_NOTIFICATIONS),
    [`GET /prestamos/${LOAN_ID}/visor`]: () => json(viewerMetadata()),
    [`GET /documentos/${DOC_ID}/ver`]: () => pdfResponse(),
    ...overrides,
  });
}

const openViewer = async () => {
  startSession(profile());
  setDrmToken(LOAN_ID, 'drm-16');
  renderAt(`/visor/${LOAN_ID}`);
  await screen.findByRole('img', { name: 'Página 1 de 3' });
};

describe('Fase 4 — Visor PDF Protegido con DRM Temporal y Marca de Agua Dinámica (RF04, RNF02)', () => {
  const originalFetch = globalThis.fetch;
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

  beforeAll(() => {
    // Área de lectura de escritorio: la página A4 (794 px) entra al 100%
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 });
  });

  afterAll(() => {
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  });

  beforeEach(() => {
    clearAuthToken();
    clearAllDrmTokens();
    engine.loadProtectedPdf.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Doble validación DRM (Figura 3) y render en <canvas>
  // ==========================================================================

  describe('Apertura del visor (/visor/:prestamoId)', () => {
    it('valida el préstamo, descarga el PDF en memoria y lo muestra en canvas con la marca de agua del Backend', async () => {
      const { render, getPage } = fakePdf();
      const fetchMock = backend();
      await openViewer();

      // 1. Metadatos con el token DRM del préstamo y el JWT de sesión
      expect(requestedUrls(fetchMock, `/prestamos/${LOAN_ID}/visor`)).toHaveLength(1);
      expect(headerOf(fetchMock, `/prestamos/${LOAN_ID}/visor`, 'x-drm-token')).toBe('drm-16');
      expect(headerOf(fetchMock, `/prestamos/${LOAN_ID}/visor`, 'Authorization')).toBe('Bearer jwt-u-ana');

      // 2. Stream binario por documento con los mismos encabezados, transferido al motor como ArrayBuffer
      expect(headerOf(fetchMock, `/documentos/${DOC_ID}/ver`, 'x-drm-token')).toBe('drm-16');
      expect(headerOf(fetchMock, `/documentos/${DOC_ID}/ver`, 'Accept')).toContain('application/pdf');
      const buffer = engine.loadProtectedPdf.mock.calls[0][0] as ArrayBuffer;
      expect(Array.from(new Uint8Array(buffer))).toEqual(Array.from(PDF_BYTES));

      // Barra superior: obra, autor, código y cuenta regresiva
      expect(screen.getByRole('heading', { level: 1, name: 'Accesibilidad urbana en San Juan' })).toBeInTheDocument();
      expect(screen.getByText('M. Morales · Préstamo #0016')).toBeInTheDocument();
      expect(screen.getByRole('timer')).toHaveTextContent('Vigente · vence en 5 d 2 h');

      // Página 1 al 100%, con el sello de la marca de agua en el canvas y la capa superpuesta
      await waitFor(() => expect(render).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 1, WATERMARK));
      expect(getPage).toHaveBeenCalledWith(1);
      expect(screen.getByText('Página 1 de 3 · Zoom 100%')).toBeInTheDocument();
      const watermark = screen.getByTestId('drm-watermark');
      expect(watermark).toHaveAttribute('data-watermark', WATERMARK);
      expect(watermark).toHaveClass('pointer-events-none', 'select-none');
      expect(screen.getByText('Descarga e impresión deshabilitadas')).toBeInTheDocument();

      // Sin visor nativo del navegador ni URL pública del archivo
      expect(document.querySelector('iframe, embed, object, a[href*="/ver"], a[href*="/contenido"]')).toBeNull();
      expect(screen.getByRole('link', { name: 'Volver a Mis préstamos' })).toHaveAttribute('href', '/mis-prestamos');
    });

    it('pagina con botones, teclado y miniaturas, y ajusta el zoom con −, 100%, + y ajustar ancho', async () => {
      const user = userEvent.setup();
      const { render, getPage } = fakePdf();
      backend();
      await openViewer();

      await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
      expect(await screen.findByText('Página 2 de 3 · Zoom 100%')).toBeInTheDocument();
      expect(getPage).toHaveBeenCalledWith(2);

      fireEvent.keyDown(window, { key: 'End' });
      expect(await screen.findByText('Página 3 de 3 · Zoom 100%')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Ir a la página 1' }));
      expect(await screen.findByText('Página 1 de 3 · Zoom 100%')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Ir a la página 1' })).toHaveAttribute('aria-current', 'page');

      await user.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
      expect(await screen.findByText('Página 1 de 3 · Zoom 125%')).toBeInTheDocument();
      await waitFor(() => expect(render).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 1.25, WATERMARK));

      await user.click(screen.getByRole('button', { name: 'Reducir zoom' }));
      await user.click(screen.getByRole('button', { name: 'Reducir zoom' }));
      expect(await screen.findByText('Página 1 de 3 · Zoom 75%')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Zoom al 100%' }));
      expect(await screen.findByText('Página 1 de 3 · Zoom 100%')).toBeInTheDocument();

      // (1200 px − 32 px de margen) / 794 px ≈ 147%
      await user.click(screen.getByRole('button', { name: 'Ajustar al ancho' }));
      expect(await screen.findByText('Página 1 de 3 · Zoom 147%')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ajustar al ancho' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('si el token DRM guardado es inválido (401) lo descarta y valida con el JWT de sesión sin cerrar la sesión', async () => {
      fakePdf();
      const fetchMock = backend({
        [`GET /prestamos/${LOAN_ID}/visor`]: (init) =>
          new Headers(init.headers).get('x-drm-token')
            ? json({ statusCode: 401, message: 'Token de acceso DRM inválido o firma criptográfica no reconocida.' }, 401)
            : json(viewerMetadata()),
      });
      await openViewer();

      expect(requestedUrls(fetchMock, `/prestamos/${LOAN_ID}/visor`)).toHaveLength(2);
      expect(headerOf(fetchMock, `/prestamos/${LOAN_ID}/visor`, 'x-drm-token', 1)).toBeNull();
      expect(headerOf(fetchMock, `/prestamos/${LOAN_ID}/visor`, 'Authorization', 1)).toBe('Bearer jwt-u-ana');
      expect(headerOf(fetchMock, `/documentos/${DOC_ID}/ver`, 'x-drm-token')).toBeNull();
      expect(getDrmToken(LOAN_ID)).toBeNull();
      expect(getAuthToken()).toBe('jwt-u-ana');
    });

    it('usa /prestamos/:id/contenido como respaldo si /documentos/:id/ver falla', async () => {
      fakePdf();
      const fetchMock = backend({
        [`GET /documentos/${DOC_ID}/ver`]: () => json({ statusCode: 500, message: 'Error interno' }, 500),
        [`GET /prestamos/${LOAN_ID}/contenido`]: () => pdfResponse(),
      });
      await openViewer();

      expect(requestedUrls(fetchMock, `/prestamos/${LOAN_ID}/contenido`)).toHaveLength(1);
      expect(headerOf(fetchMock, `/prestamos/${LOAN_ID}/contenido`, 'x-drm-token')).toBe('drm-16');
    });

    it('sin sesión redirige al login conservando el visor como destino', async () => {
      backend();
      renderAt(`/visor/${LOAN_ID}`);
      await waitFor(() => expect(window.location.pathname).toBe('/login'));
      expect(window.location.search).toBe(`?redirect=${encodeURIComponent(`/visor/${LOAN_ID}`)}`);
      expect(engine.loadProtectedPdf).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Escudo antidescarga / antiimpresión / anticopia (RNF02)
  // ==========================================================================

  describe('Escudo DRM (DrmSecurityShield)', () => {
    it('bloquea Ctrl+S / Ctrl+P / Cmd+C, el menú contextual, el arrastre y el portapapeles, y bloquea la impresión', async () => {
      fakePdf();
      backend();
      await openViewer();

      expect(document.body).toHaveClass(PRINT_LOCK_CLASS);

      expect(fireEvent.keyDown(window, { key: 's', ctrlKey: true })).toBe(false);
      expect(await screen.findByText('Descarga bloqueada')).toBeInTheDocument();
      expect(fireEvent.keyDown(window, { key: 'p', ctrlKey: true })).toBe(false);
      expect(fireEvent.keyDown(window, { key: 'c', metaKey: true })).toBe(false);
      expect(fireEvent.keyDown(window, { key: 's' })).toBe(true);

      const canvas = screen.getByRole('img', { name: 'Página 1 de 3' });
      expect(fireEvent.contextMenu(canvas)).toBe(false);
      expect(fireEvent.dragStart(canvas)).toBe(false);
      expect(fireEvent.copy(document)).toBe(false);
      expect(canvas).toHaveAttribute('draggable', 'false');
      expect(screen.getByTestId('drm-security-shield')).toHaveClass('drm-protected-view');

      // beforeprint oculta el contenido aunque el navegador ignore @media print
      fireEvent(window, new Event('beforeprint'));
      await waitFor(() => expect(screen.getByTestId('drm-security-shield')).toHaveClass('invisible'));
      fireEvent(window, new Event('afterprint'));
      await waitFor(() => expect(screen.getByTestId('drm-security-shield')).not.toHaveClass('invisible'));
    });
  });

  // ==========================================================================
  // Bloqueo inmediato (403 Forbidden) y vencimiento con el visor abierto
  // ==========================================================================

  describe('Bloqueo inmediato del visor', () => {
    it('un préstamo vencido o revocado (403) muestra el bloqueo sin descargar el PDF', async () => {
      fakePdf();
      const fetchMock = backend({
        [`GET /prestamos/${LOAN_ID}/visor`]: () => json({ statusCode: 403, message: DRM_BLOCKED }, 403),
      });
      startSession(profile());
      setDrmToken(LOAN_ID, 'drm-16');
      renderAt(`/visor/${LOAN_ID}`);

      expect(
        await screen.findByRole('heading', { name: 'Acceso Bloqueado: El préstamo ha vencido o fue revocado' }),
      ).toBeInTheDocument();
      expect(screen.getByText(DRM_BLOCKED)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ir a Mis préstamos' })).toHaveAttribute('href', '/mis-prestamos');
      expect(screen.getByRole('link', { name: 'Explorar el catálogo' })).toHaveAttribute('href', '/catalogo');
      expect(requestedUrls(fetchMock, `/documentos/${DOC_ID}/ver`)).toHaveLength(0);
      expect(engine.loadProtectedPdf).not.toHaveBeenCalled();
      expect(getDrmToken(LOAN_ID)).toBeNull();
    });

    it('la revocación por Biblioteca durante la lectura destruye el documento y bloquea el visor en el acto', async () => {
      const { destroy } = fakePdf();
      let revocado = false;
      const fetchMock = backend({
        [`GET /prestamos/${LOAN_ID}/visor`]: () =>
          revocado ? json({ statusCode: 403, message: DRM_BLOCKED }, 403) : json(viewerMetadata()),
      });
      await openViewer();
      const notificationsBefore = requestedUrls(fetchMock, '/notificaciones').length;

      // Un administrador revoca el préstamo; el usuario vuelve a la pestaña del visor
      revocado = true;
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      fireEvent(document, new Event('visibilitychange'));

      expect(
        await screen.findByRole('heading', { name: 'Acceso Bloqueado: El préstamo ha vencido o fue revocado' }),
      ).toBeInTheDocument();
      expect(destroy).toHaveBeenCalled();
      expect(screen.queryByRole('img', { name: /Página/ })).not.toBeInTheDocument();
      expect(screen.queryByTestId('drm-watermark')).not.toBeInTheDocument();
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
      expect(getDrmToken(LOAN_ID)).toBeNull();
      // La campana vuelve a consultar para mostrar el aviso PRESTAMO_REVOCADO
      await waitFor(() => expect(requestedUrls(fetchMock, '/notificaciones').length).toBeGreaterThan(notificationsBefore));
    });

    it('al cumplirse el plazo con el visor abierto bloquea la lectura y sincroniza el vencimiento con el Backend', async () => {
      const { destroy } = fakePdf();
      let vencido = false;
      const fetchMock = backend({
        [`GET /prestamos/${LOAN_ID}/visor`]: () =>
          vencido ? json({ statusCode: 403, message: DRM_BLOCKED }, 403) : json(viewerMetadata(1)),
      });
      await openViewer();
      expect(screen.getByRole('timer')).toHaveTextContent('Por vencer · vence en 00:01');
      vencido = true;

      expect(
        await screen.findByRole('heading', { name: 'Acceso Bloqueado: El préstamo ha vencido o fue revocado' }, { timeout: 3000 }),
      ).toBeInTheDocument();
      expect(screen.getByText(/El plazo de 7 días del préstamo #0016 finalizó el/)).toBeInTheDocument();
      expect(destroy).toHaveBeenCalled();
      expect(getDrmToken(LOAN_ID)).toBeNull();
      // Consulta de sincronización (ACTIVO → VENCIDO) con el JWT de sesión: el token DRM ya se descartó
      await waitFor(() => expect(requestedUrls(fetchMock, `/prestamos/${LOAN_ID}/visor`)).toHaveLength(2));
      expect(headerOf(fetchMock, `/prestamos/${LOAN_ID}/visor`, 'x-drm-token', 1)).toBeNull();
    });

    it('un error de red al abrir ofrece reintentar', async () => {
      const user = userEvent.setup();
      fakePdf();
      let caido = true;
      backend({
        [`GET /prestamos/${LOAN_ID}/visor`]: () =>
          caido ? json({ statusCode: 503, message: 'Servicio no disponible' }, 503) : json(viewerMetadata()),
      });
      startSession(profile());
      renderAt(`/visor/${LOAN_ID}`);

      expect(await screen.findByText('No se pudo abrir el Visor Protegido')).toBeInTheDocument();
      caido = false;
      await user.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByRole('img', { name: 'Página 1 de 3' })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Utilidades puras
  // ==========================================================================

  describe('Utilidades del visor', () => {
    it('resuelve el zoom efectivo y los pasos − / +', () => {
      expect(resolveZoomScale({ kind: 'percent', value: 150 }, 794, 1200)).toBe(1.5);
      expect(resolveZoomScale({ kind: 'auto' }, 794, 1200)).toBe(1);
      expect(resolveZoomScale({ kind: 'auto' }, 794, 400)).toBeCloseTo(368 / 794);
      expect(resolveZoomScale({ kind: 'fit-width' }, 794, 1200)).toBeCloseTo(1168 / 794);
      expect(resolveZoomScale({ kind: 'fit-width' }, 794, 0)).toBe(1);
      expect(stepZoom(100, 1)).toBe(125);
      expect(stepZoom(147, 1)).toBe(150);
      expect(stepZoom(147, -1)).toBe(125);
      expect(stepZoom(50, -1)).toBe(50);
      expect(stepZoom(300, 1)).toBe(300);
    });

    it('formatea la cuenta regresiva con segundos en la última hora', () => {
      expect(formatCountdown(5 * DAY + 2 * HOUR + 10 * 60 * 1000)).toBe('5 d 2 h');
      expect(formatCountdown(7 * HOUR + 12 * 60 * 1000)).toBe('7 h 12 min');
      expect(formatCountdown(59 * 60 * 1000 + 7000)).toBe('59:07');
      expect(formatCountdown(1000)).toBe('00:01');
      expect(formatCountdown(0)).toBe('00:00');
    });

    it('prefiere la marca de agua URI-encoded sobre el encabezado Latin-1', () => {
      const headers = new Headers({
        'X-DRM-Watermark': 'Ana P?rez · Préstamo #0016',
        'X-DRM-Watermark-URI': encodeURIComponent(WATERMARK),
        'X-DRM-Remaining-Days': '5',
        'X-DRM-Allow-Download': 'false',
      });
      expect(extractDrmHeaders(headers)).toMatchObject({ watermark: WATERMARK, remainingDays: 5, allowDownload: false });
      expect(extractDrmHeaders(new Headers({ 'X-DRM-Watermark': 'Ana Perez' })).watermark).toBe('Ana Perez');
    });
  });
});
