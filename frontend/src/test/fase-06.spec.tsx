import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import openapiRaw from '../../../docs/specs/openapi.json?raw';
import { authApi } from '../api/auth.api';
import { catalogApi } from '../api/catalog.api';
import { departmentsApi } from '../api/departments.api';
import { healthApi } from '../api/health.api';
import { clearAllDrmTokens, clearAuthToken, getAuthToken, getDrmToken } from '../api/http-client';
import { loansApi } from '../api/loans.api';
import { notificationsApi } from '../api/notifications.api';
import { usersApi } from '../api/users.api';
import type {
  AdminLoansFilterParams,
  AdminNotificationsFilterParams,
  CatalogFilterParams,
  MyLoansFilterParams,
  UsersFilterParams,
} from '../types/openapi.types';
import { FAKE_PDF_PAGES, FakeFaudBackend } from './fake-backend';
import { json, profile, renderAt, startSession } from './test-utils';

// ============================================================================
// pdf.js no corre en jsdom: el motor del visor se reemplaza por un documento simulado (igual que en la Fase 4)
// ============================================================================

const engine = vi.hoisted(() => ({ loadProtectedPdf: vi.fn() }));

vi.mock('../components/viewer/pdf-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/viewer/pdf-engine')>()),
  loadProtectedPdf: engine.loadProtectedPdf,
}));

function fakePdf() {
  const render = vi.fn((_canvas: HTMLCanvasElement, _scale: number, _stamp?: string) => ({
    promise: Promise.resolve(),
    cancel: vi.fn(),
  }));
  const destroy = vi.fn(() => Promise.resolve());
  engine.loadProtectedPdf.mockResolvedValue({
    numPages: FAKE_PDF_PAGES,
    getPage: vi.fn(async () => ({ width: 794, height: 1123, render })),
    destroy,
  });
  return { render, destroy };
}

// ============================================================================
// XMLHttpRequest simulado para la subida multipart: delega en el fetch del Backend simulado
// ============================================================================

const xhrRequests: { method: string; url: string }[] = [];

class FakeXMLHttpRequest {
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = '';
  private method = 'GET';
  private url = '';
  private headers: Record<string, string> = {};
  private responseHeaders = '';

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  getAllResponseHeaders() {
    return this.responseHeaders;
  }

  abort() {
    this.onabort?.();
  }

  send(body: FormData) {
    xhrRequests.push({ method: this.method, url: this.url });
    void globalThis.fetch(this.url, { method: this.method, headers: this.headers, body }).then(async (response) => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 } as ProgressEvent);
      this.status = response.status;
      this.responseText = await response.text();
      this.responseHeaders = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\r\n');
      this.onload?.();
    });
  }
}

// ============================================================================
// Ayudantes de navegación e interacción
// ============================================================================

const BLOCKED_HEADING = 'Acceso Bloqueado: El préstamo ha vencido o fue revocado';

/** Navegación por la barra de direcciones (fuera de los enlaces de la SPA) */
const goTo = (path: string) =>
  act(() => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

const login = async (user: ReturnType<typeof userEvent.setup>, email: string, password: string) => {
  const emailInput = await screen.findByLabelText('Correo electrónico');
  await user.clear(emailInput);
  await user.type(emailInput, email);
  const passwordInput = screen.getByLabelText('Contraseña');
  await user.clear(passwordInput);
  await user.type(passwordInput, password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
};

const logout = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click((await screen.findAllByRole('button', { name: 'Cerrar sesión' }))[0]!);
  await waitFor(() => expect(window.location.pathname).toBe('/login'));
};

const returnToTab = () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  fireEvent(document, new Event('visibilitychange'));
};

const pdfFile = () => {
  const file = new File(['%PDF-1.7'], 'tesis-calingasta.pdf', { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 });
  return file;
};

// ============================================================================

