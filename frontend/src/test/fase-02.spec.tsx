import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllDrmTokens, clearAuthToken } from '../api/http-client';
import { getPageItems } from '../components/ui/Pagination';
import {
  countActiveFilters,
  parseCatalogParams,
  serializeCatalogParams,
  validateYearRange,
} from '../pages/public/catalog-params';
import type {
  DocumentItemDto,
  DocumentsListResponseDto,
  LoanItemDto,
  MyLoansListResponseDto,
  TerritorialMetricsResponseDto,
} from '../types/openapi.types';
import { department, json, mockBackend, profile, renderAt, requestedUrls, startSession } from './test-utils';

// ============================================================================
// Fixtures alineadas con backend/prisma/seed.ts
// ============================================================================

const DEPARTAMENTOS = [
  department('d-capital', 'Capital', true, 1),
  department('d-albardon', 'Albardón'),
  department('d-iglesia', 'Iglesia', false, 1),
  department('d-jachal', 'Jáchal', false, 1),
  department('d-valle-fertil', 'Valle Fértil', false, 1),
];

const METRICAS: TerritorialMetricsResponseDto = {
  totalDepartamentos: 19,
  totalUsuariosProvincia: 7,
  usuariosCapital: 1,
  usuariosDepartamentosAlejados: 6,
  totalDocumentosCatalogados: 4,
  departamentos: DEPARTAMENTOS,
};

const DOC_ID = '330884e3-1802-434e-953c-7633b159dc40';

const documentItem = (overrides: Partial<DocumentItemDto> = {}): DocumentItemDto => ({
  id: DOC_ID,
  titulo: 'Diseño bioclimático en zonas áridas',
  autor: 'E. Silva',
  director: 'Dra. Arq. Valeria Molina',
  carrera: 'Diseño',
  tipo: 'TESIS',
  anio: 2024,
  resumen: 'Propuesta de envolventes arquitectónicas y sistemas pasivos para edificaciones de alta montaña en Iglesia.',
  palabrasClave: ['bioclimática', 'zonas áridas', 'eficiencia energética'],
  disponible: true,
  estaDisponible: true,
  departamentoOrigenId: 'd-iglesia',
  departamentoOrigen: { id: 'd-iglesia', nombre: 'Iglesia', esCapital: false },
  prestamosActivosCount: 0,
  totalPrestamosHistoricos: 0,
  createdAt: '2026-10-21T20:48:27.203Z',
  updatedAt: '2026-10-21T20:48:27.203Z',
  ...overrides,
});

const CATALOGO: DocumentItemDto[] = [
  documentItem(),
  documentItem({
    id: '0919019e-57b5-4a0c-bf1c-f7bb93afab84',
    titulo: 'Accesibilidad urbana en San Juan',
    autor: 'Martín González',
    carrera: 'Urbanismo',
    anio: 2023,
    departamentoOrigenId: 'd-capital',
    departamentoOrigen: { id: 'd-capital', nombre: 'Capital', esCapital: true },
  }),
  documentItem({
    id: '7c0e4a4d-5d0b-4d8c-9c55-3a8f3f0a1b21',
    titulo: 'Vivienda social en Cuyo',
    autor: 'Lucía Martínez',
    tipo: 'INVESTIGACION',
    anio: 2021,
    disponible: false,
    estaDisponible: false,
    departamentoOrigenId: 'd-jachal',
    departamentoOrigen: { id: 'd-jachal', nombre: 'Jáchal', esCapital: false },
  }),
];

const listResponse = (items: DocumentItemDto[], page = 1, total = items.length, limit = 10): DocumentsListResponseDto => ({
  meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  items,
});

