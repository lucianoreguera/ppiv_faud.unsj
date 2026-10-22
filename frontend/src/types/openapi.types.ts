/**
 * Contratos TypeScript espejados 1:1 del contrato congelado OpenAPI 3.0 (`docs/specs/openapi.json` v1.0.0)
 * Sistema de Préstamo Digital Interdepartamental — Repositorio Académico FAUD-UNSJ
 */

// ============================================================================
// 1. ENUMERADOS DE DOMINIO (Prisma / OpenAPI 3.0)
// ============================================================================

export type RolUsuario = 'USUARIO' | 'ADMINISTRADOR';

export type EstadoValidacionUsuario = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export type TipoDocumento = 'TESIS' | 'MONOGRAFIA' | 'INVESTIGACION' | 'OTROS';

export type EstadoPrestamo =
  | 'SOLICITADO'
  | 'ACTIVO'
  | 'RECHAZADO'
  | 'VENCIDO'
  | 'REVOCADO'
  | 'CERRADO';

export type TipoNotificacion =
  | 'CUENTA_APROBADA'
  | 'PRESTAMO_OTORGADO'
  | 'PROXIMO_VENCIMIENTO_24H'
  | 'PRESTAMO_VENCIDO'
  | 'PRESTAMO_REVOCADO';

export type CarreraFaud = 'Arquitectura' | 'Diseño' | 'Urbanismo';

export const ROLES_USUARIO: readonly RolUsuario[] = ['USUARIO', 'ADMINISTRADOR'] as const;

export const ESTADOS_VALIDACION_USUARIO: readonly EstadoValidacionUsuario[] = [
  'PENDIENTE',
  'APROBADO',
  'RECHAZADO',
] as const;

export const TIPOS_DOCUMENTO: readonly TipoDocumento[] = [
  'TESIS',
  'MONOGRAFIA',
  'INVESTIGACION',
  'OTROS',
] as const;

export const ESTADOS_PRESTAMO: readonly EstadoPrestamo[] = [
  'SOLICITADO',
  'ACTIVO',
  'RECHAZADO',
  'VENCIDO',
  'REVOCADO',
  'CERRADO',
] as const;

export const TIPOS_NOTIFICACION: readonly TipoNotificacion[] = [
  'CUENTA_APROBADA',
  'PRESTAMO_OTORGADO',
  'PROXIMO_VENCIMIENTO_24H',
  'PRESTAMO_VENCIDO',
  'PRESTAMO_REVOCADO',
] as const;

export const CARRERAS_FAUD: readonly CarreraFaud[] = [
  'Arquitectura',
  'Diseño',
  'Urbanismo',
] as const;

// ============================================================================
// 2. HEALTHCHECK (/api/v1/health)
// ============================================================================

export interface DatabaseHealthDto {
  status: 'up' | 'down';
  latencyMs?: number;
}

export interface HealthResponseDto {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  database: DatabaseHealthDto;
}

// ============================================================================
// 3. DEPARTAMENTOS DE SAN JUAN (/api/v1/departamentos)
// ============================================================================

export interface DepartmentResponseDto {
  id: string;
  nombre: string;
  esCapital: boolean;
  totalUsuarios: number;
  usuariosAprobados: number;
  usuariosPendientes: number;
  totalDocumentos: number;
}

export interface TerritorialMetricsResponseDto {
  totalDepartamentos: number;
  totalUsuariosProvincia: number;
  usuariosCapital: number;
  usuariosDepartamentosAlejados: number;
  totalDocumentosCatalogados: number;
  departamentos: DepartmentResponseDto[];
}

export interface UserDepartmentSummaryDto {
  id: string;
  nombre: string;
  esCapital: boolean;
}

export type DocumentDepartmentSummaryDto = UserDepartmentSummaryDto;
export type LoanDepartmentSummaryDto = UserDepartmentSummaryDto;

// ============================================================================
// 4. AUTENTICACIÓN Y PERFIL (/api/v1/auth/* — RF05)
// ============================================================================

export interface RegisterDto {
  nombre: string;
  email: string;
  password: string;
  departamentoId: string;
}