describe('Fase 6 — Circuitos integrales y contrato OpenAPI (RF01–RF06, RNF01–RNF02)', () => {
  const originalFetch = globalThis.fetch;
  const originalXhr = globalThis.XMLHttpRequest;
  let backend: FakeFaudBackend;

  beforeEach(() => {
    clearAuthToken();
    clearAllDrmTokens();
    engine.loadProtectedPdf.mockReset();
    xhrRequests.length = 0;
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
    backend = new FakeFaudBackend().install();
  });

  afterEach(() => {
    // Cada circuito solo usa rutas que el Backend atiende
    expect(backend.unhandled).toEqual([]);
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXhr;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Circuitos de punta a punta con estado compartido entre el alumno y Biblioteca
  // ==========================================================================
  describe('Circuitos de punta a punta', () => {
    it('RF05: registro departamental → bloqueo PENDIENTE → aprobación por Biblioteca → ingreso del alumno', async () => {
      const user = userEvent.setup();
      renderAt('/registro');

      // 1. Registro en Iglesia: la cuenta nace PENDIENTE y no abre sesión
      const select = await screen.findByLabelText('Departamento');
      await waitFor(() => expect(select).toBeEnabled());
      await user.type(screen.getByLabelText('Nombre y apellido'), 'Lucía Fernández');
      await user.type(screen.getByLabelText('Correo electrónico'), 'lucia.fernandez@iglesia.gob.ar');
      await user.selectOptions(select, 'd-iglesia');
      await user.type(screen.getByLabelText('Contraseña'), 'Alumno123!');
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
      expect(await screen.findByText('Cuenta registrada en estado PENDIENTE de validación por Biblioteca')).toBeInTheDocument();
      expect(backend.accountState('lucia.fernandez@iglesia.gob.ar')).toBe('PENDIENTE');
      expect(getAuthToken()).toBeNull();

      // 2. Intento de ingreso: 403 PENDIENTE con el banner ámbar
      await user.click(screen.getByRole('link', { name: 'Ir a iniciar sesión' }));
      await login(user, 'lucia.fernandez@iglesia.gob.ar', 'Alumno123!');
      expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta aguarda validación');
      expect(window.location.pathname).toBe('/login');

      // 3. Biblioteca ingresa, ve la cuenta en el panel y la aprueba
      await login(user, 'admin@faud.unsj.edu.ar', 'Admin123!');
      await waitFor(() => expect(window.location.pathname).toBe('/admin'));
      const pendientes = await screen.findByRole('region', { name: 'Cuentas por validar' });
      expect(await within(pendientes).findByText('Lucía Fernández')).toBeInTheDocument();
      expect(screen.getByLabelText('2 cuentas pendientes de validación')).toBeInTheDocument();

      await user.click(screen.getByRole('link', { name: 'Cuentas pendientes: 2' }));
      const table = await screen.findByRole('table');
      await user.click(within(table).getByRole('button', { name: 'Aprobar a Lucía Fernández' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Aprobar cuenta' })).getByRole('button', { name: 'Aprobar cuenta' }));
      expect(await screen.findByText('Cuenta aprobada')).toBeInTheDocument();
      expect(backend.accountState('lucia.fernandez@iglesia.gob.ar')).toBe('APROBADO');
      expect(await screen.findByLabelText('1 cuentas pendientes de validación')).toBeInTheDocument();

      // 4. La alumna ya puede ingresar y llega al catálogo con su departamento
      await logout(user);
      await login(user, 'lucia.fernandez@iglesia.gob.ar', 'Alumno123!');
      await waitFor(() => expect(window.location.pathname).toBe('/catalogo'));
      expect(await screen.findByText('Lucía Fernández · Iglesia')).toBeInTheDocument();
      expect(getAuthToken()).toMatch(/^jwt-/);
    }, 30_000);

    it('RF02 → RF03 → RF04 → RF06: busca, solicita, lee con marca de agua y queda bloqueada al revocarse', async () => {
      const user = userEvent.setup();
      const { render, destroy } = fakePdf();
      renderAt('/catalogo');

      // 1. Visitante: búsqueda libre con debounce y ficha bibliográfica
      await screen.findByRole('link', { name: 'Ver detalle de Accesibilidad urbana en San Juan' });
      await user.type(screen.getByLabelText('Buscar documentos'), 'bioclim');
      await waitFor(() =>
        expect(screen.queryByRole('link', { name: 'Ver detalle de Accesibilidad urbana en San Juan' })).not.toBeInTheDocument(),
      );
      await user.click(screen.getByRole('link', { name: 'Ver detalle de Diseño bioclimático en zonas áridas' }));
      await screen.findAllByRole('heading', { level: 1, name: 'Diseño bioclimático en zonas áridas' });

      // 2. Inicia sesión desde la ficha y vuelve a ella
      await user.click(screen.getAllByRole('link', { name: 'Iniciar sesión para solicitar préstamo (7 días)' })[0]!);
      expect(window.location.search).toBe('?redirect=%2Fdocumentos%2Fdoc-bioclimatico');
      await login(user, 'ana.perez@jachal.gov.ar', 'Alumno123!');
      await waitFor(() => expect(window.location.pathname).toBe('/documentos/doc-bioclimatico'));

      // 3. Solicitud del préstamo de 7 días: código #1024 y token DRM guardado
      await user.click((await screen.findAllByRole('button', { name: 'Solicitar Préstamo Digital (7 días)' }))[0]!);
      await user.click(
        within(screen.getByRole('dialog', { name: 'Confirmar préstamo digital' })).getByRole('button', {
          name: 'Confirmar préstamo (7 días)',
        }),
      );
      const granted = await screen.findByRole('dialog', { name: 'Préstamo #1024 otorgado' });
      expect(granted).toHaveTextContent('Ana Pérez · Préstamo #1024');
      expect(getDrmToken('loan-1024')).toBe('drm-1024');

      // 4. Visor Protegido: canvas con la marca de agua nominal, en pantalla y estampada en los píxeles
      await user.click(within(granted).getByRole('link', { name: 'Abrir en Visor Protegido' }));
      expect(await screen.findByRole('img', { name: `Página 1 de ${FAKE_PDF_PAGES}` })).toBeInTheDocument();
      expect(screen.getByTestId('drm-watermark')).toHaveAttribute('data-watermark', 'Ana Pérez · Préstamo #1024');
      expect(render.mock.calls[0]?.[2]).toContain('Ana Pérez · Préstamo #1024');
      expect(screen.getByRole('timer')).toHaveTextContent(/Vigente · vence en (7 d|6 d 23 h)/);

      // 5. Biblioteca revoca el préstamo desde su sesión: al volver a la pestaña el visor se bloquea
      backend.revokeLoan(1024, 'Auditoría de Biblioteca.');
      returnToTab();
      expect(await screen.findByRole('heading', { name: BLOCKED_HEADING })).toBeInTheDocument();
      expect(destroy).toHaveBeenCalled();
      expect(screen.queryByTestId('drm-watermark')).not.toBeInTheDocument();
      expect(getDrmToken('loan-1024')).toBeNull();

      // 6. Mis préstamos lo muestra en el historial y la campana suma el aviso de revocación
      await user.click(screen.getByRole('link', { name: 'Ir a Mis préstamos' }));
      expect(await screen.findByRole('tab', { name: 'Activos (0)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Vencidos / Historial (1)' })).toBeInTheDocument();
      expect((await screen.findAllByRole('button', { name: 'Notificaciones (2 sin leer)' })).length).toBeGreaterThan(0);
    }, 30_000);

    it('RF01: Biblioteca cataloga un PDF y la obra queda disponible en el catálogo público', async () => {
      const user = userEvent.setup();
      startSession(profile({ id: 'u-admin', rol: 'ADMINISTRADOR', nombre: 'Administrador Biblioteca FAUD', email: 'admin@faud.unsj.edu.ar' }));
      renderAt('/admin/catalogo/nuevo');

      const form = await screen.findByRole('form', { name: 'Cargar documento' });
      await user.type(within(form).getByLabelText('Título *'), 'Arquitectura sustentable en el Valle de Calingasta');
      await user.type(within(form).getByLabelText('Autor/es *'), 'Arq. Mariana Lucero');
      await user.type(within(form).getByLabelText('Año *'), '2024');
      await user.selectOptions(within(form).getByLabelText('Tipo de Documento *'), 'INVESTIGACION');
      await user.selectOptions(within(form).getByLabelText('Carrera *'), 'Arquitectura');
      await screen.findByRole('option', { name: 'Iglesia' });
      await user.selectOptions(within(form).getByLabelText('Departamento de San Juan vinculado'), 'd-iglesia');
      await user.type(within(form).getByLabelText('Palabras clave *'), 'tierra cruda{Enter}Calingasta{Enter}');
      await user.type(within(form).getByLabelText('Resumen *'), 'Estrategias bioclimáticas en equipamientos comunitarios.');
      await user.upload(screen.getByTestId('pdf-input'), pdfFile());
      await user.click(within(form).getByRole('button', { name: 'Guardar y catalogar' }));

      await waitFor(() => expect(window.location.pathname).toBe('/admin/catalogo'));
      expect(await screen.findByText('Documento catalogado')).toBeInTheDocument();
      expect(xhrRequests).toEqual([{ method: 'POST', url: 'http://localhost:3000/api/v1/documentos' }]);
      expect(await screen.findAllByText('Arquitectura sustentable en el Valle de Calingasta')).not.toHaveLength(0);

      // Un visitante la encuentra por palabra clave en el catálogo público
      await logout(user);
      await goTo('/catalogo?q=calingasta');
      expect(
        await screen.findByRole('link', { name: 'Ver detalle de Arquitectura sustentable en el Valle de Calingasta' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Ver detalle de Diseño bioclimático en zonas áridas' })).not.toBeInTheDocument();
    }, 30_000);

    it('RF04: Biblioteca revoca desde el tablero y el titular encuentra el visor bloqueado (403) al ingresar', async () => {
      const user = userEvent.setup();
      fakePdf();
      const codigo = backend.grantLoan('ana.perez@jachal.gov.ar', 'doc-accesibilidad');
      renderAt('/login');

      // 1. Biblioteca revoca el préstamo vigente con motivo obligatorio
      await login(user, 'admin@faud.unsj.edu.ar', 'Admin123!');
      await waitFor(() => expect(window.location.pathname).toBe('/admin'));
      await goTo('/admin/prestamos');
      const table = await screen.findByRole('table');
      await user.click(await within(table).findByRole('button', { name: `Revocar acceso del préstamo #${codigo}` }));
      const dialog = screen.getByRole('dialog', { name: 'Revocar acceso' });
      await user.type(within(dialog).getByLabelText('Motivo administrativo *'), 'Uso indebido detectado por Biblioteca.');
      await user.click(within(dialog).getByRole('button', { name: 'Revocar acceso' }));
      await waitFor(() => expect(backend.loanState(codigo)).toBe('REVOCADO'));

      // 2. La auditoría registra el aviso PRESTAMO_REVOCADO, aún sin leer por la titular
      await user.click(await screen.findByRole('tab', { name: 'Auditoría de notificaciones' }));
      const audit = await screen.findByRole('list', { name: 'Notificaciones enviadas' });
      const revocation = (await within(audit).findByText(/Uso indebido detectado por Biblioteca/)).closest('li')!;
      expect(revocation).toHaveTextContent('Ana Pérez (Jáchal)');
      expect(revocation).toHaveTextContent('No leída');

      // 3. Ana abre el enlace del visor: inicia sesión y el préstamo revocado no descarga el PDF
      await logout(user);
      await goTo(`/visor/loan-${codigo}`);
      await waitFor(() => expect(window.location.search).toBe(`?redirect=%2Fvisor%2Floan-${codigo}`));
      await login(user, 'ana.perez@jachal.gov.ar', 'Alumno123!');
      expect(await screen.findByRole('heading', { name: BLOCKED_HEADING })).toBeInTheDocument();
      expect(engine.loadProtectedPdf).not.toHaveBeenCalled();
      expect(backend.requests).not.toContain('GET /documentos/doc-accesibilidad/ver');
    }, 30_000);

    it('una sesión vencida (401) se cierra con aviso y conserva el destino para volver tras el login', async () => {
      const user = userEvent.setup();
      startSession(profile());
      backend.grantLoan('ana.perez@jachal.gov.ar', 'doc-bioclimatico');
      renderAt('/mis-prestamos');
      expect(await screen.findByRole('tab', { name: 'Activos (1)' })).toBeInTheDocument();

      backend.expireSessions();
      await user.click((await screen.findAllByRole('button', { name: 'Notificaciones (1 sin leer)' }))[0]!);
      await user.click(screen.getByRole('link', { name: 'Ver todas las notificaciones' }));

      await waitFor(() => expect(window.location.pathname).toBe('/login'));
      expect(window.location.search).toBe('?redirect=%2Fnotificaciones');
      expect(await screen.findByText('Tu sesión expiró')).toBeInTheDocument();
      expect(getAuthToken()).toBeNull();

      await login(user, 'ana.perez@jachal.gov.ar', 'Alumno123!');
      await waitFor(() => expect(window.location.pathname).toBe('/notificaciones'));
      expect(await screen.findByRole('tab', { name: 'Todas (1)' })).toBeInTheDocument();
    }, 30_000);
  });

  // ==========================================================================
  // Contrato OpenAPI congelado (docs/specs/openapi.json) ⇄ capa API de la SPA (RNF01)
  // ==========================================================================
  describe('Contrato OpenAPI', () => {
    interface OpenApiOperation {
      parameters?: { name: string; in: string }[];
    }
    const openapi = JSON.parse(openapiRaw) as { paths: Record<string, Record<string, OpenApiOperation>> };
    const operations = Object.entries(openapi.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        key: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        pattern: new RegExp(`^${path.replace(/\{[^}]+\}/g, '([^/]+)')}$`),
        query: (operation.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name),
      })),
    );

    /** Identificadores que usan las invocaciones de abajo: un `{id}` del contrato solo se cumple con uno de ellos */
    const IDS = ['doc-1', 'loan-1024', 'n-1', 'u-carlos'];

    /**
     * Operación del contrato que atiende la petición. Como cada `{id}` exige un identificador de prueba,
     * una ruta literal mal escrita (`/prestamos/mis-prestamo`) no pasa por `/prestamos/{id}`.
     */
    const operationFor = (method: string, pathname: string) =>
      operations.find((op) => {
        const match = op.method === method ? pathname.match(op.pattern) : null;
        return match !== null && match.slice(1).every((segment) => IDS.includes(segment));
      });

    // Todos los filtros que la SPA conoce: `Required<>` obliga a sumar aquí cualquier filtro nuevo
    const catalogFilters: Required<CatalogFilterParams> = {
      q: 'tierra',
      departamentoId: 'd-iglesia',
      carrera: 'Diseño',
      tipo: 'TESIS',
      anio: 2024,
      anioDesde: 2020,
      anioHasta: 2025,
      disponible: true,
      page: 1,
      limit: 10,
    };
    const usersFilters: Required<UsersFilterParams> = { estado: 'PENDIENTE', departamentoId: 'd-jachal', rol: 'USUARIO', q: 'gomez' };
    const myLoansFilters: Required<MyLoansFilterParams> = { estado: 'ACTIVO', porVencer24h: true, q: 'tierra' };
    const adminLoansFilters: Required<AdminLoansFilterParams> = {
      estado: 'ACTIVO',
      departamentoId: 'd-jachal',
      usuarioId: 'u-ana',
      documentoId: 'doc-1',
      porVencer24h: true,
      q: '#1024',
      page: 1,
      limit: 15,
    };
    const notificationFilters: Required<AdminNotificationsFilterParams> = {
      leida: false,
      tipo: 'PRESTAMO_REVOCADO',
      prestamoId: 'loan-1024',
      usuarioId: 'u-ana',
      page: 1,
      limit: 20,
    };
    const { usuarioId: _adminOnly, ...userNotificationFilters } = notificationFilters;

    const API = { authApi, catalogApi, departmentsApi, healthApi, loansApi, notificationsApi, usersApi };
    // El tipo exige una invocación por cada función exportada de la capa API
    const calls: { [M in keyof typeof API]: { [F in keyof (typeof API)[M]]: () => Promise<unknown> } } = {
      authApi: {
        login: () => authApi.login({ email: 'ana.perez@jachal.gov.ar', password: 'Alumno123!' }),
        register: () =>
          authApi.register({ nombre: 'Ana Pérez', email: 'ana.perez@jachal.gov.ar', password: 'Alumno123!', departamentoId: 'd-jachal' }),
        getProfile: () => authApi.getProfile(),
      },
      catalogApi: {
        list: () => catalogApi.list(catalogFilters),
        getById: () => catalogApi.getById('doc-1'),
        create: () =>
          catalogApi.create({
            titulo: 'Obra',
            autor: 'Autora',
            carrera: 'Diseño',
            tipo: 'TESIS',
            anio: 2024,
            resumen: 'Resumen de la obra.',
            palabrasClave: ['tierra'],
            archivo: pdfFile(),
          }),
        update: () => catalogApi.update('doc-1', { disponible: false }),
        remove: () => catalogApi.remove('doc-1'),
      },
      departmentsApi: {
        list: () => departmentsApi.list(),
        metrics: () => departmentsApi.metrics(),
      },
      healthApi: { checkHealth: () => healthApi.checkHealth() },
      loansApi: {
        request: () => loansApi.request('doc-1'),
        myLoans: () => loansApi.myLoans(myLoansFilters),
        close: () => loansApi.close('loan-1024'),
        adminList: () => loansApi.adminList(adminLoansFilters),
        revoke: () => loansApi.revoke('loan-1024', 'Auditoría de Biblioteca.'),
        viewerMetadata: () => loansApi.viewerMetadata('loan-1024'),
        documentStream: () => loansApi.documentStream('doc-1', 'loan-1024'),
        loanStream: () => loansApi.loanStream('loan-1024'),
      },
      notificationsApi: {
        list: () => notificationsApi.list(userNotificationFilters),
        markRead: () => notificationsApi.markRead('n-1', true),
        markAllRead: () => notificationsApi.markAllRead(),
        adminList: () => notificationsApi.adminList(notificationFilters),
        runExpiryControl: () => notificationsApi.runExpiryControl(),
      },
      usersApi: {
        list: () => usersApi.list(usersFilters),
        updateStatus: () => usersApi.updateStatus('u-carlos', { estado: 'APROBADO' }),
      },
    };

    /** Ejecuta cada función de la capa API y registra método, ruta y query de la petición que emite */
    async function recordApiRequests() {
      const sent: { fn: string; method: string; url: URL }[] = [];
      let current = '';
      globalThis.fetch = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
        sent.push({ fn: current, method: init.method ?? 'GET', url: new URL(String(input)) });
        return Promise.resolve(json({}));
      }) as unknown as typeof fetch;
      startSession(profile());
      for (const [module, fns] of Object.entries(calls)) {
        for (const [name, call] of Object.entries(fns as Record<string, () => Promise<unknown>>)) {
          current = `${module}.${name}`;
          await call();
        }
      }
      return sent;
    }

    it('cada función de la capa API llama a una operación declarada en openapi.json con sus query params', async () => {
      const sent = await recordApiRequests();

      const fnsWithoutRequest = Object.entries(calls)
        .flatMap(([module, fns]) => Object.keys(fns).map((name) => `${module}.${name}`))
        .filter((fn) => !sent.some((request) => request.fn === fn));
      expect(fnsWithoutRequest).toEqual([]);

      for (const { fn, method, url } of sent) {
        const operation = operationFor(method, url.pathname);
        expect(operation, `${fn} → ${method} ${url.pathname} no está en el contrato`).toBeDefined();
        const undeclared = [...url.searchParams.keys()].filter((key) => !operation!.query.includes(key));
        expect(undeclared, `${fn} envía query params fuera del contrato`).toEqual([]);
      }

      // Los filtros completos de los listados viajan todos como query params
      const queryOf = (path: string) => [...sent.find((r) => r.method === 'GET' && r.url.pathname === path)!.url.searchParams.keys()];
      expect(queryOf('/api/v1/documentos').sort()).toEqual(Object.keys(catalogFilters).sort());
      expect(queryOf('/api/v1/prestamos').sort()).toEqual(Object.keys(adminLoansFilters).sort());
      expect(queryOf('/api/v1/notificaciones/admin').sort()).toEqual(Object.keys(notificationFilters).sort());
    });

    it('cubre las 26 rutas del contrato salvo las consultas por id que la SPA resuelve desde los listados', async () => {
      const sent = await recordApiRequests();
      const used = new Set(sent.map(({ method, url }) => operationFor(method, url.pathname)!.key));

      expect(new Set(Object.keys(openapi.paths)).size).toBe(26);
      expect(operations.filter((op) => !used.has(op.key)).map((op) => op.key)).toEqual([
        'GET /api/v1/notificaciones/{id}',
        'GET /api/v1/departamentos/{id}',
        'GET /api/v1/usuarios/{id}',
        'GET /api/v1/prestamos/{id}',
      ]);
    });
  });
});