const activeLoan = (documento: DocumentItemDto): LoanItemDto => ({
  id: 'loan-1024',
  codigoReferencia: 1024,
  codigoFormateado: '#1024',
  estado: 'ACTIVO',
  fechaInicio: '2026-10-20T12:00:00.000Z',
  fechaVencimiento: '2026-10-27T12:00:00.000Z',
  vigente: true,
  diasRestantes: 5,
  horasRestantes: 120,
  porVencer24h: false,
  marcaAgua: 'Ana Pérez · Préstamo #1024 · FAUD-UNSJ',
  visorUrl: '/api/v1/prestamos/loan-1024/visor',
  contenidoUrl: '/api/v1/prestamos/loan-1024/contenido',
  tokenAcceso: 'jwt-drm',
  usuario: {
    id: 'u-ana',
    nombre: 'Ana Pérez',
    email: 'ana.perez@jachal.gov.ar',
    departamento: { id: 'd-jachal', nombre: 'Jáchal', esCapital: false },
  },
  documento: {
    id: documento.id,
    titulo: documento.titulo,
    autor: documento.autor,
    director: documento.director,
    carrera: documento.carrera,
    tipo: documento.tipo,
    anio: documento.anio,
    disponible: documento.disponible,
    departamentoOrigen: documento.departamentoOrigen,
  },
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-20T12:00:00.000Z',
});

const myLoans = (items: LoanItemDto[]): MyLoansListResponseDto => ({
  contadores: { todos: items.length, activos: items.length, porVencer24h: 0, vencidos: 0, revocados: 0, cerrados: 0 },
  total: items.length,
  items,
});

const lastUrl = (urls: URL[]) => urls[urls.length - 1]!;