export interface UserProfileResponseDto {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  estadoValidacion: EstadoValidacionUsuario;
  departamentoId: string;
  departamento: UserDepartmentSummaryDto;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterResponseDto {
  message: string;
  usuario: UserProfileResponseDto;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  usuario: UserProfileResponseDto;
}

// ============================================================================
// 5. GESTIÓN Y VALIDACIÓN DE USUARIOS — ADMIN BIBLIOTECA (/api/v1/usuarios — RF05)
// ============================================================================

export interface UserStatusCountersDto {
  todos: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
}

export interface UserAdminItemDto extends UserProfileResponseDto {
  totalPrestamos: number;
}

export interface UsersListResponseDto {
  contadores: UserStatusCountersDto;
  total: number;
  items: UserAdminItemDto[];
}

export interface UpdateUserStatusDto {
  estado: EstadoValidacionUsuario;
  motivo?: string;
}

export interface UpdateUserStatusResponseDto {
  message: string;
  estadoAnterior: EstadoValidacionUsuario;
  estadoActual: EstadoValidacionUsuario;
  motivo?: string;
  usuario: UserAdminItemDto;
}

export interface UsersFilterParams {
  estado?: EstadoValidacionUsuario;
  departamentoId?: string;
  rol?: RolUsuario;
  q?: string;
}

// ============================================================================
// 6. CATÁLOGO ACADÉMICO Y DOCUMENTOS PDF (/api/v1/documentos — RF01, RF02)
// ============================================================================

export interface CreateDocumentMultipartDto {
  titulo: string;
  autor: string;
  director?: string;
  carrera: string;
  tipo: TipoDocumento;
  anio: number;
  resumen: string;
  palabrasClave: string[] | string;
  departamentoOrigenId?: string;
  disponible?: boolean;
  archivo: File;
}

export interface DocumentItemDto {
  id: string;
  titulo: string;
  autor: string;
  director: string | null;
  carrera: string;
  tipo: TipoDocumento;
  anio: number;
  resumen: string;
  palabrasClave: string[];
  disponible: boolean;
  estaDisponible: boolean;
  departamentoOrigenId: string | null;
  departamentoOrigen: DocumentDepartmentSummaryDto | null;
  prestamosActivosCount: number;
  totalPrestamosHistoricos: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMutationResponseDto {
  message: string;
  documento: DocumentItemDto;
}

export interface PaginationMetaDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentsListResponseDto {
  meta: PaginationMetaDto;
  items: DocumentItemDto[];
}

export interface UpdateDocumentDto {
  titulo?: string;
  autor?: string;
  director?: string;
  carrera?: string;
  tipo?: TipoDocumento;
  anio?: number;
  resumen?: string;
  palabrasClave?: string[] | string;
  departamentoOrigenId?: string;
  disponible?: boolean;
}

export interface DeleteDocumentResponseDto {
  message: string;
  id: string;
}

export interface CatalogFilterParams {
  q?: string;
  departamentoId?: string;
  carrera?: string;
  tipo?: TipoDocumento;
  anio?: number;
  anioDesde?: number;
  anioHasta?: number;
  disponible?: boolean;
  page?: number;
  limit?: number;
}

// ============================================================================
// 7. PRÉSTAMOS DIGITALES Y DRM TEMPORAL 7 DÍAS (/api/v1/prestamos — RF03, RF04, RNF02)
// ============================================================================

export interface CreateLoanDto {
  documentoId: string;
}

export interface LoanUserSummaryDto {
  id: string;
  nombre: string;
  email: string;
  departamento: LoanDepartmentSummaryDto;
}

export interface LoanDocumentSummaryDto {
  id: string;
  titulo: string;
  autor: string;
  director: string | null;
  carrera: string;
  tipo: TipoDocumento;
  anio: number;
  disponible: boolean;
  departamentoOrigen: LoanDepartmentSummaryDto | null;
}

export interface LoanItemDto {
  id: string;
  codigoReferencia: number;
  codigoFormateado: string;
  estado: EstadoPrestamo;
  fechaInicio: string;
  fechaVencimiento: string;
  vigente: boolean;
  diasRestantes: number;
  horasRestantes: number;
  porVencer24h: boolean;
  marcaAgua: string;
  visorUrl: string;
  contenidoUrl: string;
  tokenAcceso: string | null;
  usuario: LoanUserSummaryDto;
  documento: LoanDocumentSummaryDto;
  createdAt: string;
  updatedAt: string;
}

export interface LoanDrmRestrictionsDto {
  permitirDescarga: boolean;
  permitirImpresion: boolean;
  permitirCopia: boolean;
  duracionMaximaDias: number;
  marcaAgua: string;
}

export interface CreateLoanResponseDto {
  message: string;
  prestamo: LoanItemDto;
  tokenAcceso: string;
  tokenType: string;
  expiresInDays: number;
  marcaAgua: string;
  drm: LoanDrmRestrictionsDto;
  visorUrl: string;
  contenidoUrl: string;
}

export interface MyLoansCountersDto {
  todos: number;
  activos: number;
  porVencer24h: number;
  vencidos: number;
  revocados: number;
  cerrados: number;
}

export interface MyLoansListResponseDto {
  contadores: MyLoansCountersDto;
  total: number;
  items: LoanItemDto[];
}

export interface AdminLoansMetricsDto {
  activos: number;
  porVencer24h: number;
  vencidosHoy: number;
  vencidosTotal: number;
  revocadosTotal: number;
  rechazadosTotal: number;
  cerradosTotal: number;
  totalHistorico: number;
}

export type AdminLoansPaginationMetaDto = PaginationMetaDto;

export interface AdminLoansListResponseDto {
  metricas: AdminLoansMetricsDto;
  meta: AdminLoansPaginationMetaDto;
  items: LoanItemDto[];
}

export interface RevokeLoanDto {
  motivo?: string;
}

export interface LoanStateTransitionResponseDto {
  message: string;
  estadoAnterior: EstadoPrestamo;
  estadoActual: EstadoPrestamo;
  motivo?: string;
  prestamo: LoanItemDto;
}

export interface LoanViewerMetadataResponseDto {
  prestamoId: string;
  codigoReferencia: number;
  codigoFormateado: string;
  estado: EstadoPrestamo;
  fechaInicio: string;
  fechaVencimiento: string;
  diasRestantes: number;
  horasRestantes: number;
  segundosRestantes: number;
  porVencer24h: boolean;
  marcaAgua: string;
  drm: LoanDrmRestrictionsDto;
  usuario: LoanUserSummaryDto;
  documento: LoanDocumentSummaryDto;
  streamDocumentoUrl: string;
  streamPrestamoUrl: string;
}

export interface DrmHeadersMetadata {
  loanId?: string;
  loanCode?: string;
  documentId?: string;
  watermark?: string;
  expiresAt?: string;
  remainingDays?: number;
  remainingHours?: number;
  porVencer24h?: boolean;
  allowDownload?: boolean;
  allowPrint?: boolean;
  allowCopy?: boolean;
}

export interface MyLoansFilterParams {
  estado?: EstadoPrestamo;
  porVencer24h?: boolean;
  q?: string;
}

export interface AdminLoansFilterParams {
  estado?: EstadoPrestamo;
  departamentoId?: string;
  usuarioId?: string;
  documentoId?: string;
  porVencer24h?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// 8. NOTIFICACIONES Y CONTROL CONTINUO DE VIGENCIA (/api/v1/notificaciones — RF06)
// ============================================================================

export interface NotificationCountersDto {
  total: number;
  noLeidas: number;
  leidas: number;
  porTipo: Record<TipoNotificacion, number>;
}

export type NotificationsPaginationMetaDto = PaginationMetaDto;

export interface NotificationLoanUserSummaryDto {
  id: string;
  nombre: string;
  email: string;
  departamentoNombre: string;
}

export interface NotificationLoanDocumentSummaryDto {
  id: string;
  titulo: string;
  autor: string;
  carrera: string;
  tipo: TipoDocumento;
  anio: number;
}

export interface NotificationLoanSummaryDto {
  id: string;
  codigoReferencia: number;
  codigoFormateado: string;
  estado: EstadoPrestamo;
  fechaInicio: string;
  fechaVencimiento: string;
  usuario: NotificationLoanUserSummaryDto;
  documento: NotificationLoanDocumentSummaryDto;
}

export interface NotificationItemDto {
  id: string;
  prestamoId: string;
  tipo: TipoNotificacion;
  mensaje: string | null;
  fechaEnvio: string;
  leida: boolean;
  prestamo: NotificationLoanSummaryDto;
}

export interface NotificationsListResponseDto {
  contadores: NotificationCountersDto;
  meta: NotificationsPaginationMetaDto;
  items: NotificationItemDto[];
}

export interface MarkNotificationReadDto {
  leida?: boolean;
}

export interface MarkNotificationReadResponseDto {
  message: string;
  notificacion: NotificationItemDto;
}

export interface MarkAllNotificationsReadResponseDto {
  message: string;
  actualizadas: number;
}

export interface CronProcessedLoanItemDto {
  prestamoId: string;
  codigoFormateado: string;
  usuarioEmail: string;
  usuarioNombre: string;
  departamentoNombre: string;
  documentoTitulo: string;
  fechaVencimiento: string;
  tipoNotificacion: TipoNotificacion;
  notificacionId: string;
  correoEnviado: boolean;
}

export interface CronExecutionSummaryResponseDto {
  message: string;
  timestamp: string;
  prestamosVencidosProcesados: number;
  alertas24hGeneradas: number;
  correosEnviados: number;
  detalleVencidos: CronProcessedLoanItemDto[];
  detalleAlertas24h: CronProcessedLoanItemDto[];
}

export interface NotificationsFilterParams {
  leida?: boolean;
  tipo?: TipoNotificacion;
  prestamoId?: string;
  page?: number;
  limit?: number;
}

export interface AdminNotificationsFilterParams extends NotificationsFilterParams {
  usuarioId?: string;
}

// ============================================================================
// 9. ERRORES ESTANDARIZADOS DE LA API (NestJS HttpException)
// ============================================================================

export interface ApiErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
}
