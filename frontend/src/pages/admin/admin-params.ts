import {
  ESTADOS_PRESTAMO,
  ROLES_USUARIO,
  TIPOS_NOTIFICACION,
  type AdminLoansFilterParams,
  type AdminNotificationsFilterParams,
  type CatalogFilterParams,
  type EstadoPrestamo,
  type EstadoValidacionUsuario,
  type RolUsuario,
  type TipoNotificacion,
  type UsersFilterParams,
} from '../../types/openapi.types';

/**
 * Filtros del panel de Biblioteca sincronizados con la URL (Fase 5).
 * Cada vista traduce su query string a los parámetros del endpoint admin correspondiente.
 */
const pageParam = (params: URLSearchParams) => {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page > 1 ? page : 1;
};

const textParam = (params: URLSearchParams, key: string) => params.get(key)?.trim() || undefined;

function writeParams(entries: Record<string, string | number | boolean | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === '' || value === false) continue;
    if (key === 'page' && value === 1) continue;
    params.set(key, value === true ? '1' : String(value));
  }
  return params;
}

// ============================================================================
// /admin/usuarios — GET /api/v1/usuarios
// ============================================================================

export type UsersTab = 'todos' | 'pendientes' | 'aprobados' | 'rechazados';

export const USERS_TAB_ESTADO: Record<UsersTab, EstadoValidacionUsuario | undefined> = {
  todos: undefined,
  pendientes: 'PENDIENTE',
  aprobados: 'APROBADO',
  rechazados: 'RECHAZADO',
};

export interface UsersQuery {
  tab: UsersTab;
  departamentoId?: string;
  rol?: RolUsuario;
  q?: string;
}

/** La pestaña por defecto es "Pendientes" (Figma pág. 8) */
export function parseUsersParams(params: URLSearchParams): UsersQuery {
  const tab = params.get('estado');
  const rol = params.get('rol');
  return {
    tab: tab && tab in USERS_TAB_ESTADO ? (tab as UsersTab) : 'pendientes',
    departamentoId: textParam(params, 'departamento'),
    rol: ROLES_USUARIO.includes(rol as RolUsuario) ? (rol as RolUsuario) : undefined,
    q: textParam(params, 'q'),
  };
}

export const writeUsersParams = (query: UsersQuery) =>
  writeParams({
    estado: query.tab === 'pendientes' ? undefined : query.tab,
    departamento: query.departamentoId,
    rol: query.rol,
    q: query.q,
  });

export const toUsersApiParams = (query: UsersQuery): UsersFilterParams => ({
  estado: USERS_TAB_ESTADO[query.tab],
  departamentoId: query.departamentoId,
  rol: query.rol,
  q: query.q,
});

// ============================================================================
// /admin/catalogo — GET /api/v1/documentos (incluye material suspendido)
// ============================================================================

export const ADMIN_CATALOG_PAGE_SIZE = 10;

export type AvailabilityFilter = 'todos' | 'disponibles' | 'suspendidos';

export interface AdminCatalogQuery {
  disponibilidad: AvailabilityFilter;
  q?: string;
  page: number;
}

export function parseAdminCatalogParams(params: URLSearchParams): AdminCatalogQuery {
  const disponibilidad = params.get('disponibilidad');
  return {
    disponibilidad: disponibilidad === 'disponibles' || disponibilidad === 'suspendidos' ? disponibilidad : 'todos',
    q: textParam(params, 'q'),
    page: pageParam(params),
  };
}

export const writeAdminCatalogParams = (query: AdminCatalogQuery) =>
  writeParams({
    disponibilidad: query.disponibilidad === 'todos' ? undefined : query.disponibilidad,
    q: query.q,
    page: query.page,
  });

export const toAdminCatalogApiParams = (query: AdminCatalogQuery): CatalogFilterParams => ({
  q: query.q,
  disponible: query.disponibilidad === 'todos' ? undefined : query.disponibilidad === 'disponibles',
  page: query.page,
  limit: ADMIN_CATALOG_PAGE_SIZE,
});

// ============================================================================
// /admin/prestamos — GET /api/v1/prestamos · GET /api/v1/notificaciones/admin
// ============================================================================

export const ADMIN_LOANS_PAGE_SIZE = 15;
export const ADMIN_AUDIT_PAGE_SIZE = 20;

export type LoansView = 'prestamos' | 'auditoria';

export interface AdminLoansQuery {
  vista: LoansView;
  estado?: EstadoPrestamo;
  porVencer24h: boolean;
  departamentoId?: string;
  q?: string;
  /** Auditoría de notificaciones */
  tipo?: TipoNotificacion;
  leida?: boolean;
  page: number;
}

export function parseAdminLoansParams(params: URLSearchParams): AdminLoansQuery {
  const estado = params.get('estado');
  const tipo = params.get('tipo');
  const leida = params.get('leida');
  return {
    vista: params.get('vista') === 'auditoria' ? 'auditoria' : 'prestamos',
    estado: ESTADOS_PRESTAMO.includes(estado as EstadoPrestamo) ? (estado as EstadoPrestamo) : undefined,
    porVencer24h: params.get('porVencer') === '1',
    departamentoId: textParam(params, 'departamento'),
    q: textParam(params, 'q'),
    tipo: TIPOS_NOTIFICACION.includes(tipo as TipoNotificacion) ? (tipo as TipoNotificacion) : undefined,
    leida: leida === 'si' ? true : leida === 'no' ? false : undefined,
    page: pageParam(params),
  };
}

export const writeAdminLoansParams = (query: AdminLoansQuery) =>
  query.vista === 'auditoria'
    ? writeParams({
        vista: 'auditoria',
        tipo: query.tipo,
        leida: query.leida === undefined ? undefined : query.leida ? 'si' : 'no',
        page: query.page,
      })
    : writeParams({
        estado: query.estado,
        porVencer: query.porVencer24h,
        departamento: query.departamentoId,
        q: query.q,
        page: query.page,
      });

export const toAdminLoansApiParams = (query: AdminLoansQuery): AdminLoansFilterParams => ({
  estado: query.estado,
  porVencer24h: query.porVencer24h || undefined,
  departamentoId: query.departamentoId,
  q: query.q,
  page: query.page,
  limit: ADMIN_LOANS_PAGE_SIZE,
});

export const toAdminAuditApiParams = (query: AdminLoansQuery): AdminNotificationsFilterParams => ({
  tipo: query.tipo,
  leida: query.leida,
  page: query.page,
  limit: ADMIN_AUDIT_PAGE_SIZE,
});
