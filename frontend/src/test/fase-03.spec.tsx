import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllDrmTokens, clearAuthToken, getDrmToken, setDrmToken } from '../api/http-client';
import { getLoanStatus, parseMyLoansTab } from '../components/loans/loan-status';
import { parseNotificationsParams, toNotificationsApiParams } from '../pages/user/NotificationsPage';
import { formatRemaining, getRemainingTime } from '../utils/loan-time';
import type {
  CreateLoanResponseDto,
  DocumentItemDto,
  EstadoPrestamo,
  LoanItemDto,
  MyLoansListResponseDto,
  NotificationItemDto,
  NotificationsListResponseDto,
  TerritorialMetricsResponseDto,
  TipoNotificacion,
} from '../types/openapi.types';
import { department, json, mockBackend, profile, renderAt, requestedUrls, startSession } from './test-utils';

// ============================================================================
// Fixtures alineadas con backend/prisma/seed.ts (fechas relativas al momento de la prueba)
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SECONDS_30 = 30 * 1000;
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
  palabrasClave: ['bioclimática', 'zonas áridas'],
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

interface LoanOptions {
  codigo: number;
  estado?: EstadoPrestamo;
  /** Milisegundos hasta el vencimiento (negativo = ya venció) */
  venceEn?: number;
  titulo?: string;
  documentoId?: string;
}

const loan = ({ codigo, estado = 'ACTIVO', venceEn = 5 * DAY, titulo, documentoId }: LoanOptions): LoanItemDto => {
  const vence = Date.now() + venceEn;
  const vigente = estado === 'ACTIVO' && venceEn > 0;
  return {
    id: `loan-${codigo}`,
    codigoReferencia: codigo,
    codigoFormateado: `#${codigo}`,
    estado,
    fechaInicio: new Date(vence - 7 * DAY).toISOString(),
    fechaVencimiento: new Date(vence).toISOString(),
    vigente,
    diasRestantes: vigente ? Math.ceil(venceEn / DAY) : 0,
    horasRestantes: vigente ? Math.ceil(venceEn / HOUR) : 0,
    porVencer24h: vigente && venceEn <= DAY,
    marcaAgua: `Ana Pérez · Préstamo #${codigo}`,
    visorUrl: `/api/v1/documentos/${documentoId ?? `doc-${codigo}`}/ver`,
    contenidoUrl: `/api/v1/prestamos/loan-${codigo}/contenido`,
    tokenAcceso: vigente ? `drm-${codigo}` : null,
    usuario: {
      id: 'u-ana',
      nombre: 'Ana Pérez',
      email: 'ana.perez@jachal.gov.ar',
      departamento: { id: 'd-jachal', nombre: 'Jáchal', esCapital: false },
    },
    documento: {
      id: documentoId ?? `doc-${codigo}`,
      titulo: titulo ?? `Obra del préstamo ${codigo}`,
      autor: 'M. Morales',
      director: null,
      carrera: 'Urbanismo',
      tipo: 'TESIS',
      anio: 2023,
      disponible: true,
      departamentoOrigen: { id: 'd-capital', nombre: 'Capital', esCapital: true },
    },
    createdAt: new Date(vence - 7 * DAY).toISOString(),
    updatedAt: new Date(vence - 7 * DAY).toISOString(),
  };
};

const myLoans = (items: LoanItemDto[]): MyLoansListResponseDto => ({
  contadores: {
    todos: items.length,
    activos: items.filter((l) => l.estado === 'ACTIVO').length,
    porVencer24h: items.filter((l) => l.porVencer24h).length,
    vencidos: items.filter((l) => l.estado === 'VENCIDO').length,
    revocados: items.filter((l) => l.estado === 'REVOCADO').length,
    cerrados: items.filter((l) => l.estado === 'CERRADO').length,
  },
  total: items.length,
  items,
});

const createLoanResponse = (prestamo: LoanItemDto): CreateLoanResponseDto => ({
  message: `Préstamo digital ${prestamo.codigoFormateado} otorgado exitosamente por 7 días corridos.`,
  prestamo,
  tokenAcceso: prestamo.tokenAcceso!,
  tokenType: 'Bearer',
  expiresInDays: 7,
  marcaAgua: prestamo.marcaAgua,
  drm: {
    permitirDescarga: false,
    permitirImpresion: false,
    permitirCopia: false,
    duracionMaximaDias: 7,
    marcaAgua: prestamo.marcaAgua,
  },
  visorUrl: prestamo.visorUrl,
  contenidoUrl: prestamo.contenidoUrl,
});