describe('Fase 2 — Catálogo Público, Buscador Combinado y Ficha Bibliográfica (RF02)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAuthToken();
    clearAllDrmTokens();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Catálogo público (/catalogo)', () => {
    it('lista GET /documentos con el banner territorial y los 19 departamentos de las métricas', async () => {
      const fetchMock = mockBackend({
        'GET /departamentos/metricas': () => json(METRICAS),
        'GET /documentos': () => json(listResponse(CATALOGO)),
      });

      renderAt('/catalogo');

      expect(await screen.findByRole('heading', { name: 'Diseño bioclimático en zonas áridas' })).toBeInTheDocument();
      expect(screen.getByText('documentos encontrados')).toBeInTheDocument();
      expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);

      const banner = await screen.findByRole('region', { name: 'Alcance territorial interdepartamental' });
      expect(banner).toHaveTextContent('Capital + 18 departamentos de San Juan');
      expect(within(banner).getByText('Documentos catalogados').nextSibling).toHaveTextContent('4');
      expect(within(banner).getByText('Departamentos con obras').nextSibling).toHaveTextContent('4');

      const select = screen.getByLabelText('Departamento de origen') as HTMLSelectElement;
      await waitFor(() => expect(select.options).toHaveLength(6));
      expect(Array.from(select.options).map((o) => o.text)).toEqual([
        'Todos los departamentos',
        'Capital (1)',
        'Albardón',
        'Iglesia (1)',
        'Jáchal (1)',
        'Valle Fértil (1)',
      ]);

      const firstRequest = requestedUrls(fetchMock, '/documentos')[0]!;
      expect(firstRequest.search).toBe('?page=1&limit=10');

      const detailLink = screen.getByRole('link', { name: 'Ver detalle de Diseño bioclimático en zonas áridas' });
      expect(detailLink).toHaveAttribute('href', `/documentos/${DOC_ID}`);
      const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
      expect(hrefs.some((href) => /\/ver$|contenido|\.pdf/.test(href))).toBe(false);
    });

    it('combina búsqueda con debounce, departamento, carrera, tipo, años y disponibilidad en la URL', async () => {
      const user = userEvent.setup();
      const fetchMock = mockBackend({
        'GET /departamentos/metricas': () => json(METRICAS),
        'GET /documentos': () => json(listResponse([CATALOGO[0]!])),
      });

      renderAt('/catalogo');
      await screen.findByRole('heading', { name: 'Diseño bioclimático en zonas áridas' });

      await user.type(screen.getByLabelText('Buscar documentos'), 'bioclim');
      await waitFor(() => expect(window.location.search).toBe('?q=bioclim'));
      const qValues = requestedUrls(fetchMock, '/documentos').map((u) => u.searchParams.get('q'));
      expect(qValues.filter(Boolean)).toEqual(['bioclim']); // el debounce no consulta por cada tecla

      const select = screen.getByLabelText('Departamento de origen');
      await waitFor(() => expect(select).toBeEnabled());
      await user.selectOptions(select, 'd-iglesia');
      await user.selectOptions(screen.getByLabelText('Carrera'), 'Diseño');
      await user.click(screen.getByRole('radio', { name: 'Tesis' }));
      await user.type(screen.getByLabelText('Año desde'), '2020');
      await user.type(screen.getByLabelText('Año hasta'), '2025');
      await user.tab();
      await user.click(screen.getByRole('checkbox', { name: 'Solo disponibles para préstamo' }));

      const expected =
        '?q=bioclim&departamentoId=d-iglesia&carrera=Dise%C3%B1o&tipo=TESIS&anioDesde=2020&anioHasta=2025&disponible=true';
      await waitFor(() => expect(window.location.search).toBe(expected));
      await waitFor(() =>
        expect(Object.fromEntries(lastUrl(requestedUrls(fetchMock, '/documentos')).searchParams)).toEqual({
          q: 'bioclim',
          departamentoId: 'd-iglesia',
          carrera: 'Diseño',
          tipo: 'TESIS',
          anioDesde: '2020',
          anioHasta: '2025',
          disponible: 'true',
          page: '1',
          limit: '10',
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Limpiar filtros (7)' }));
      await waitFor(() => expect(window.location.search).toBe(''));
      expect(screen.getByLabelText('Buscar documentos')).toHaveValue('');
      expect(screen.getByLabelText('Año desde')).toHaveValue('');
    });

    it('hidrata los filtros desde la URL, pagina con meta.totalPages y vuelve a la página 1 al filtrar', async () => {
      const user = userEvent.setup();
      const fetchMock = mockBackend({
        'GET /departamentos/metricas': () => json(METRICAS),
        'GET /documentos': (_init, url) => {
          const page = Number(url.searchParams.get('page'));
          return json(listResponse([CATALOGO[2]!], page, 25));
        },
      });

      renderAt('/catalogo?tipo=INVESTIGACION&departamentoId=d-jachal&page=2');

      expect(await screen.findByRole('heading', { name: 'Vivienda social en Cuyo' })).toBeInTheDocument();
      expect(Object.fromEntries(requestedUrls(fetchMock, '/documentos')[0]!.searchParams)).toMatchObject({
        tipo: 'INVESTIGACION',
        departamentoId: 'd-jachal',
        page: '2',
      });
      expect(screen.getByRole('radio', { name: 'Investigación' })).toBeChecked();
      await waitFor(() => expect(screen.getByLabelText('Departamento de origen')).toHaveValue('d-jachal'));
      expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');

      await user.click(screen.getByRole('button', { name: /Siguiente/ }));
      await waitFor(() =>
        expect(lastUrl(requestedUrls(fetchMock, '/documentos')).searchParams.get('page')).toBe('3'),
      );
      expect(window.location.search).toContain('page=3');

      await user.click(screen.getByRole('radio', { name: 'Tesis' }));
      await waitFor(() => expect(window.location.search).toBe('?departamentoId=d-jachal&tipo=TESIS'));
      expect(lastUrl(requestedUrls(fetchMock, '/documentos')).searchParams.get('page')).toBe('1');
    });

    it('valida el rango de años antes de consultar la API', async () => {
      const user = userEvent.setup();
      const fetchMock = mockBackend({
        'GET /departamentos/metricas': () => json(METRICAS),
        'GET /documentos': () => json(listResponse(CATALOGO)),
      });

      renderAt('/catalogo');
      await screen.findByRole('heading', { name: 'Diseño bioclimático en zonas áridas' });

      await user.type(screen.getByLabelText('Año desde'), '2024');
      await user.type(screen.getByLabelText('Año hasta'), '2020');
      await user.tab();

      expect(await screen.findByText('El año "desde" no puede ser mayor que el año "hasta".')).toBeInTheDocument();
      expect(screen.getByLabelText('Año desde')).toHaveAttribute('aria-invalid', 'true');
      // Pasado el debounce, el rango inválido 2024–2020 nunca llega a la API ni a la URL
      await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
      expect(requestedUrls(fetchMock, '/documentos').some((u) => u.searchParams.has('anioHasta'))).toBe(false);
      expect(window.location.search).not.toContain('anioHasta');
    });

    it('informa el error de la API y permite reintentar', async () => {
      const user = userEvent.setup();
      let attempts = 0;
      mockBackend({
        'GET /departamentos/metricas': () => json(METRICAS),
        'GET /documentos': () => {
          attempts += 1;
          return attempts === 1
            ? json({ statusCode: 500, message: 'Error interno del servidor.' }, 500)
            : json(listResponse(CATALOGO));
        },
      });

      renderAt('/catalogo');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No pudimos cargar el catálogo');
      await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByRole('heading', { name: 'Accesibilidad urbana en San Juan' })).toBeInTheDocument();
      expect(screen.queryByText('No pudimos cargar el catálogo')).not.toBeInTheDocument();
    });
  });

  describe('Ficha bibliográfica (/documentos/:id)', () => {
    it('muestra la ficha completa al visitante con el acceso para iniciar sesión y sin exponer el PDF', async () => {
      const fetchMock = mockBackend({ [`GET /documentos/${DOC_ID}`]: () => json(documentItem()) });

      renderAt(`/documentos/${DOC_ID}`);

      expect((await screen.findAllByRole('heading', { level: 1, name: 'Diseño bioclimático en zonas áridas' })).length).toBe(2);
      expect(screen.getAllByText('Dra. Arq. Valeria Molina').length).toBeGreaterThan(0);
      expect(screen.getByText('Iglesia')).toBeInTheDocument();
      expect(screen.getAllByText('Tesis de Grado').length).toBeGreaterThan(0);
      expect(screen.getAllByText('eficiencia energética').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Propuesta de envolventes arquitectónicas/).length).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('heading', { name: 'Condiciones del préstamo digital y derechos de autor' }).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/sin descarga, impresión ni copia/).length).toBeGreaterThan(0);

      const loginLinks = screen.getAllByRole('link', { name: 'Iniciar sesión para solicitar préstamo (7 días)' });
      loginLinks.forEach((link) =>
        expect(link).toHaveAttribute('href', `/login?redirect=%2Fdocumentos%2F${DOC_ID}`),
      );

      expect(requestedUrls(fetchMock, '/prestamos/mis-prestamos')).toHaveLength(0);
      const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
      expect(hrefs.some((href) => /\/ver$|contenido|\.pdf/.test(href))).toBe(false);
    });

    it('lleva al Visor Protegido cuando el usuario ya tiene un préstamo ACTIVO sobre la obra', async () => {
      startSession(profile());
      const fetchMock = mockBackend({
        'GET /auth/profile': () => json(profile()),
        [`GET /documentos/${DOC_ID}`]: () => json(documentItem()),
        'GET /prestamos/mis-prestamos': () => json(myLoans([activeLoan(documentItem())])),
      });

      renderAt(`/documentos/${DOC_ID}`);

      const viewerLinks = await screen.findAllByRole('link', {
        name: 'Ya tenés un préstamo activo · Abrir en Visor Protegido',
      });
      viewerLinks.forEach((link) => expect(link).toHaveAttribute('href', '/visor/loan-1024'));
      expect(requestedUrls(fetchMock, '/prestamos/mis-prestamos')[0]!.searchParams.get('estado')).toBe('ACTIVO');
      expect(screen.queryByRole('button', { name: 'Solicitar Préstamo Digital (7 días)' })).not.toBeInTheDocument();
    });

    it('ofrece solicitar el préstamo cuando el documento está habilitado y no hay préstamo activo', async () => {
      const user = userEvent.setup();
      startSession(profile());
      const otroDocumento = documentItem({ id: 'otro-doc', titulo: 'Otra obra' });
      mockBackend({
        'GET /auth/profile': () => json(profile()),
        [`GET /documentos/${DOC_ID}`]: () => json(documentItem()),
        'GET /prestamos/mis-prestamos': () => json(myLoans([activeLoan(otroDocumento)])),
      });

      renderAt(`/documentos/${DOC_ID}`);

      const buttons = await screen.findAllByRole('button', { name: 'Solicitar Préstamo Digital (7 días)' });
      buttons.forEach((button) => expect(button).toBeEnabled());
      await user.click(buttons[0]!);
      expect(await screen.findByText('Solicitud de préstamo disponible en la Fase 3')).toBeInTheDocument();
    });

    it('deshabilita la solicitud si Biblioteca suspendió el material (disponible = false)', async () => {
      startSession(profile());
      mockBackend({
        'GET /auth/profile': () => json(profile()),
        [`GET /documentos/${DOC_ID}`]: () => json(documentItem({ disponible: false, estaDisponible: false })),
        'GET /prestamos/mis-prestamos': () => json(myLoans([])),
      });

      renderAt(`/documentos/${DOC_ID}`);

      const buttons = await screen.findAllByRole('button', {
        name: 'Material temporalmente no disponible por Biblioteca',
      });
      buttons.forEach((button) => expect(button).toBeDisabled());
      expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
    });

    it('muestra "Documento no encontrado" ante 404 o un identificador inválido', async () => {
      mockBackend({
        'GET /documentos/no-existe': () =>
          json({ statusCode: 400, message: 'Validation failed (uuid is expected)' }, 400),
      });

      renderAt('/documentos/no-existe');

      expect(await screen.findByRole('heading', { name: 'Documento no encontrado' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/catalogo');
    });

    it('conserva los filtros del catálogo al volver desde la ficha', async () => {
      const user = userEvent.setup();
      mockBackend({
        'GET /departamentos/metricas': () => json(METRICAS),
        'GET /documentos': () => json(listResponse([documentItem()])),
        [`GET /documentos/${DOC_ID}`]: () => json(documentItem()),
      });

      renderAt('/catalogo?tipo=TESIS');
      await user.click(await screen.findByRole('link', { name: 'Ver detalle de Diseño bioclimático en zonas áridas' }));

      await screen.findAllByRole('heading', { level: 1, name: 'Diseño bioclimático en zonas áridas' });
      expect(window.location.pathname).toBe(`/documentos/${DOC_ID}`);
      const breadcrumb = screen.getByRole('navigation', { name: 'Ruta de navegación' });
      expect(within(breadcrumb).getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/catalogo?tipo=TESIS');
    });
  });

  describe('Portada (/)', () => {
    it('muestra las métricas de alcance de GET /departamentos/metricas', async () => {
      mockBackend({
        'GET /departamentos/metricas': () => json({ ...METRICAS, totalDocumentosCatalogados: 1250 }),
      });

      renderAt('/');

      expect(await screen.findByText('1.250')).toBeInTheDocument();
      expect(screen.getByText('19')).toBeInTheDocument();
    });
  });

  describe('Utilidades de filtros y paginación', () => {
    it('parsea y serializa los filtros de la URL descartando valores inválidos', () => {
      const filters = parseCatalogParams(
        new URLSearchParams('q=%20patrimonio%20&tipo=PLANO&carrera=Diseño&anioDesde=2024&anioHasta=2018&disponible=si&page=0'),
      );
      expect(filters).toEqual({ q: 'patrimonio', carrera: 'Diseño', anioDesde: 2018, anioHasta: 2024 });
      expect(countActiveFilters(filters)).toBe(4);
      expect(serializeCatalogParams({ ...filters, page: 1 }).toString()).toBe(
        'q=patrimonio&carrera=Dise%C3%B1o&anioDesde=2018&anioHasta=2024',
      );
      expect(serializeCatalogParams({ disponible: false, page: 3 }).toString()).toBe('disponible=false&page=3');
    });

    it('valida el rango de años y arma la paginación con elipsis', () => {
      expect(validateYearRange('', '')).toEqual({ anioDesde: undefined, anioHasta: undefined });
      expect(validateYearRange('2018', '2024')).toEqual({ anioDesde: 2018, anioHasta: 2024 });
      expect(validateYearRange('20', '').error).toMatch(/4 dígitos/);
      expect(validateYearRange('1900', '').error).toMatch(/1950/);
      expect(validateYearRange('2024', '2018').error).toMatch(/no puede ser mayor/);

      expect(getPageItems(1, 3)).toEqual([1, 2, 3]);
      expect(getPageItems(5, 10)).toEqual([1, 'gap-start', 4, 5, 6, 'gap-end', 10]);
      expect(getPageItems(3, 10)).toEqual([1, 2, 3, 4, 'gap-end', 10]);
    });
  });
});
