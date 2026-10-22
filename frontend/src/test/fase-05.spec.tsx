import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllDrmTokens, clearAuthToken } from '../api/http-client';
import { getAdminLoanStatus } from '../pages/admin/AdminLoansPage';
import {
  parseAdminCatalogParams,
  parseAdminLoansParams,
  parseUsersParams,
  toAdminAuditApiParams,
  toAdminCatalogApiParams,
  toAdminLoansApiParams,
  toUsersApiParams,
  writeAdminLoansParams,
  writeUsersParams,
} from '../pages/admin/admin-params';
import {
  EMPTY_DOCUMENT_FORM,
  MAX_PDF_BYTES,
  addKeywords,
  toUpdateDocumentDto,
  validateDocumentForm,
  validatePdfFile,
} from '../pages/admin/document-form';
import type {
  AdminLoansListResponseDto,
  CronExecutionSummaryResponseDto,
  DocumentItemDto,
  DocumentsListResponseDto,
  EstadoPrestamo,
  EstadoValidacionUsuario,
  LoanItemDto,
  NotificationsListResponseDto,
  UserAdminItemDto,
  UsersListResponseDto,
} from '../types/openapi.types';
import { department, json, mockBackend, profile, renderAt, requestedUrls, startSession, type RouteHandler } from './test-utils';

// ============================================================================
// Fixtures alineadas con backend/prisma/seed.ts
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ADMIN = profile({
  id: 'u-admin',
  nombre: 'Administrador Biblioteca FAUD',
  email: 'admin@faud.unsj.edu.ar',
  rol: 'ADMINISTRADOR',
  departamentoId: 'd-capital',
  departamento: { id: 'd-capital', nombre: 'Capital', esCapital: true },
});

const DEPARTAMENTOS = [
  department('d-capital', 'Capital', true),
  department('d-iglesia', 'Iglesia'),
  department('d-jachal', 'Jáchal'),
  department('d-valle', 'Valle Fértil'),
];

const adminUser = (
  id: string,
  nombre: string,
  email: string,
  dep: { id: string; nombre: string },
  estado: EstadoValidacionUsuario = 'PENDIENTE',
  overrides: Partial<UserAdminItemDto> = {},
): UserAdminItemDto => ({
  id,
  nombre,
  email,
  rol: 'USUARIO',
  estadoValidacion: estado,
  departamentoId: dep.id,
  departamento: { ...dep, esCapital: dep.id === 'd-capital' },
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-20T12:00:00.000Z',
  totalPrestamos: 0,
  ...overrides,
});

const CARLOS = adminUser('u-carlos', 'Carlos Gómez', 'carlos.gomez@vallefertil.gob.ar', { id: 'd-valle', nombre: 'Valle Fértil' });
const LUCIA = adminUser('u-lucia', 'Lucía Fernández', 'lucia.fernandez@iglesia.gob.ar', { id: 'd-iglesia', nombre: 'Iglesia' });
const ANA = adminUser('u-ana', 'Ana Pérez', 'ana.perez@jachal.gov.ar', { id: 'd-jachal', nombre: 'Jáchal' }, 'APROBADO');
const ADMIN_ITEM: UserAdminItemDto = { ...ADMIN, totalPrestamos: 0 };

const usersList = (items: UserAdminItemDto[], all: UserAdminItemDto[] = items): UsersListResponseDto => ({
  contadores: {
    todos: all.length,
    pendientes: all.filter((u) => u.estadoValidacion === 'PENDIENTE').length,
    aprobados: all.filter((u) => u.estadoValidacion === 'APROBADO').length,
    rechazados: all.filter((u) => u.estadoValidacion === 'RECHAZADO').length,
  },
  total: items.length,
  items,
});

const loan = (codigo: number, { estado = 'ACTIVO', venceEn = 5 * DAY }: { estado?: EstadoPrestamo; venceEn?: number } = {}): LoanItemDto => {
  const vence = Date.now() + venceEn;
  const vigente = estado === 'ACTIVO' && venceEn > 0;
  return {
    id: `loan-${codigo}`,
    codigoReferencia: codigo,
    codigoFormateado: `#${String(codigo).padStart(4, '0')}`,
    estado,
    fechaInicio: new Date(vence - 7 * DAY).toISOString(),
    fechaVencimiento: new Date(vence).toISOString(),
    vigente,
    diasRestantes: vigente ? Math.ceil(venceEn / DAY) : 0,
    horasRestantes: vigente ? Math.ceil(venceEn / HOUR) : 0,
    porVencer24h: vigente && venceEn <= DAY,
    marcaAgua: `Ana Pérez · Préstamo #${codigo}`,
    visorUrl: `/api/v1/documentos/doc-${codigo}/ver`,
    contenidoUrl: `/api/v1/prestamos/loan-${codigo}/contenido`,
    tokenAcceso: null,
    usuario: {
      id: 'u-ana',
      nombre: 'Ana Pérez',
      email: 'ana.perez@jachal.gov.ar',
      departamento: { id: 'd-jachal', nombre: 'Jáchal', esCapital: false },
    },
    documento: {
      id: `doc-${codigo}`,
      titulo: `Vivienda social en Cuyo ${codigo}`,
      autor: 'L. Martínez',
      director: null,
      carrera: 'Arquitectura',
      tipo: 'INVESTIGACION',
      anio: 2021,
      disponible: true,
      departamentoOrigen: null,
    },
    createdAt: new Date(vence - 7 * DAY).toISOString(),
    updatedAt: new Date(vence - 7 * DAY).toISOString(),
  };
};