const notification = (
  id: string,
  tipo: TipoNotificacion,
  { leida = false, codigo = 1024, horasAtras = 1 }: { leida?: boolean; codigo?: number; horasAtras?: number } = {},
): NotificationItemDto => ({
  id,
  prestamoId: `loan-${codigo}`,
  tipo,
  mensaje:
    tipo === 'PROXIMO_VENCIMIENTO_24H'
      ? `Recordatorio de vencimiento (24h): El préstamo #${codigo} vencerá en aproximadamente 5 hora(s).`
      : `Préstamo digital otorgado por 7 días corridos para "Obra del préstamo ${codigo}".`,
  fechaEnvio: new Date(Date.now() - horasAtras * HOUR).toISOString(),
  leida,
  prestamo: {
    id: `loan-${codigo}`,
    codigoReferencia: codigo,
    codigoFormateado: `#${codigo}`,
    estado: 'ACTIVO',
    fechaInicio: new Date(Date.now() - 2 * DAY).toISOString(),
    fechaVencimiento: new Date(Date.now() + 5 * DAY).toISOString(),
    usuario: { id: 'u-ana', nombre: 'Ana Pérez', email: 'ana.perez@jachal.gov.ar', departamentoNombre: 'Jáchal' },
    documento: {
      id: `doc-${codigo}`,
      titulo: `Obra del préstamo ${codigo}`,
      autor: 'M. Morales',
      carrera: 'Urbanismo',
      tipo: 'TESIS',
      anio: 2023,
    },
  },
});

const notificationsList = (items: NotificationItemDto[], all: NotificationItemDto[] = items, page = 1): NotificationsListResponseDto => {
  const porTipo = {
    CUENTA_APROBADA: 0,
    PRESTAMO_OTORGADO: 0,
    PROXIMO_VENCIMIENTO_24H: 0,
    PRESTAMO_VENCIDO: 0,
    PRESTAMO_REVOCADO: 0,
  } as Record<TipoNotificacion, number>;
  all.forEach((n) => porTipo[n.tipo]++);
  const noLeidas = all.filter((n) => !n.leida).length;
  return {
    contadores: { total: all.length, noLeidas, leidas: all.length - noLeidas, porTipo },
    meta: { total: items.length, page, limit: 20, totalPages: items.length === 0 ? 0 : 1 },
    items,
  };
};

const EMPTY_NOTIFICATIONS = notificationsList([]);

const METRICAS: TerritorialMetricsResponseDto = {
  totalDepartamentos: 19,
  totalUsuariosProvincia: 7,
  usuariosCapital: 1,
  usuariosDepartamentosAlejados: 6,
  totalDocumentosCatalogados: 1,
  departamentos: [department('d-capital', 'Capital', true, 1)],
};

const bodyOf = (fetchMock: ReturnType<typeof mockBackend>, method: string, path: string) => {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => (init?.method ?? 'GET') === method && new URL(String(input)).pathname.endsWith(path),
  );
  return call?.[1]?.body ? JSON.parse(String(call[1].body)) : undefined;
};

/** La campana pide `limit=5`; la bandeja `/notificaciones` pide `limit=20` */
const inboxRequests = (fetchMock: ReturnType<typeof mockBackend>) =>
  requestedUrls(fetchMock, '/notificaciones').filter((u) => u.searchParams.get('limit') === '20');