const METRICAS = {
  activos: 18,
  porVencer24h: 4,
  vencidosHoy: 2,
  vencidosTotal: 12,
  revocadosTotal: 1,
  rechazadosTotal: 0,
  cerradosTotal: 5,
  totalHistorico: 36,
};

const adminLoans = (items: LoanItemDto[], page = 1, totalPages = 1): AdminLoansListResponseDto => ({
  metricas: METRICAS,
  meta: { total: items.length, page, limit: 15, totalPages },
  items,
});

const DOC_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

const documentItem = (overrides: Partial<DocumentItemDto> = {}): DocumentItemDto => ({
  id: DOC_ID,
  titulo: 'Arquitectura sustentable en el Valle de Calingasta',
  autor: 'Arq. Mariana Lucero',
  director: 'Dr. Arq. Roberto Sánchez',
  carrera: 'Arquitectura',
  tipo: 'TESIS',
  anio: 2024,
  resumen: 'Análisis de estrategias bioclimáticas y constructivas en tierra aplicadas a equipamientos comunitarios.',
  palabrasClave: ['sustentabilidad', 'Calingasta'],
  disponible: true,
  estaDisponible: true,
  departamentoOrigenId: 'd-iglesia',
  departamentoOrigen: { id: 'd-iglesia', nombre: 'Iglesia', esCapital: false },
  prestamosActivosCount: 0,
  totalPrestamosHistoricos: 0,
  createdAt: '2026-10-21T18:00:00.000Z',
  updatedAt: '2026-10-21T18:00:00.000Z',
  ...overrides,
});

const docsList = (items: DocumentItemDto[]): DocumentsListResponseDto => ({
  meta: { total: items.length, page: 1, limit: 10, totalPages: 1 },
  items,
});

/** Rutas comunes del panel: departamentos, métricas e indicadores del sidebar */
const panelRoutes = (overrides: Record<string, RouteHandler> = {}): Record<string, RouteHandler> => ({
  'GET /auth/profile': () => json(ADMIN),
  'GET /departamentos': () => json(DEPARTAMENTOS),
  'GET /departamentos/metricas': () =>
    json({
      totalDepartamentos: 19,
      totalUsuariosProvincia: 6,
      usuariosCapital: 1,
      usuariosDepartamentosAlejados: 5,
      totalDocumentosCatalogados: 8,
      departamentos: DEPARTAMENTOS,
    }),
  'GET /usuarios': () => json(usersList([CARLOS, LUCIA], [CARLOS, LUCIA, ANA, ADMIN_ITEM])),
  'GET /prestamos': () => json(adminLoans([loan(16, { venceEn: 6 * HOUR })])),
  'GET /notificaciones': () => json({ contadores: { total: 0, noLeidas: 0, leidas: 0, porTipo: {} }, meta: { total: 0, page: 1, limit: 5, totalPages: 0 }, items: [] }),
  ...overrides,
});

const bodyOf = (fetchMock: ReturnType<typeof mockBackend>, method: string, path: string) => {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => (init?.method ?? 'GET') === method && new URL(String(input)).pathname.endsWith(path),
  );
  return call ? JSON.parse(String(call[1]!.body)) : undefined;
};

// ============================================================================
// XMLHttpRequest simulado: delega en el fetch simulado y emite el progreso de subida
// ============================================================================

interface SentUpload {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: FormData;
}

const uploads: SentUpload[] = [];

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
    this.headers[key.toLowerCase()] = value;
  }

  getAllResponseHeaders() {
    return this.responseHeaders;
  }

  abort() {
    this.onabort?.();
  }

  send(body: FormData) {
    uploads.push({ method: this.method, url: this.url, headers: this.headers, body });
    const total = 1000;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 400, total } as ProgressEvent);
    void globalThis.fetch(this.url, { method: this.method, headers: this.headers, body }).then(async (response) => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: total, total } as ProgressEvent);
      this.status = response.status;
      this.responseText = await response.text();
      this.responseHeaders = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\r\n');
      this.onload?.();
    });
  }
}

const pdfFile = (name = 'tesis-calingasta.pdf', size = 2 * 1024 * 1024) => {
  const file = new File(['%PDF-1.7'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// ============================================================================

describe('Fase 5 — Panel de Administración de Biblioteca (RF01, RF04, RF05, RF06)', () => {
  const originalFetch = globalThis.fetch;
  const originalXhr = globalThis.XMLHttpRequest;

  beforeEach(() => {
    clearAuthToken();
    clearAllDrmTokens();
    startSession(ADMIN);
    uploads.length = 0;
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXhr;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Layout y portada del panel
  // ==========================================================================
  describe('Layout y Panel (/admin)', () => {
    it('muestra indicadores de cuentas pendientes y préstamos por vencer en el sidebar y en la portada', async () => {
      const fetchMock = mockBackend(panelRoutes());
      renderAt('/admin');

      expect(await screen.findByLabelText('2 cuentas pendientes de validación')).toBeInTheDocument();
      expect(screen.getByLabelText('4 préstamos por vencer en 24 horas')).toBeInTheDocument();

      const pendientes = screen.getByRole('region', { name: 'Cuentas por validar' });
      expect(within(pendientes).getByText('Carlos Gómez')).toBeInTheDocument();
      expect(within(pendientes).getByText('Valle Fértil')).toBeInTheDocument();

      const porVencer = screen.getByRole('region', { name: 'Préstamos por vencer en 24 h' });
      expect(within(porVencer).getByText('#0016')).toBeInTheDocument();
      expect(within(porVencer).getByText(/^(5|6) h/)).toBeInTheDocument();

      expect(screen.getByRole('link', { name: 'Cuentas pendientes: 2' })).toHaveAttribute('href', '/admin/usuarios');
      expect(screen.getByRole('link', { name: 'Por vencer (24h): 4' })).toHaveAttribute('href', '/admin/prestamos?porVencer=1');
      expect(await screen.findByRole('link', { name: 'Documentos catalogados: 8' })).toBeInTheDocument();

      const [usersCall] = requestedUrls(fetchMock, '/usuarios');
      expect(usersCall!.searchParams.get('estado')).toBe('PENDIENTE');
      const [loansCall] = requestedUrls(fetchMock, '/prestamos');
      expect(loansCall!.searchParams.get('porVencer24h')).toBe('true');
      expect(loansCall!.searchParams.get('limit')).toBe('5');
    });
  });

  // ==========================================================================
  // Validación de usuarios (/admin/usuarios)
  // ==========================================================================
  describe('Validación de usuarios (/admin/usuarios)', () => {
    it('lista pendientes con contadores, combina filtros en la URL y aprueba con observación', async () => {
      const user = userEvent.setup();
      let pending = [CARLOS, LUCIA];
      const fetchMock = mockBackend(
        panelRoutes({
          'GET /usuarios': (_init, url) => {
            const estado = url.searchParams.get('estado');
            const all = [...pending, ANA, ADMIN_ITEM, ...(pending.length < 2 ? [{ ...CARLOS, estadoValidacion: 'APROBADO' as const }] : [])];
            const items = all.filter((u) => !estado || u.estadoValidacion === estado);
            return json(usersList(items, all));
          },
          'PATCH /usuarios/u-carlos/estado': () => {
            pending = [LUCIA];
            return json({
              message: 'El estado de validación del usuario Carlos Gómez (Valle Fértil) fue actualizado a APROBADO.',
              estadoAnterior: 'PENDIENTE',
              estadoActual: 'APROBADO',
              motivo: 'Pertenencia departamental verificada.',
              usuario: { ...CARLOS, estadoValidacion: 'APROBADO' },
            });
          },
        }),
      );

      renderAt('/admin/usuarios');
      const table = await screen.findByRole('table');
      expect(within(table).getByText('Carlos Gómez')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Pendientes (2)' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Todos (4)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Aprobados (2)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Rechazados (0)' })).toBeInTheDocument();

      // Filtros combinados: departamento + búsqueda (debounce) → URL y GET /usuarios
      await screen.findByRole('option', { name: 'Valle Fértil' });
      await user.selectOptions(screen.getByLabelText('Departamento'), 'd-valle');
      await user.type(screen.getByLabelText('Buscar por nombre o correo'), 'vallefertil');
      await waitFor(() => expect(window.location.search).toBe('?departamento=d-valle&q=vallefertil'));
      await waitFor(() => {
        const last = requestedUrls(fetchMock, '/usuarios').at(-1)!;
        expect(last.searchParams.get('departamentoId')).toBe('d-valle');
        expect(last.searchParams.get('q')).toBe('vallefertil');
        expect(last.searchParams.get('estado')).toBe('PENDIENTE');
      });

      // Aprobar con observación
      await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Aprobar a Carlos Gómez' }));
      const dialog = screen.getByRole('dialog', { name: 'Aprobar cuenta' });
      expect(within(dialog).getByText(/se le enviará un correo de confirmación/)).toBeInTheDocument();
      await user.type(within(dialog).getByLabelText('Observación (opcional)'), 'Pertenencia departamental verificada.');
      const usersBefore = requestedUrls(fetchMock, '/usuarios').length;
      await user.click(within(dialog).getByRole('button', { name: 'Aprobar cuenta' }));

      expect(await screen.findByText('Cuenta aprobada')).toBeInTheDocument();
      expect(screen.getByText(/Se envió el correo de confirmación a carlos.gomez@vallefertil.gob.ar/)).toBeInTheDocument();
      expect(bodyOf(fetchMock, 'PATCH', '/usuarios/u-carlos/estado')).toEqual({
        estado: 'APROBADO',
        motivo: 'Pertenencia departamental verificada.',
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // Se vuelven a consultar el listado y los indicadores del sidebar
      await waitFor(() => expect(requestedUrls(fetchMock, '/usuarios').length).toBeGreaterThanOrEqual(usersBefore + 2));
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Pendientes (1)' })).toBeInTheDocument());
    });

    it('rechaza una cuenta, no permite rechazar la propia y muestra el error del Backend en el diálogo', async () => {
      const user = userEvent.setup();
      const fetchMock = mockBackend(
        panelRoutes({
          'GET /usuarios': () => json(usersList([ADMIN_ITEM, ANA, LUCIA])),
          'PATCH /usuarios/u-lucia/estado': () =>
            json({ statusCode: 400, message: 'No se puede modificar la cuenta en este momento.' }, 400),
        }),
      );

      renderAt('/admin/usuarios?estado=todos');
      const table = await screen.findByRole('table');
      expect(screen.getByRole('tab', { name: 'Todos (3)' })).toHaveAttribute('aria-selected', 'true');
      expect(requestedUrls(fetchMock, '/usuarios').some((u) => !u.searchParams.has('estado'))).toBe(true);

      // La cuenta propia (ya aprobada) no ofrece acciones; una aprobada solo puede rechazarse
      expect(within(table).queryByRole('button', { name: /Administrador Biblioteca FAUD/ })).not.toBeInTheDocument();
      expect(within(table).getByText('Tu cuenta')).toBeInTheDocument();
      expect(within(table).queryByRole('button', { name: 'Aprobar a Ana Pérez' })).not.toBeInTheDocument();
      expect(within(table).getByRole('button', { name: 'Rechazar a Ana Pérez' })).toBeInTheDocument();

      await user.click(within(table).getByRole('button', { name: 'Rechazar a Lucía Fernández' }));
      const dialog = screen.getByRole('dialog', { name: 'Rechazar cuenta' });
      await user.click(within(dialog).getByRole('button', { name: 'Rechazar cuenta' }));

      expect(await within(dialog).findByText('No se puede modificar la cuenta en este momento.')).toBeInTheDocument();
      expect(bodyOf(fetchMock, 'PATCH', '/usuarios/u-lucia/estado')).toEqual({ estado: 'RECHAZADO' });
    });
  });

  // ==========================================================================
  // Catálogo (/admin/catalogo)
  // ==========================================================================
  describe('Gestión del catálogo (/admin/catalogo)', () => {
    it('lista el catálogo completo, alterna la disponibilidad y filtra los suspendidos', async () => {
      const user = userEvent.setup();
      const conPrestamos = documentItem({ prestamosActivosCount: 2, totalPrestamosHistoricos: 5 });
      const fetchMock = mockBackend(
        panelRoutes({
          'GET /documentos': () => json(docsList([conPrestamos])),
          [`PATCH /documentos/${DOC_ID}`]: (init) =>
            json({
              message: 'Documento académico actualizado exitosamente.',
              documento: { ...conPrestamos, ...JSON.parse(String(init.body)), estaDisponible: false },
            }),
        }),
      );

      renderAt('/admin/catalogo');
      const table = await screen.findByRole('table');
      const [firstList] = requestedUrls(fetchMock, '/documentos');
      expect(firstList!.searchParams.get('limit')).toBe('10');
      expect(firstList!.searchParams.has('disponible')).toBe(false);
      expect(within(table).getByRole('link', { name: conPrestamos.titulo })).toHaveAttribute('href', `/documentos/${DOC_ID}`);
      expect(within(table).getByRole('link', { name: `Editar “${conPrestamos.titulo}”` })).toHaveAttribute(
        'href',
        `/admin/catalogo/${DOC_ID}/editar`,
      );
      expect(screen.getByRole('link', { name: 'Cargar documento' })).toHaveAttribute('href', '/admin/catalogo/nuevo');

      const toggle = within(table).getByRole('switch', { name: `Suspender préstamos de “${conPrestamos.titulo}”` });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      await user.click(toggle);

      expect(await screen.findByText('Documento suspendido')).toBeInTheDocument();
      expect(screen.getByText(/Los 2 préstamos activos siguen vigentes/)).toBeInTheDocument();
      expect(bodyOf(fetchMock, 'PATCH', `/documentos/${DOC_ID}`)).toEqual({ disponible: false });
      expect(within(table).getByRole('switch', { name: `Habilitar préstamos de “${conPrestamos.titulo}”` })).toHaveAttribute(
        'aria-checked',
        'false',
      );

      await user.click(screen.getByRole('tab', { name: /Suspendidos/ }));
      await waitFor(() => expect(window.location.search).toBe('?disponibilidad=suspendidos'));
      await waitFor(() => expect(requestedUrls(fetchMock, '/documentos').at(-1)!.searchParams.get('disponible')).toBe('false'));
    });

    it('ante el 409 al eliminar ofrece suspender el documento en su lugar', async () => {
      const user = userEvent.setup();
      const doc = documentItem({ totalPrestamosHistoricos: 3 });
      const fetchMock = mockBackend(
        panelRoutes({
          'GET /documentos': () => json(docsList([doc])),
          [`DELETE /documentos/${DOC_ID}`]: () =>
            json(
              {
                statusCode: 409,
                message: `No se puede eliminar físicamente el documento "${doc.titulo}" porque registra historial de préstamos en auditoría.`,
              },
              409,
            ),
          [`PATCH /documentos/${DOC_ID}`]: () =>
            json({ message: 'Documento actualizado.', documento: { ...doc, disponible: false, estaDisponible: false } }),
        }),
      );

      renderAt('/admin/catalogo');
      const table = await screen.findByRole('table');
      await user.click(within(table).getByRole('button', { name: `Eliminar “${doc.titulo}”` }));
      const dialog = screen.getByRole('dialog', { name: 'Eliminar documento' });
      await user.click(within(dialog).getByRole('button', { name: 'Eliminar definitivamente' }));

      expect(await within(dialog).findByText(/registra historial de préstamos/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Suspender en su lugar' }));

      expect(await screen.findByText('Documento suspendido')).toBeInTheDocument();
      expect(bodyOf(fetchMock, 'PATCH', `/documentos/${DOC_ID}`)).toEqual({ disponible: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Alta y edición de documentos (/admin/catalogo/nuevo · /:id/editar)', () => {
    it('valida en cliente, rechaza archivos no PDF o de más de 50 MB y cataloga con multipart y progreso', async () => {
      const user = userEvent.setup({ applyAccept: false });
      let resolveUpload: (() => void) | null = null;
      const fetchMock = mockBackend(
        panelRoutes({
          'GET /documentos': () => json(docsList([documentItem()])),
          'POST /documentos': () => json({ message: 'Documento académico catalogado y almacenado de forma privada.', documento: documentItem() }, 201),
        }),
      );
      // Retiene la respuesta del POST para observar la barra de progreso
      const baseFetch = globalThis.fetch;
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Promise<Response>((resolve) => {
              resolveUpload = () => resolve(baseFetch(input, init));
            })
          : baseFetch(input, init)) as typeof fetch;

      renderAt('/admin/catalogo/nuevo');
      const form = await screen.findByRole('form', { name: 'Cargar documento' });

      // Envío vacío: errores por campo y sin llamadas al Backend
      await user.click(within(form).getByRole('button', { name: 'Guardar y catalogar' }));
      expect(within(form).getByText('Revisá los campos marcados')).toBeInTheDocument();
      expect(within(form).getByText('El título debe tener al menos 3 caracteres.')).toBeInTheDocument();
      expect(within(form).getByText('Agregá al menos una palabra clave.')).toBeInTheDocument();
      expect(within(form).getByText('Seleccioná el archivo PDF del documento.')).toBeInTheDocument();
      expect(uploads).toHaveLength(0);

      // Archivos inválidos
      const input = screen.getByTestId('pdf-input') as HTMLInputElement;
      await user.upload(input, new File(['hola'], 'notas.txt', { type: 'text/plain' }));
      expect(within(form).getByText('Solo se aceptan archivos en formato .pdf.')).toBeInTheDocument();
      await user.upload(input, pdfFile('enorme.pdf', MAX_PDF_BYTES + 1));
      expect(within(form).getByText(/supera el máximo de 50 MB/)).toBeInTheDocument();

      // Formulario completo
      await user.type(within(form).getByLabelText('Título *'), 'Arquitectura sustentable en el Valle de Calingasta');
      await user.type(within(form).getByLabelText('Autor/es *'), 'Arq. Mariana Lucero');
      await user.type(within(form).getByLabelText('Año *'), '2024');
      await user.type(within(form).getByLabelText('Director/a'), 'Dr. Arq. Roberto Sánchez');
      await user.selectOptions(within(form).getByLabelText('Tipo de Documento *'), 'INVESTIGACION');
      await user.selectOptions(within(form).getByLabelText('Carrera *'), 'Urbanismo');
      await screen.findByRole('option', { name: 'Iglesia' });
      await user.selectOptions(within(form).getByLabelText('Departamento de San Juan vinculado'), 'd-iglesia');
      await user.type(within(form).getByLabelText('Palabras clave *'), 'sustentabilidad{Enter}tierra cruda, Calingasta{Enter}');
      await user.type(within(form).getByLabelText('Resumen *'), 'Estrategias bioclimáticas en equipamientos comunitarios.');
      await user.upload(input, pdfFile());
      expect(within(form).getByText('tesis-calingasta.pdf')).toBeInTheDocument();
      expect(within(form).getByText('2.00 MB · Clic para reemplazar')).toBeInTheDocument();

      const preview = screen.getByRole('complementary', { name: 'Vista previa de la ficha' });
      expect(within(preview).getByText('Investigación · Urbanismo · 2024 · Iglesia')).toBeInTheDocument();

      await user.click(within(form).getByRole('button', { name: 'Guardar y catalogar' }));

      const progress = await screen.findByRole('progressbar', { name: 'Progreso de subida del PDF' });
      await waitFor(() => expect(progress).toHaveAttribute('aria-valuenow', '40'));
      expect(within(form).getByRole('button', { name: 'Cancelar carga' })).toBeInTheDocument();

      expect(uploads).toHaveLength(1);
      const [sent] = uploads;
      expect(sent!.method).toBe('POST');
      expect(sent!.url).toMatch(/\/api\/v1\/documentos$/);
      expect(sent!.headers.authorization).toBe('Bearer jwt-u-admin');
      expect(sent!.headers['content-type']).toBeUndefined();
      expect(Object.fromEntries([...sent!.body.entries()].filter(([k]) => k !== 'archivo'))).toEqual({
        titulo: 'Arquitectura sustentable en el Valle de Calingasta',
        autor: 'Arq. Mariana Lucero',
        director: 'Dr. Arq. Roberto Sánchez',
        carrera: 'Urbanismo',
        tipo: 'INVESTIGACION',
        anio: '2024',
        resumen: 'Estrategias bioclimáticas en equipamientos comunitarios.',
        palabrasClave: JSON.stringify(['sustentabilidad', 'tierra cruda', 'Calingasta']),
        departamentoOrigenId: 'd-iglesia',
        disponible: 'true',
      });
      expect((sent!.body.get('archivo') as File).name).toBe('tesis-calingasta.pdf');

      resolveUpload!();
      await waitFor(() => expect(window.location.pathname).toBe('/admin/catalogo'));
      expect(await screen.findByText('Documento catalogado')).toBeInTheDocument();
      expect(requestedUrls(fetchMock, '/documentos').length).toBeGreaterThan(0);
    }, 20_000);

    it('precarga la ficha al editar, guarda metadatos en JSON y reemplaza el PDF con multipart', async () => {
      const user = userEvent.setup();
      const doc = documentItem({ prestamosActivosCount: 1 });
      const fetchMock = mockBackend(
        panelRoutes({
          [`GET /documentos/${DOC_ID}`]: () => json(doc),
          'GET /documentos': () => json(docsList([doc])),
          [`PATCH /documentos/${DOC_ID}`]: () => json({ message: 'Documento académico actualizado exitosamente.', documento: doc }),
        }),
      );

      renderAt(`/admin/catalogo/${DOC_ID}/editar`);
      const form = await screen.findByRole('form', { name: 'Editar documento' });
      expect(within(form).getByLabelText('Título *')).toHaveValue(doc.titulo);
      expect(within(form).getByLabelText('Director/a')).toHaveValue('Dr. Arq. Roberto Sánchez');
      expect(within(form).getByText('sustentabilidad')).toBeInTheDocument();
      expect(within(form).getByText('Si no seleccionás un archivo nuevo, se conserva el PDF actual.')).toBeInTheDocument();

      // Solo metadatos → PATCH JSON (director vacío se envía como "" para borrarlo)
      await user.clear(within(form).getByLabelText('Director/a'));
      await user.click(within(form).getByLabelText(/Disponible para préstamos digitales/));
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(window.location.pathname).toBe('/admin/catalogo'));
      expect(bodyOf(fetchMock, 'PATCH', `/documentos/${DOC_ID}`)).toMatchObject({
        titulo: doc.titulo,
        director: '',
        disponible: false,
        palabrasClave: ['sustentabilidad', 'Calingasta'],
        anio: 2024,
      });
      expect(uploads).toHaveLength(0);
      expect(await screen.findByText('Documento actualizado')).toBeInTheDocument();

      // Reemplazo del PDF → PATCH multipart
      window.history.back();
      const editForm = await screen.findByRole('form', { name: 'Editar documento' });
      await user.upload(screen.getByTestId('pdf-input'), pdfFile('version-revisada.pdf'));
      expect(within(editForm).getByText(/Hay 1 préstamo activo/)).toBeInTheDocument();
      await user.click(within(editForm).getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(uploads).toHaveLength(1));
      expect(uploads[0]!.method).toBe('PATCH');
      expect((uploads[0]!.body.get('archivo') as File).name).toBe('version-revisada.pdf');
      await waitFor(() => expect(window.location.pathname).toBe('/admin/catalogo'));
    });
  });

  // ==========================================================================
  // Préstamos (/admin/prestamos)
  // ==========================================================================
  describe('Tablero de préstamos (/admin/prestamos)', () => {
    it('muestra las 5 métricas, filtra desde las tarjetas y revoca un préstamo con motivo obligatorio', async () => {
      const user = userEvent.setup();
      let revoked = false;
      const fetchMock = mockBackend(
        panelRoutes({
          'GET /prestamos': (_init, url) =>
            url.searchParams.get('limit') === '5'
              ? json(adminLoans([loan(16, { venceEn: 6 * HOUR })]))
              : json(
                  adminLoans(
                    [
                      revoked ? loan(16, { estado: 'REVOCADO' }) : loan(16, { venceEn: 6 * HOUR }),
                      loan(15, { venceEn: 3 * DAY }),
                      loan(9, { estado: 'VENCIDO', venceEn: -2 * DAY }),
                    ],
                    1,
                    3,
                  ),
                ),
          'PATCH /prestamos/loan-16/revocar': () => {
            revoked = true;
            return json({
              message: 'El préstamo #0016 fue revocado inmediatamente por Biblioteca FAUD-UNSJ. El acceso al visor PDF ha quedado bloqueado.',
              estadoAnterior: 'ACTIVO',
              estadoActual: 'REVOCADO',
              motivo: 'Auditoría de Biblioteca.',
              prestamo: loan(16, { estado: 'REVOCADO' }),
            });
          },
        }),
      );

      renderAt('/admin/prestamos');
      const table = await screen.findByRole('table');
      for (const [label, value] of [
        ['Préstamos Activos', '18'],
        ['Por Vencer (24h)', '4'],
        ['Vencidos Hoy', '2'],
        ['Revocados', '1'],
        ['Total Histórico', '36'],
      ]) {
        expect(screen.getByRole('button', { name: new RegExp(`${label.replace(/[()]/g, '\\$&')}\\s*${value}`) })).toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: /Total Histórico/ })).toHaveAttribute('aria-pressed', 'true');

      const rows = within(table).getAllByRole('row').slice(1);
      expect(within(rows[0]!).getByText('#0016')).toBeInTheDocument();
      expect(within(rows[0]!).getByText('Por vencer')).toBeInTheDocument();
      expect(within(rows[0]!).getByText(/^en (5|6) h/)).toBeInTheDocument();
      expect(within(rows[2]!).getByText('Vencido')).toBeInTheDocument();
      expect(within(rows[2]!).queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();

      // Tarjeta "Por vencer" → filtro porVencer24h en la URL y en la API
      await user.click(screen.getByRole('button', { name: /Por Vencer \(24h\)/ }));
      await waitFor(() => expect(window.location.search).toBe('?porVencer=1'));
      await waitFor(() => {
        const last = requestedUrls(fetchMock, '/prestamos').filter((u) => u.searchParams.get('limit') === '15').at(-1)!;
        expect(last.searchParams.get('porVencer24h')).toBe('true');
      });
      expect(screen.getByText('Vencen en las próximas 24 h')).toBeInTheDocument();

      // Filtros por estado y departamento
      await screen.findByRole('option', { name: 'Jáchal' });
      await user.selectOptions(screen.getByLabelText('Estado del préstamo'), 'ACTIVO');
      await user.selectOptions(screen.getByLabelText('Departamento del titular'), 'd-jachal');
      await waitFor(() => expect(window.location.search).toBe('?estado=ACTIVO&porVencer=1&departamento=d-jachal'));

      // Revocar: el motivo es obligatorio
      await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Revocar acceso del préstamo #0016' }));
      const dialog = screen.getByRole('dialog', { name: 'Revocar acceso' });
      await user.click(within(dialog).getByRole('button', { name: 'Revocar acceso' }));
      expect(within(dialog).getByText('Indicá el motivo (al menos 5 caracteres).')).toBeInTheDocument();
      expect(bodyOf(fetchMock, 'PATCH', '/prestamos/loan-16/revocar')).toBeUndefined();

      await user.type(within(dialog).getByLabelText('Motivo administrativo *'), 'Auditoría de Biblioteca.');
      await user.click(within(dialog).getByRole('button', { name: 'Revocar acceso' }));

      expect(await screen.findByText('Préstamo #0016 revocado')).toBeInTheDocument();
      expect(bodyOf(fetchMock, 'PATCH', '/prestamos/loan-16/revocar')).toEqual({ motivo: 'Auditoría de Biblioteca.' });
      await waitFor(() => expect(within(screen.getByRole('table')).getAllByText('Revocado').length).toBeGreaterThan(0));
    });

    it('ejecuta el control de vigencia manual y muestra la auditoría de notificaciones', async () => {
      const user = userEvent.setup();
      const vencido = loan(11, { estado: 'VENCIDO', venceEn: -HOUR });
      const summary: CronExecutionSummaryResponseDto = {
        message: 'Ciclo de control continuo de vigencia y notificaciones ejecutado correctamente (Figura 4 — RF06).',
        timestamp: new Date().toISOString(),
        prestamosVencidosProcesados: 1,
        alertas24hGeneradas: 0,
        correosEnviados: 1,
        detalleVencidos: [
          {
            prestamoId: vencido.id,
            codigoFormateado: '#0011',
            usuarioEmail: 'ana.perez@jachal.gov.ar',
            usuarioNombre: 'Ana Pérez',
            departamentoNombre: 'Jáchal',
            documentoTitulo: vencido.documento.titulo,
            fechaVencimiento: vencido.fechaVencimiento,
            tipoNotificacion: 'PRESTAMO_VENCIDO',
            notificacionId: 'n-11',
            correoEnviado: true,
          },
        ],
        detalleAlertas24h: [],
      };
      const audit: NotificationsListResponseDto = {
        contadores: {
          total: 1,
          noLeidas: 1,
          leidas: 0,
          porTipo: { CUENTA_APROBADA: 0, PRESTAMO_OTORGADO: 0, PROXIMO_VENCIMIENTO_24H: 0, PRESTAMO_VENCIDO: 1, PRESTAMO_REVOCADO: 0 },
        },
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
        items: [
          {
            id: 'n-11',
            prestamoId: vencido.id,
            tipo: 'PRESTAMO_VENCIDO',
            mensaje: 'El préstamo #0011 venció y el acceso al documento fue bloqueado.',
            fechaEnvio: new Date().toISOString(),
            leida: false,
            prestamo: {
              id: vencido.id,
              codigoReferencia: 11,
              codigoFormateado: '#0011',
              estado: 'VENCIDO',
              fechaInicio: vencido.fechaInicio,
              fechaVencimiento: vencido.fechaVencimiento,
              usuario: { id: 'u-ana', nombre: 'Ana Pérez', email: 'ana.perez@jachal.gov.ar', departamentoNombre: 'Jáchal' },
              documento: { id: 'doc-11', titulo: vencido.documento.titulo, autor: 'L. Martínez', carrera: 'Arquitectura', tipo: 'INVESTIGACION', anio: 2021 },
            },
          },
        ],
      };
      const fetchMock = mockBackend(
        panelRoutes({
          'GET /prestamos': () => json(adminLoans([loan(16)])),
          'POST /notificaciones/ejecutar-control-vigencia': () => json(summary),
          'GET /notificaciones/admin': () => json(audit),
        }),
      );

      renderAt('/admin/prestamos');
      await screen.findByRole('table');
      const loansBefore = requestedUrls(fetchMock, '/prestamos').length;
      await user.click(screen.getByRole('button', { name: 'Ejecutar control de vigencia' }));

      const dialog = await screen.findByRole('dialog', { name: 'Control de vigencia ejecutado' });
      expect(within(dialog).getByText(/Figura 4/)).toBeInTheDocument();
      const vencidos = within(dialog).getByRole('region', { name: 'Pasaron a VENCIDO' });
      expect(within(vencidos).getByText('#0011')).toBeInTheDocument();
      expect(within(vencidos).getByText('Correo enviado a ana.perez@jachal.gov.ar')).toBeInTheDocument();
      expect(within(dialog).getByText(/No hay préstamos nuevos dentro de las últimas 24 horas/)).toBeInTheDocument();
      // Tablero e indicadores se vuelven a consultar
      await waitFor(() => expect(requestedUrls(fetchMock, '/prestamos').length).toBeGreaterThanOrEqual(loansBefore + 2));
      await user.click(within(dialog).getByRole('button', { name: 'Entendido' }));

      await user.click(screen.getByRole('tab', { name: 'Auditoría de notificaciones' }));
      await waitFor(() => expect(window.location.search).toBe('?vista=auditoria'));
      const list = await screen.findByRole('list', { name: 'Notificaciones enviadas' });
      expect(within(list).getByText('Préstamo vencido')).toBeInTheDocument();
      expect(within(list).getByText(/Ana Pérez \(Jáchal\)/)).toBeInTheDocument();
      expect(within(list).getByText('No leída')).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Tipo de aviso'), 'PRESTAMO_VENCIDO');
      await user.selectOptions(screen.getByLabelText('Lectura'), 'no');
      await waitFor(() => {
        const last = requestedUrls(fetchMock, '/notificaciones/admin').at(-1)!;
        expect(last.searchParams.get('tipo')).toBe('PRESTAMO_VENCIDO');
        expect(last.searchParams.get('leida')).toBe('false');
        expect(last.searchParams.get('limit')).toBe('20');
      });
      expect(window.location.search).toBe('?vista=auditoria&tipo=PRESTAMO_VENCIDO&leida=no');
    });
  });

  // ==========================================================================
  // Utilidades puras
  // ==========================================================================
  describe('Filtros en la URL y validación del formulario', () => {
    it('traduce los filtros de las vistas admin entre la URL y la API', () => {
      const users = parseUsersParams(new URLSearchParams('estado=rechazados&departamento=d-valle&rol=USUARIO&q=gomez'));
      expect(toUsersApiParams(users)).toEqual({ estado: 'RECHAZADO', departamentoId: 'd-valle', rol: 'USUARIO', q: 'gomez' });
      expect(parseUsersParams(new URLSearchParams('estado=otro&rol=ROOT'))).toEqual({ tab: 'pendientes', departamentoId: undefined, rol: undefined, q: undefined });
      expect(writeUsersParams({ tab: 'pendientes', q: 'ana' }).toString()).toBe('q=ana');

      expect(toAdminCatalogApiParams(parseAdminCatalogParams(new URLSearchParams('disponibilidad=disponibles&page=3')))).toEqual({
        q: undefined,
        disponible: true,
        page: 3,
        limit: 10,
      });

      const loans = parseAdminLoansParams(new URLSearchParams('estado=ACTIVO&porVencer=1&departamento=d-jachal&q=%230016&page=2'));
      expect(toAdminLoansApiParams(loans)).toEqual({
        estado: 'ACTIVO',
        porVencer24h: true,
        departamentoId: 'd-jachal',
        q: '#0016',
        page: 2,
        limit: 15,
      });
      expect(writeAdminLoansParams(loans).toString()).toBe('estado=ACTIVO&porVencer=1&departamento=d-jachal&q=%230016&page=2');
      const audit = parseAdminLoansParams(new URLSearchParams('vista=auditoria&tipo=PRESTAMO_REVOCADO&leida=si'));
      expect(toAdminAuditApiParams(audit)).toEqual({ tipo: 'PRESTAMO_REVOCADO', leida: true, page: 1, limit: 20 });
    });

    it('valida los metadatos y el PDF con las reglas del Backend', () => {
      const valid = {
        ...EMPTY_DOCUMENT_FORM,
        titulo: 'Vivienda social en Cuyo',
        autor: 'L. Martínez',
        anio: '2021',
        palabrasClave: ['Cuyo'],
        resumen: 'Investigación aplicada sobre tipologías de vivienda.',
      };
      expect(validateDocumentForm(valid, pdfFile(), 'create', 2026)).toEqual({});
      expect(validateDocumentForm(valid, null, 'edit', 2026)).toEqual({});
      expect(validateDocumentForm({ ...valid, anio: '1949' }, null, 'edit', 2026).anio).toBe('Ingresá un año entre 1950 y 2027.');
      expect(validateDocumentForm({ ...valid, anio: '2028' }, null, 'edit', 2026).anio).toBeDefined();
      expect(validateDocumentForm({ ...valid, resumen: 'corto' }, null, 'edit', 2026).resumen).toBeDefined();
      expect(validateDocumentForm(valid, null, 'create', 2026).archivo).toBe('Seleccioná el archivo PDF del documento.');

      expect(validatePdfFile(pdfFile('ok.PDF', MAX_PDF_BYTES))).toBeUndefined();
      expect(validatePdfFile(pdfFile('grande.pdf', MAX_PDF_BYTES + 1))).toMatch(/supera el máximo de 50 MB/);
      expect(validatePdfFile(new File(['x'], 'foto.png', { type: 'image/png' }))).toBe('Solo se aceptan archivos en formato .pdf.');
      expect(validatePdfFile(new File([''], 'vacio.pdf', { type: 'application/pdf' }))).toBe('El archivo PDF está vacío.');

      expect(addKeywords(['Cuyo'], 'cuyo, hábitat rural ,  ,Jáchal')).toEqual(['Cuyo', 'hábitat rural', 'Jáchal']);
      expect(toUpdateDocumentDto({ ...valid, director: '  ' })).toMatchObject({ director: '', departamentoOrigenId: undefined, anio: 2021 });
    });

    it('presenta el estado de cada préstamo como lo ve Biblioteca', () => {
      const now = Date.now();
      expect(getAdminLoanStatus(loan(1, { venceEn: 3 * DAY }), now)).toMatchObject({ label: 'Activo', variant: 'success', revocable: true, urgent: false, remaining: 'en 3 d' });
      expect(getAdminLoanStatus(loan(2, { venceEn: 2 * HOUR }), now)).toMatchObject({ label: 'Por vencer', variant: 'alert', revocable: true, urgent: true });
      // ACTIVO cuyo plazo ya pasó pero el Backend aún no sincronizó
      expect(getAdminLoanStatus(loan(3, { venceEn: -60_000 }), now)).toMatchObject({ label: 'Vencido', variant: 'danger', revocable: false });
      expect(getAdminLoanStatus(loan(4, { estado: 'REVOCADO' }), now)).toMatchObject({ label: 'Revocado', revocable: false });
      expect(getAdminLoanStatus(loan(5, { estado: 'CERRADO' }), now)).toMatchObject({ label: 'Cerrado', variant: 'inactive' });
    });
  });
});