describe('Fase 3 — Solicitud de Préstamo, Mis Préstamos y Notificaciones (RF03, RF06)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAuthToken();
    clearAllDrmTokens();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Solicitud de préstamo desde la ficha (RequestLoanModal + POST /prestamos)
  // ==========================================================================
  describe('Solicitud de préstamo (RequestLoanModal)', () => {
    it('confirma la solicitud, guarda el token DRM y ofrece abrir el Visor Protegido', async () => {
      const user = userEvent.setup();
      startSession(profile());
      const otorgado = loan({ codigo: 1025, venceEn: 7 * DAY, documentoId: DOC_ID, titulo: documentItem().titulo });
      let granted = false;
      const fetchMock = mockBackend({
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': () =>
          json(granted ? notificationsList([notification('n-1', 'PRESTAMO_OTORGADO', { codigo: 1025 })]) : EMPTY_NOTIFICATIONS),
        [`GET /documentos/${DOC_ID}`]: () => json(documentItem()),
        'GET /prestamos/mis-prestamos': () => json(myLoans(granted ? [otorgado] : [])),
        'POST /prestamos': () => {
          granted = true;
          return json(createLoanResponse(otorgado), 201);
        },
      });

      renderAt(`/documentos/${DOC_ID}`);
      const [requestButton] = await screen.findAllByRole('button', { name: 'Solicitar Préstamo Digital (7 días)' });
      await user.click(requestButton!);

      const dialog = screen.getByRole('dialog', { name: 'Confirmar préstamo digital' });
      expect(dialog).toHaveTextContent('Diseño bioclimático en zonas áridas');
      expect(dialog).toHaveTextContent('7 días corridos');
      expect(dialog).toHaveTextContent('token de acceso temporal (DRM)');
      expect(dialog).toHaveTextContent('Ana Pérez · Préstamo #…');

      await user.click(within(dialog).getByRole('button', { name: 'Confirmar préstamo (7 días)' }));

      const grantedDialog = await screen.findByRole('dialog', { name: 'Préstamo #1025 otorgado' });
      expect(bodyOf(fetchMock, 'POST', '/prestamos')).toEqual({ documentoId: DOC_ID });
      expect(grantedDialog).toHaveTextContent('Ana Pérez · Préstamo #1025');
      expect(getDrmToken('loan-1025')).toBe('drm-1025');
      expect(within(grantedDialog).getByRole('link', { name: 'Abrir en Visor Protegido' })).toHaveAttribute(
        'href',
        '/visor/loan-1025',
      );
      expect(within(grantedDialog).getByRole('link', { name: 'Ir a Mis préstamos' })).toHaveAttribute('href', '/mis-prestamos');

      // Detrás del modal, la ficha ya reconoce el préstamo activo y la campana recibe PRESTAMO_OTORGADO
      await waitFor(() =>
        expect(
          screen.getAllByRole('link', { name: 'Ya tenés un préstamo activo · Abrir en Visor Protegido', hidden: true })[0],
        ).toHaveAttribute('href', '/visor/loan-1025'),
      );
      expect(await screen.findByRole('button', { name: 'Notificaciones (1 sin leer)' })).toBeInTheDocument();
    });

    it('explica el 409 por préstamo activo duplicado y lleva a Mis préstamos', async () => {
      const user = userEvent.setup();
      startSession(profile());
      mockBackend({
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': () => json(EMPTY_NOTIFICATIONS),
        [`GET /documentos/${DOC_ID}`]: () => json(documentItem()),
        'GET /prestamos/mis-prestamos': () => json(myLoans([])),
        'POST /prestamos': () =>
          json(
            {
              statusCode: 409,
              message: 'Ya posees un préstamo ACTIVO vigente (#1024) sobre el documento "Diseño bioclimático en zonas áridas".',
            },
            409,
          ),
      });

      renderAt(`/documentos/${DOC_ID}`);
      const [requestButton] = await screen.findAllByRole('button', { name: 'Solicitar Préstamo Digital (7 días)' });
      await user.click(requestButton!);
      await user.click(screen.getByRole('button', { name: 'Confirmar préstamo (7 días)' }));

      const dialog = screen.getByRole('dialog', { name: 'Confirmar préstamo digital' });
      expect(await within(dialog).findByText('Ya tenés un préstamo activo de esta obra')).toBeInTheDocument();
      expect(dialog).toHaveTextContent('Ya posees un préstamo ACTIVO vigente (#1024)');
      expect(within(dialog).getByRole('link', { name: 'Ir a Mis préstamos' })).toHaveAttribute('href', '/mis-prestamos');
      expect(within(dialog).queryByRole('button', { name: 'Confirmar préstamo (7 días)' })).not.toBeInTheDocument();
    });

    it('ante el 409 por material suspendido actualiza la ficha y deshabilita la solicitud', async () => {
      const user = userEvent.setup();
      startSession(profile());
      let suspended = false;
      mockBackend({
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': () => json(EMPTY_NOTIFICATIONS),
        [`GET /documentos/${DOC_ID}`]: () =>
          json(suspended ? documentItem({ disponible: false, estaDisponible: false }) : documentItem()),
        'GET /prestamos/mis-prestamos': () => json(myLoans([])),
        'POST /prestamos': () => {
          suspended = true;
          return json(
            {
              statusCode: 409,
              message:
                'El documento "Diseño bioclimático en zonas áridas" no se encuentra disponible para préstamo por disposición de Biblioteca FAUD-UNSJ (solicitud en estado RECHAZADO).',
            },
            409,
          );
        },
      });

      renderAt(`/documentos/${DOC_ID}`);
      const [requestButton] = await screen.findAllByRole('button', { name: 'Solicitar Préstamo Digital (7 días)' });
      await user.click(requestButton!);
      await user.click(screen.getByRole('button', { name: 'Confirmar préstamo (7 días)' }));

      const dialog = screen.getByRole('dialog', { name: 'Confirmar préstamo digital' });
      expect(await within(dialog).findByText('Material no disponible')).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Confirmar préstamo (7 días)' })).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const disabled = await screen.findAllByRole('button', { name: 'Material temporalmente no disponible por Biblioteca' });
      disabled.forEach((button) => expect(button).toBeDisabled());
    });
  });

  // ==========================================================================
  // Mis préstamos (/mis-prestamos — Figma pág. 13)
  // ==========================================================================
  describe('Mis préstamos (/mis-prestamos)', () => {
    const LOANS = [
      loan({ codigo: 1024, venceEn: 5 * DAY + 2 * HOUR + SECONDS_30, titulo: 'Accesibilidad urbana en San Juan' }),
      loan({ codigo: 1019, venceEn: 5 * HOUR + SECONDS_30, titulo: 'Vivienda social en Cuyo' }),
      loan({ codigo: 1003, estado: 'VENCIDO', venceEn: -2 * DAY, titulo: 'Patrimonio arquitectónico sanjuanino' }),
      loan({ codigo: 1001, estado: 'REVOCADO', venceEn: 3 * DAY, titulo: 'Materiales y construcción' }),
      loan({ codigo: 998, estado: 'CERRADO', venceEn: -9 * DAY, titulo: 'Historia de la arquitectura argentina' }),
    ];

    it('muestra pestañas con contadores, cuenta regresiva, alerta 24h y sincroniza los tokens DRM', async () => {
      const user = userEvent.setup();
      startSession(profile());
      setDrmToken('loan-1003', 'drm-viejo'); // préstamo ya vencido: su token debe descartarse
      const fetchMock = mockBackend({
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': () => json(EMPTY_NOTIFICATIONS),
        'GET /prestamos/mis-prestamos': () => json(myLoans(LOANS)),
      });

      renderAt('/mis-prestamos');

      expect(await screen.findByRole('tab', { name: 'Activos (2)' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Por vencer 24h (1)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Vencidos / Historial (3)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Todos (5)' })).toBeInTheDocument();
      expect(requestedUrls(fetchMock, '/prestamos/mis-prestamos')[0]!.search).toBe('');

      expect(screen.getAllByText('Activo · 5 d 2 h').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Por vencer · 5 h').length).toBeGreaterThan(0);
      expect(screen.queryByText('Patrimonio arquitectónico sanjuanino')).not.toBeInTheDocument();
      expect(screen.getByText('Tenés 1 préstamo que vence en las próximas 24 horas')).toBeInTheDocument();

      const viewerLinks = screen.getAllByRole('link', { name: 'Abrir en Visor Protegido el préstamo #1024' });
      viewerLinks.forEach((link) => expect(link).toHaveAttribute('href', '/visor/loan-1024'));
      expect(screen.getAllByRole('button', { name: 'Devolver el préstamo #1019' }).length).toBeGreaterThan(0);

      expect(getDrmToken('loan-1024')).toBe('drm-1024');
      expect(getDrmToken('loan-1019')).toBe('drm-1019');
      expect(getDrmToken('loan-1003')).toBeNull();

      await user.click(screen.getByRole('tab', { name: 'Por vencer 24h (1)' }));
      expect(window.location.search).toBe('?tab=por-vencer');
      expect(screen.getAllByText('Vivienda social en Cuyo').length).toBeGreaterThan(0);
      expect(screen.queryByText('Accesibilidad urbana en San Juan')).not.toBeInTheDocument();
    });

    it('hidrata la pestaña de historial desde la URL con acciones según el estado', async () => {
      startSession(profile());
      mockBackend({
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': () => json(EMPTY_NOTIFICATIONS),
        'GET /prestamos/mis-prestamos': () => json(myLoans(LOANS)),
      });

      renderAt('/mis-prestamos?tab=historial');

      expect(await screen.findByRole('tab', { name: 'Vencidos / Historial (3)' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByText('Patrimonio arquitectónico sanjuanino').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Revocado por Biblioteca').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Devuelto').length).toBeGreaterThan(0);
      expect(screen.queryByText('Accesibilidad urbana en San Juan')).not.toBeInTheDocument();

      expect(screen.getAllByRole('button', { name: 'Archivar el préstamo #1003' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Archivar el préstamo #1001' }).length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /el préstamo #998/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Abrir en Visor Protegido/ })).not.toBeInTheDocument();
    });

    it('devuelve un préstamo activo con PATCH /prestamos/:id/cerrar y descarta su token DRM', async () => {
      const user = userEvent.setup();
      startSession(profile());
      const activo = loan({ codigo: 1024, titulo: 'Accesibilidad urbana en San Juan' });
      let closed = false;
      const fetchMock = mockBackend({
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': () => json(EMPTY_NOTIFICATIONS),
        'GET /prestamos/mis-prestamos': () =>
          json(myLoans([closed ? { ...activo, estado: 'CERRADO', vigente: false, tokenAcceso: null, porVencer24h: false } : activo])),
        'PATCH /prestamos/loan-1024/cerrar': () => {
          closed = true;
          return json({
            message: 'El préstamo #1024 ha pasado al estado CERRADO y su ciclo ha finalizado.',
            estadoAnterior: 'ACTIVO',
            estadoActual: 'CERRADO',
            prestamo: { ...activo, estado: 'CERRADO' },
          });
        },
      });

      renderAt('/mis-prestamos');
      const [returnButton] = await screen.findAllByRole('button', { name: 'Devolver el préstamo #1024' });
      expect(getDrmToken('loan-1024')).toBe('drm-1024');
      await user.click(returnButton!);

      const dialog = screen.getByRole('dialog', { name: '¿Devolver el préstamo #1024?' });
      expect(dialog).toHaveTextContent('perderás el acceso al Visor Protegido de inmediato');
      await user.click(within(dialog).getByRole('button', { name: 'Devolver préstamo' }));

      expect(await screen.findByText('Préstamo #1024 devuelto')).toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true);
      expect(getDrmToken('loan-1024')).toBeNull();
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Activos (0)' })).toBeInTheDocument());
      expect(screen.getByText('No tenés préstamos activos.')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Vencidos / Historial (1)' })).toBeInTheDocument();
    });

    it('exige sesión iniciada para ver Mis préstamos', async () => {
      mockBackend({ 'GET /departamentos': () => json([]) });
      renderAt('/mis-prestamos');
      await waitFor(() => expect(window.location.pathname).toBe('/login'));
      expect(window.location.search).toBe('?redirect=%2Fmis-prestamos');
    });
  });

  // ==========================================================================
  // Campana y bandeja de notificaciones (RF06)
  // ==========================================================================
  describe('Notificaciones (NotificationBell y /notificaciones)', () => {
    const NOTIFS = [
      notification('n-1', 'PROXIMO_VENCIMIENTO_24H', { codigo: 1019, horasAtras: 1 }),
      notification('n-2', 'PRESTAMO_OTORGADO', { codigo: 1024, horasAtras: 30 }),
      notification('n-3', 'PRESTAMO_OTORGADO', { codigo: 1003, horasAtras: 200, leida: true }),
    ];

    const catalogRoutes = {
      'GET /departamentos/metricas': () => json(METRICAS),
      'GET /documentos': () => json({ meta: { total: 1, page: 1, limit: 10, totalPages: 1 }, items: [documentItem()] }),
    };

    it('la campana muestra no leídas, marca todas como leídas y abre el aviso relacionado', async () => {
      const user = userEvent.setup();
      startSession(profile());
      let state = NOTIFS;
      const fetchMock = mockBackend({
        ...catalogRoutes,
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': () => json(notificationsList(state, state)),
        'PATCH /notificaciones/marcar-todas-leidas': () => {
          state = state.map((n) => ({ ...n, leida: true }));
          return json({ message: 'Se marcaron 2 notificación(es) como leídas.', actualizadas: 2 });
        },
        'PATCH /notificaciones/n-1/leida': () => json({ message: 'ok', notificacion: { ...NOTIFS[0]!, leida: true } }),
        'GET /prestamos/mis-prestamos': () => json(myLoans([])),
      });

      renderAt('/catalogo');
      const bell = await screen.findByRole('button', { name: 'Notificaciones (2 sin leer)' });
      expect(requestedUrls(fetchMock, '/notificaciones')[0]!.searchParams.get('limit')).toBe('5');

      await user.click(bell);
      const panel = screen.getByRole('region', { name: 'Últimas notificaciones' });
      expect(within(panel).getByText('Vence en 24 horas')).toBeInTheDocument();
      expect(within(panel).getAllByText('Préstamo otorgado')).toHaveLength(2);
      expect(within(panel).getAllByRole('img', { name: 'No leída' })).toHaveLength(2);
      expect(within(panel).getByRole('link', { name: 'Ver todas las notificaciones' })).toHaveAttribute('href', '/notificaciones');

      await user.click(within(panel).getByRole('button', { name: 'Marcar todas como leídas' }));
      expect(await screen.findByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
      expect(within(panel).queryByRole('img', { name: 'No leída' })).not.toBeInTheDocument();

      // Un aviso de vencimiento lleva a la pestaña "Por vencer 24h"
      state = NOTIFS;
      await user.click(within(panel).getByText('Vence en 24 horas'));
      await waitFor(() => expect(window.location.pathname).toBe('/mis-prestamos'));
      expect(window.location.search).toBe('?tab=por-vencer');
    });

    it('los visitantes no ven la campana ni consultan notificaciones', async () => {
      const fetchMock = mockBackend(catalogRoutes);
      renderAt('/catalogo');
      await screen.findByRole('heading', { name: 'Diseño bioclimático en zonas áridas' });
      expect(screen.queryByRole('button', { name: /Notificaciones/ })).not.toBeInTheDocument();
      expect(requestedUrls(fetchMock, '/notificaciones')).toHaveLength(0);
    });

    it('la bandeja filtra por lectura y tipo en la URL y marca un aviso como leído', async () => {
      const user = userEvent.setup();
      startSession(profile());
      const fetchMock = mockBackend({
        'GET /auth/profile': () => json(profile()),
        'GET /notificaciones': (_init, url) => {
          const leida = url.searchParams.get('leida');
          const tipo = url.searchParams.get('tipo');
          const items = NOTIFS.filter(
            (n) => (leida === null || String(n.leida) === leida) && (tipo === null || n.tipo === tipo),
          );
          return json(notificationsList(items, NOTIFS));
        },
        'PATCH /notificaciones/n-2/leida': () => json({ message: 'ok', notificacion: { ...NOTIFS[1]!, leida: true } }),
      });

      renderAt('/notificaciones');

      expect(await screen.findByRole('heading', { name: 'Notificaciones', level: 1 })).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: 'Todas (3)' })).toHaveAttribute('aria-selected', 'true');
      expect(Object.fromEntries(inboxRequests(fetchMock)[0]!.searchParams)).toEqual({ page: '1', limit: '20' });
      const list = screen.getByRole('list', { name: 'Notificaciones' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
      expect(within(list).getByRole('listitem', { name: 'Vence en 24 horas · #1019 · No leída' })).toHaveTextContent(
        'vencerá en aproximadamente 5 hora(s)',
      );

      await user.click(screen.getByRole('tab', { name: 'No leídas (2)' }));
      expect(window.location.search).toBe('?estado=no-leidas');
      await waitFor(() => expect(inboxRequests(fetchMock).at(-1)!.searchParams.get('leida')).toBe('false'));
      await waitFor(() => expect(within(screen.getByRole('list', { name: 'Notificaciones' })).getAllByRole('listitem')).toHaveLength(2));

      await user.selectOptions(screen.getByLabelText('Tipo de aviso'), 'PRESTAMO_OTORGADO');
      expect(window.location.search).toBe('?estado=no-leidas&tipo=PRESTAMO_OTORGADO');
      await waitFor(() => expect(within(screen.getByRole('list', { name: 'Notificaciones' })).getAllByRole('listitem')).toHaveLength(1));
      expect(screen.getByRole('option', { name: 'Préstamo otorgado (2)' })).toBeInTheDocument();

      const requestsBefore = inboxRequests(fetchMock).length;
      await user.click(screen.getByRole('button', { name: 'Marcar como leída' }));
      await waitFor(() => expect(bodyOf(fetchMock, 'PATCH', '/notificaciones/n-2/leida')).toEqual({ leida: true }));
      await waitFor(() => expect(inboxRequests(fetchMock).length).toBeGreaterThan(requestsBefore));
      expect(screen.getByRole('link', { name: 'Ver en Mis préstamos' })).toHaveAttribute('href', '/mis-prestamos?tab=activos');
    });
  });

  // ==========================================================================
  // Utilidades
  // ==========================================================================
  describe('Utilidades de vigencia y filtros', () => {
    it('calcula y formatea el tiempo restante del préstamo', () => {
      const now = Date.parse('2026-10-22T12:00:00.000Z');
      const at = (ms: number) => new Date(now + ms).toISOString();
      expect(formatRemaining(getRemainingTime(at(5 * DAY + 3 * HOUR), now))).toBe('5 d 3 h');
      expect(formatRemaining(getRemainingTime(at(7 * DAY), now))).toBe('7 d');
      expect(formatRemaining(getRemainingTime(at(7 * HOUR + 12 * 60_000), now))).toBe('7 h 12 min');
      expect(formatRemaining(getRemainingTime(at(8 * 60_000), now))).toBe('8 min');
      expect(formatRemaining(getRemainingTime(at(20_000), now))).toBe('menos de 1 min');
      expect(getRemainingTime(at(-1), now)).toMatchObject({ expired: true, within24h: false });
      expect(getRemainingTime(at(DAY), now).within24h).toBe(true);
      expect(getRemainingTime(at(DAY + 1), now).within24h).toBe(false);
    });

    it('trata como vencido un ACTIVO cuyo plazo ya pasó y define la acción de cierre', () => {
      const activo = loan({ codigo: 1, venceEn: 2 * DAY });
      expect(getLoanStatus(activo)).toMatchObject({ readable: true, close: 'devolver', variant: 'success' });
      expect(getLoanStatus(activo, Date.now() + 3 * DAY)).toMatchObject({ readable: false, close: null, label: 'Vencido' });
      expect(getLoanStatus(loan({ codigo: 2, venceEn: 2 * HOUR }))).toMatchObject({ porVencer: true, variant: 'warning' });
      expect(getLoanStatus(loan({ codigo: 3, estado: 'REVOCADO' }))).toMatchObject({ readable: false, close: 'archivar' });
      expect(getLoanStatus(loan({ codigo: 4, estado: 'CERRADO' })).close).toBeNull();
      expect(parseMyLoansTab('historial')).toBe('historial');
      expect(parseMyLoansTab('desconocida')).toBe('activos');
    });

    it('traduce los filtros de la bandeja entre la URL y la API', () => {
      expect(parseNotificationsParams(new URLSearchParams('estado=leidas&tipo=PRESTAMO_VENCIDO&page=3'))).toEqual({
        estado: 'leidas',
        tipo: 'PRESTAMO_VENCIDO',
        page: 3,
      });
      expect(parseNotificationsParams(new URLSearchParams('estado=x&tipo=OTRO&page=-2'))).toEqual({
        estado: 'todas',
        tipo: undefined,
        page: 1,
      });
      expect(toNotificationsApiParams({ estado: 'no-leidas', page: 2 })).toEqual({
        leida: false,
        tipo: undefined,
        page: 2,
        limit: 20,
      });
      expect(toNotificationsApiParams({ estado: 'todas', page: 1 }).leida).toBeUndefined();
    });
  });
});
