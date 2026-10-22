import { vi } from 'vitest';
import type {
  AdminLoansListResponseDto,
  CreateLoanResponseDto,
  DepartmentResponseDto,
  DocumentItemDto,
  DocumentsListResponseDto,
  EstadoPrestamo,
  EstadoValidacionUsuario,
  LoanItemDto,
  LoanStateTransitionResponseDto,
  LoanViewerMetadataResponseDto,
  MyLoansListResponseDto,
  NotificationItemDto,
  NotificationsListResponseDto,
  TerritorialMetricsResponseDto,
  TipoDocumento,
  TipoNotificacion,
  UserAdminItemDto,
  UserProfileResponseDto,
  UsersListResponseDto,
} from '../types/openapi.types';
import { department, json, profile } from './test-utils';

/**
 * Backend simulado con estado (Fase 6): usuarios, catálogo, préstamos y notificaciones compartidos
 * entre sesiones, para recorrer los circuitos completos que cruzan roles (alumno ⇄ Biblioteca)
 * dentro de una misma prueba. Replica las reglas del Backend NestJS que la SPA necesita observar:
 * - Login: 401 credenciales inválidas, 403 cuenta PENDIENTE / RECHAZADO.
 * - JWT de sesión `jwt-<userId>` y token DRM `drm-<código>` por préstamo.
 * - Préstamo de 7 días, 409 ante préstamo activo duplicado o material suspendido.
 * - Visor y stream: 403 si el préstamo dejó de estar ACTIVO o venció.
 * - Avisos PRESTAMO_OTORGADO y PRESTAMO_REVOCADO en la bandeja del titular.
 * Toda petición que no coincide con una ruta queda en `unhandled` para que la prueba la detecte.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LOAN_DAYS = 7;
export const FAKE_PDF_PAGES = 3;
export const DRM_BLOCKED_MESSAGE = 'El préstamo ha vencido o fue revocado. El acceso al documento ha sido bloqueado.';

const TIPOS_NOTIFICACION: TipoNotificacion[] = [
  'CUENTA_APROBADA',
  'PRESTAMO_OTORGADO',
  'PROXIMO_VENCIMIENTO_24H',
  'PRESTAMO_VENCIDO',
  'PRESTAMO_REVOCADO',
];

interface Account {
  profile: UserProfileResponseDto;
  password: string;
}

interface LoanRecord {
  id: string;
  codigo: number;
  estado: EstadoPrestamo;
  userId: string;
  docId: string;
  inicio: number;
  vence: number;
}

interface NotificationRecord {
  id: string;
  userId: string;
  loanId: string;
  tipo: TipoNotificacion;
  mensaje: string | null;
  fecha: number;
  leida: boolean;
}

interface RouteContext {
  url: URL;
  init: RequestInit;
  params: string[];
  body: Record<string, unknown>;
  user: Account | null;
}

type Route = [RegExp, (ctx: RouteContext) => Response];

const error = (status: number, message: string) => json({ statusCode: status, message }, status);
const unauthorized = () => error(401, 'Token de sesión inválido o expirado.');
const forbidden = () => error(403, 'No posee permisos suficientes para esta operación.');
const paginate = <T>(items: T[], url: URL, defaultLimit: number) => {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.max(1, Number(url.searchParams.get('limit')) || defaultLimit);
  return {
    meta: { total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) },
    items: items.slice((page - 1) * limit, page * limit),
  };
};
const includesText = (q: string | null, ...values: (string | null | undefined)[]) =>
  !q || values.some((value) => value?.toLowerCase().includes(q.trim().toLowerCase().replace(/^#/, '')));

function parseBody(init: RequestInit): Record<string, unknown> {
  if (init.body instanceof FormData) return Object.fromEntries(init.body.entries());
  if (typeof init.body === 'string' && init.body) return JSON.parse(init.body) as Record<string, unknown>;
  return {};
}

export class FakeFaudBackend {
  readonly departamentos: DepartmentResponseDto[] = [
    department('d-capital', 'Capital', true),
    department('d-iglesia', 'Iglesia'),
    department('d-jachal', 'Jáchal'),
    department('d-valle-fertil', 'Valle Fértil'),
  ];

  private readonly accounts: Account[] = [
    {
      password: 'Admin123!',
      profile: profile({
        id: 'u-admin',
        nombre: 'Administrador Biblioteca FAUD',
        email: 'admin@faud.unsj.edu.ar',
        rol: 'ADMINISTRADOR',
        departamentoId: 'd-capital',
        departamento: { id: 'd-capital', nombre: 'Capital', esCapital: true },
      }),
    },
    { password: 'Alumno123!', profile: profile() },
    {
      password: 'Alumno123!',
      profile: profile({
        id: 'u-carlos',
        nombre: 'Carlos Gómez',
        email: 'carlos.gomez@vallefertil.gob.ar',
        estadoValidacion: 'PENDIENTE',
        departamentoId: 'd-valle-fertil',
        departamento: { id: 'd-valle-fertil', nombre: 'Valle Fértil', esCapital: false },
      }),
    },
  ];

  readonly documentos: DocumentItemDto[] = [
    this.buildDocument({
      id: 'doc-bioclimatico',
      titulo: 'Diseño bioclimático en zonas áridas',
      autor: 'E. Silva',
      director: 'Dra. Arq. Valeria Molina',
      carrera: 'Diseño',
      tipo: 'TESIS',
      anio: 2024,
      resumen: 'Propuesta de envolventes arquitectónicas y sistemas pasivos para edificaciones de alta montaña en Iglesia.',
      palabrasClave: ['bioclimática', 'zonas áridas'],
      departamentoOrigenId: 'd-iglesia',
    }),
    this.buildDocument({
      id: 'doc-accesibilidad',
      titulo: 'Accesibilidad urbana en San Juan',
      autor: 'M. Morales',
      director: null,
      carrera: 'Urbanismo',
      tipo: 'INVESTIGACION',
      anio: 2023,
      resumen: 'Relevamiento de barreras urbanas en el microcentro de la Ciudad de San Juan.',
      palabrasClave: ['accesibilidad', 'espacio público'],
      departamentoOrigenId: 'd-capital',
    }),
  ];

  private readonly loans: LoanRecord[] = [];
  private readonly notifications: NotificationRecord[] = [];
  private nextLoanCode = 1024;
  private sequence = 0;
  private sessionsExpired = false;

  /** Peticiones atendidas, como "MÉTODO /ruta" */
  readonly requests: string[] = [];
  /** Peticiones sin ruta en el Backend simulado: deben quedar vacías al final de cada circuito */
  readonly unhandled: string[] = [];

  readonly fetch = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    Promise.resolve(this.handle(new URL(String(input)), init)),
  );

  install() {
    globalThis.fetch = this.fetch as unknown as typeof fetch;
    return this;
  }

  // ==========================================================================
  // Acciones de otra sesión (otro navegador) y consultas del estado
  // ==========================================================================

  /** El titular solicitó el préstamo en otra sesión; devuelve el código asignado */
  grantLoan(email: string, documentoId: string) {
    const response = this.requestLoan(this.findAccount(email)!, { documentoId });
    if (response.status !== 201) throw new Error(`No se pudo otorgar el préstamo (${response.status})`);
    return this.nextLoanCode - 1;
  }

  /** Biblioteca revoca el préstamo desde otra sesión mientras el titular lee */
  revokeLoan(codigo: number, motivo: string) {
    const loan = this.loans.find((l) => l.codigo === codigo);
    if (!loan) throw new Error(`No existe el préstamo #${codigo}`);
    this.applyRevocation(loan, motivo);
  }

  /** El JWT de sesión vence en el Backend: toda petición autenticada responde 401 */
  expireSessions() {
    this.sessionsExpired = true;
  }

  accountState(email: string): EstadoValidacionUsuario | undefined {
    return this.findAccount(email)?.profile.estadoValidacion;
  }

  loanState(codigo: number): EstadoPrestamo | undefined {
    return this.loans.find((l) => l.codigo === codigo)?.estado;
  }

  // ==========================================================================
  // Enrutamiento
  // ==========================================================================

  private readonly routes: Route[] = [
    [/^GET \/health$/, () => this.health()],
    [/^GET \/departamentos$/, () => json(this.departamentos)],
    [/^GET \/departamentos\/metricas$/, () => json(this.metrics())],
    [/^POST \/auth\/register$/, (ctx) => this.register(ctx)],
    [/^POST \/auth\/login$/, (ctx) => this.login(ctx)],
    [/^GET \/auth\/profile$/, ({ user }) => (user ? json(user.profile) : unauthorized())],
    [/^GET \/usuarios$/, (ctx) => this.admin(ctx, () => this.listUsers(ctx.url))],
    [/^PATCH \/usuarios\/([^/]+)\/estado$/, (ctx) => this.admin(ctx, () => this.updateUserStatus(ctx))],
    [/^GET \/documentos$/, ({ url }) => this.listDocuments(url)],
    [/^POST \/documentos$/, (ctx) => this.admin(ctx, () => this.createDocument(ctx.body))],
    [/^GET \/documentos\/([^/]+)\/ver$/, (ctx) => this.streamDocument(ctx)],
    [/^GET \/documentos\/([^/]+)$/, ({ params }) => this.getDocument(params[0]!)],
    [/^POST \/prestamos$/, (ctx) => this.authenticated(ctx, (user) => this.requestLoan(user, ctx.body))],
    [/^GET \/prestamos\/mis-prestamos$/, (ctx) => this.authenticated(ctx, (user) => this.myLoans(user))],
    [/^GET \/prestamos$/, (ctx) => this.admin(ctx, () => this.adminLoans(ctx.url))],
    [/^PATCH \/prestamos\/([^/]+)\/revocar$/, (ctx) => this.admin(ctx, () => this.revoke(ctx))],
    [/^PATCH \/prestamos\/([^/]+)\/cerrar$/, (ctx) => this.authenticated(ctx, (user) => this.closeLoan(user, ctx.params[0]!))],
    [/^GET \/prestamos\/([^/]+)\/visor$/, (ctx) => this.viewer(ctx)],
    [/^GET \/notificaciones$/, (ctx) => this.authenticated(ctx, (user) => this.listNotifications(ctx.url, user))],
    [/^GET \/notificaciones\/admin$/, (ctx) => this.admin(ctx, () => this.listNotifications(ctx.url, null))],
    [
      /^PATCH \/notificaciones\/marcar-todas-leidas$/,
      (ctx) => this.authenticated(ctx, (user) => this.markAllRead(user)),
    ],
  ];

  private handle(url: URL, init: RequestInit): Response {
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const key = `${init.method ?? 'GET'} ${path}`;
    for (const [pattern, handler] of this.routes) {
      const match = key.match(pattern);
      if (!match) continue;
      this.requests.push(key);
      return handler({ url, init, params: match.slice(1), body: parseBody(init), user: this.sessionUser(init) });
    }
    this.unhandled.push(key);
    return error(404, `Ruta no contemplada por el Backend simulado: ${key}`);
  }

  private sessionUser(init: RequestInit): Account | null {
    const token = new Headers(init.headers).get('Authorization')?.replace(/^Bearer /, '');
    if (!token?.startsWith('jwt-') || this.sessionsExpired) return null;
    return this.accounts.find((a) => a.profile.id === token.slice(4)) ?? null;
  }

  private authenticated(ctx: RouteContext, handler: (user: Account) => Response) {
    return ctx.user ? handler(ctx.user) : unauthorized();
  }

  private admin(ctx: RouteContext, handler: () => Response) {
    if (!ctx.user) return unauthorized();
    return ctx.user.profile.rol === 'ADMINISTRADOR' ? handler() : forbidden();
  }

  // ==========================================================================
  // Salud, departamentos y autenticación (RF05)
  // ==========================================================================

  private health() {
    return json({
      status: 'ok',
      service: 'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ',
      version: '0.1.0',
      environment: 'test',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 1,
      database: { status: 'up', latencyMs: 1 },
    });
  }

  private metrics(): TerritorialMetricsResponseDto {
    const usuarios = this.accounts.filter((a) => a.profile.rol === 'USUARIO');
    const capital = usuarios.filter((a) => a.profile.departamento?.esCapital).length;
    return {
      totalDepartamentos: 19,
      totalUsuariosProvincia: usuarios.length,
      usuariosCapital: capital,
      usuariosDepartamentosAlejados: usuarios.length - capital,
      totalDocumentosCatalogados: this.documentos.length,
      departamentos: this.departamentos.map((d) => ({
        ...d,
        totalDocumentos: this.documentos.filter((doc) => doc.departamentoOrigenId === d.id).length,
      })),
    };
  }

  private findAccount(email: unknown) {
    return this.accounts.find((a) => a.profile.email === String(email).trim().toLowerCase());
  }

  private register({ body }: RouteContext) {
    if (this.findAccount(body.email)) return error(409, 'Ya existe una cuenta registrada con el correo electrónico.');
    const depto = this.departamentos.find((d) => d.id === body.departamentoId);
    if (!depto) return error(400, 'El departamento indicado no existe.');
    const now = new Date().toISOString();
    const account: Account = {
      password: String(body.password),
      profile: profile({
        id: `u-${++this.sequence}`,
        nombre: String(body.nombre),
        email: String(body.email).toLowerCase(),
        estadoValidacion: 'PENDIENTE',
        departamentoId: depto.id,
        departamento: { id: depto.id, nombre: depto.nombre, esCapital: depto.esCapital },
        createdAt: now,
        updatedAt: now,
      }),
    };
    this.accounts.push(account);
    return json({ message: 'Registro exitoso. Su cuenta se encuentra PENDIENTE de validación.', usuario: account.profile }, 201);
  }

  private login({ body }: RouteContext) {
    const account = this.findAccount(body.email);
    if (!account || account.password !== body.password) return error(401, 'Credenciales inválidas.');
    const { estadoValidacion } = account.profile;
    if (estadoValidacion === 'PENDIENTE') {
      return error(403, 'Su cuenta aguarda validación por parte de la Biblioteca FAUD-UNSJ (estado: PENDIENTE).');
    }
    if (estadoValidacion === 'RECHAZADO') {
      return error(403, 'Su solicitud de cuenta fue rechazada por la Biblioteca FAUD-UNSJ (estado: RECHAZADO).');
    }
    this.sessionsExpired = false;
    return json({ accessToken: `jwt-${account.profile.id}`, tokenType: 'Bearer', expiresIn: '8h', usuario: account.profile });
  }

  // ==========================================================================
  // Validación de usuarios por Biblioteca (RF05)
  // ==========================================================================

  private userItem(account: Account): UserAdminItemDto {
    return { ...account.profile, totalPrestamos: this.loans.filter((l) => l.userId === account.profile.id).length };
  }

  private listUsers(url: URL) {
    const estado = url.searchParams.get('estado');
    const departamentoId = url.searchParams.get('departamentoId');
    const rol = url.searchParams.get('rol');
    const q = url.searchParams.get('q');
    const all = this.accounts.map((a) => a.profile);
    const items = this.accounts
      .filter(({ profile: p }) => (!estado || p.estadoValidacion === estado) && (!rol || p.rol === rol))
      .filter(({ profile: p }) => !departamentoId || p.departamentoId === departamentoId)
      .filter(({ profile: p }) => includesText(q, p.nombre, p.email))
      .map((a) => this.userItem(a));
    const count = (e: EstadoValidacionUsuario) => all.filter((p) => p.estadoValidacion === e).length;
    const response: UsersListResponseDto = {
      contadores: { todos: all.length, pendientes: count('PENDIENTE'), aprobados: count('APROBADO'), rechazados: count('RECHAZADO') },
      total: items.length,
      items,
    };
    return json(response);
  }

  private updateUserStatus({ params, body }: RouteContext) {
    const account = this.accounts.find((a) => a.profile.id === params[0]);
    if (!account) return error(404, 'Usuario no encontrado.');
    const estadoAnterior = account.profile.estadoValidacion;
    const estadoActual = body.estado as EstadoValidacionUsuario;
    account.profile = { ...account.profile, estadoValidacion: estadoActual, updatedAt: new Date().toISOString() };
    return json({
      message: `El estado de validación del usuario ${account.profile.nombre} fue actualizado a ${estadoActual}.`,
      estadoAnterior,
      estadoActual,
      motivo: body.motivo,
      usuario: this.userItem(account),
    });
  }

  // ==========================================================================
  // Catálogo (RF01, RF02)
  // ==========================================================================

  private buildDocument(
    data: Pick<
      DocumentItemDto,
      'id' | 'titulo' | 'autor' | 'director' | 'carrera' | 'tipo' | 'anio' | 'resumen' | 'palabrasClave' | 'departamentoOrigenId'
    >,
  ): DocumentItemDto {
    const depto = this.departamentos.find((d) => d.id === data.departamentoOrigenId);
    return {
      ...data,
      disponible: true,
      estaDisponible: true,
      departamentoOrigen: depto ? { id: depto.id, nombre: depto.nombre, esCapital: depto.esCapital } : null,
      prestamosActivosCount: 0,
      totalPrestamosHistoricos: 0,
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
  }

  private documentItem(doc: DocumentItemDto): DocumentItemDto {
    const loans = this.loans.filter((l) => l.docId === doc.id);
    return {
      ...doc,
      estaDisponible: doc.disponible,
      prestamosActivosCount: loans.filter((l) => this.isReadable(l)).length,
      totalPrestamosHistoricos: loans.length,
    };
  }

  private listDocuments(url: URL) {
    const q = url.searchParams.get('q');
    const disponible = url.searchParams.get('disponible');
    const items = this.documentos
      .filter((d) => disponible === null || String(d.disponible) === disponible)
      .filter((d) => includesText(q, d.titulo, d.autor, d.director, d.resumen, ...d.palabrasClave))
      .map((d) => this.documentItem(d));
    const response: DocumentsListResponseDto = paginate(items, url, 12);
    return json(response);
  }

  private getDocument(id: string) {
    const doc = this.documentos.find((d) => d.id === id);
    return doc ? json(this.documentItem(doc)) : error(404, 'Documento académico no encontrado.');
  }

  private createDocument(body: Record<string, unknown>) {
    if (!(body.archivo instanceof File)) return error(400, 'El archivo PDF es obligatorio.');
    const doc = this.buildDocument({
      id: `doc-${++this.sequence}`,
      titulo: String(body.titulo),
      autor: String(body.autor),
      director: body.director ? String(body.director) : null,
      carrera: String(body.carrera),
      tipo: body.tipo as TipoDocumento,
      anio: Number(body.anio),
      resumen: String(body.resumen),
      palabrasClave: JSON.parse(String(body.palabrasClave)) as string[],
      departamentoOrigenId: body.departamentoOrigenId ? String(body.departamentoOrigenId) : null,
    });
    doc.disponible = body.disponible !== 'false';
    this.documentos.push(doc);
    return json({ message: 'Documento académico catalogado y almacenado de forma privada.', documento: this.documentItem(doc) }, 201);
  }

  // ==========================================================================
  // Préstamos y Visor Protegido (RF03, RF04)
  // ==========================================================================

  private isReadable(loan: LoanRecord) {
    return loan.estado === 'ACTIVO' && loan.vence > Date.now();
  }

  private loanItem(loan: LoanRecord): LoanItemDto {
    const user = this.accounts.find((a) => a.profile.id === loan.userId)!.profile;
    const doc = this.documentos.find((d) => d.id === loan.docId)!;
    const restante = Math.max(0, loan.vence - Date.now());
    const vigente = this.isReadable(loan);
    const codigoFormateado = `#${String(loan.codigo).padStart(4, '0')}`;
    return {
      id: loan.id,
      codigoReferencia: loan.codigo,
      codigoFormateado,
      estado: loan.estado,
      fechaInicio: new Date(loan.inicio).toISOString(),
      fechaVencimiento: new Date(loan.vence).toISOString(),
      vigente,
      diasRestantes: vigente ? Math.ceil(restante / DAY) : 0,
      horasRestantes: vigente ? Math.ceil(restante / HOUR) : 0,
      porVencer24h: vigente && restante <= DAY,
      marcaAgua: `${user.nombre} · Préstamo ${codigoFormateado}`,
      visorUrl: `/api/v1/prestamos/${loan.id}/visor`,
      contenidoUrl: `/api/v1/prestamos/${loan.id}/contenido`,
      tokenAcceso: vigente ? `drm-${loan.codigo}` : null,
      usuario: { id: user.id, nombre: user.nombre, email: user.email, departamento: user.departamento! },
      documento: {
        id: doc.id,
        titulo: doc.titulo,
        autor: doc.autor,
        director: doc.director,
        carrera: doc.carrera,
        tipo: doc.tipo,
        anio: doc.anio,
        disponible: doc.disponible,
        departamentoOrigen: doc.departamentoOrigen,
      },
      createdAt: new Date(loan.inicio).toISOString(),
      updatedAt: new Date(loan.inicio).toISOString(),
    };
  }

  private requestLoan(user: Account, body: Record<string, unknown>) {
    const doc = this.documentos.find((d) => d.id === body.documentoId);
    if (!doc) return error(404, 'Documento académico no encontrado.');
    if (!doc.disponible) return error(409, 'El material se encuentra temporalmente suspendido por Biblioteca.');
    if (this.loans.some((l) => l.userId === user.profile.id && l.docId === doc.id && this.isReadable(l))) {
      return error(409, 'Ya posee un préstamo ACTIVO vigente sobre este documento.');
    }
    const inicio = Date.now();
    const loan: LoanRecord = {
      id: `loan-${this.nextLoanCode}`,
      codigo: this.nextLoanCode++,
      estado: 'ACTIVO',
      userId: user.profile.id,
      docId: doc.id,
      inicio,
      vence: inicio + LOAN_DAYS * DAY,
    };
    this.loans.push(loan);
    this.notify(loan, 'PRESTAMO_OTORGADO', null);
    const prestamo = this.loanItem(loan);
    const response: CreateLoanResponseDto = {
      message: `Préstamo digital ${prestamo.codigoFormateado} otorgado por ${LOAN_DAYS} días.`,
      prestamo,
      tokenAcceso: prestamo.tokenAcceso!,
      tokenType: 'Bearer',
      expiresInDays: LOAN_DAYS,
      marcaAgua: prestamo.marcaAgua,
      drm: this.drmRestrictions(prestamo.marcaAgua),
      visorUrl: prestamo.visorUrl,
      contenidoUrl: prestamo.contenidoUrl,
    };
    return json(response, 201);
  }

  private drmRestrictions(marcaAgua: string) {
    return { permitirDescarga: false, permitirImpresion: false, permitirCopia: false, duracionMaximaDias: LOAN_DAYS, marcaAgua };
  }

  private myLoans(user: Account) {
    const loans = this.loans.filter((l) => l.userId === user.profile.id).map((l) => this.loanItem(l));
    const count = (estado: EstadoPrestamo) => loans.filter((l) => l.estado === estado).length;
    const response: MyLoansListResponseDto = {
      contadores: {
        todos: loans.length,
        activos: count('ACTIVO'),
        porVencer24h: loans.filter((l) => l.porVencer24h).length,
        vencidos: count('VENCIDO'),
        revocados: count('REVOCADO'),
        cerrados: count('CERRADO'),
      },
      total: loans.length,
      items: loans,
    };
    return json(response);
  }

  private adminLoans(url: URL) {
    const estado = url.searchParams.get('estado');
    const porVencer = url.searchParams.get('porVencer24h') === 'true';
    const departamentoId = url.searchParams.get('departamentoId');
    const q = url.searchParams.get('q');
    const all = this.loans.map((l) => this.loanItem(l));
    const items = all
      .filter((l) => (!estado || l.estado === estado) && (!porVencer || l.porVencer24h))
      .filter((l) => !departamentoId || l.usuario.departamento.id === departamentoId)
      .filter((l) => includesText(q, l.usuario.nombre, l.documento.titulo, l.codigoFormateado))
      .sort((a, b) => b.codigoReferencia - a.codigoReferencia);
    const count = (e: EstadoPrestamo) => all.filter((l) => l.estado === e).length;
    const response: AdminLoansListResponseDto = {
      metricas: {
        activos: count('ACTIVO'),
        porVencer24h: all.filter((l) => l.porVencer24h).length,
        vencidosHoy: 0,
        vencidosTotal: count('VENCIDO'),
        revocadosTotal: count('REVOCADO'),
        rechazadosTotal: count('RECHAZADO'),
        cerradosTotal: count('CERRADO'),
        totalHistorico: all.length,
      },
      ...paginate(items, url, 15),
    };
    return json(response);
  }

  private applyRevocation(loan: LoanRecord, motivo: string) {
    const estadoAnterior = loan.estado;
    loan.estado = 'REVOCADO';
    this.notify(loan, 'PRESTAMO_REVOCADO', `Biblioteca revocó el acceso al préstamo. Motivo: ${motivo}`);
    return estadoAnterior;
  }

  private revoke({ params, body }: RouteContext) {
    const loan = this.loans.find((l) => l.id === params[0]);
    if (!loan) return error(404, 'Préstamo no encontrado.');
    if (loan.estado !== 'ACTIVO') return error(409, `No se puede revocar un préstamo en estado ${loan.estado}.`);
    const estadoAnterior = this.applyRevocation(loan, String(body.motivo ?? ''));
    const response: LoanStateTransitionResponseDto = {
      message: `El préstamo ${this.loanItem(loan).codigoFormateado} fue revocado inmediatamente por Biblioteca.`,
      estadoAnterior,
      estadoActual: 'REVOCADO',
      motivo: body.motivo as string | undefined,
      prestamo: this.loanItem(loan),
    };
    return json(response);
  }

  private closeLoan(user: Account, loanId: string) {
    const loan = this.loans.find((l) => l.id === loanId && l.userId === user.profile.id);
    if (!loan) return error(404, 'Préstamo no encontrado.');
    const estadoAnterior = loan.estado;
    loan.estado = 'CERRADO';
    const response: LoanStateTransitionResponseDto = {
      message: 'Préstamo cerrado.',
      estadoAnterior,
      estadoActual: 'CERRADO',
      prestamo: this.loanItem(loan),
    };
    return json(response);
  }

  /** Doble validación DRM: JWT de sesión del titular o token DRM del préstamo, y préstamo ACTIVO vigente */
  private drmLoan(ctx: RouteContext, match: (loan: LoanRecord) => boolean): LoanRecord | Response {
    const drmToken = new Headers(ctx.init.headers).get('x-drm-token');
    const loan = this.loans.find(
      (l) => match(l) && ((ctx.user && l.userId === ctx.user.profile.id) || drmToken === `drm-${l.codigo}`),
    );
    if (!loan) return ctx.user || drmToken ? forbidden() : unauthorized();
    return this.isReadable(loan) ? loan : error(403, DRM_BLOCKED_MESSAGE);
  }

  private viewer(ctx: RouteContext) {
    const loan = this.drmLoan(ctx, (l) => l.id === ctx.params[0]);
    if (loan instanceof Response) return loan;
    const item = this.loanItem(loan);
    const segundosRestantes = Math.floor((loan.vence - Date.now()) / 1000);
    const response: LoanViewerMetadataResponseDto = {
      prestamoId: item.id,
      codigoReferencia: item.codigoReferencia,
      codigoFormateado: item.codigoFormateado,
      estado: item.estado,
      fechaInicio: item.fechaInicio,
      fechaVencimiento: item.fechaVencimiento,
      diasRestantes: item.diasRestantes,
      horasRestantes: item.horasRestantes,
      segundosRestantes,
      porVencer24h: item.porVencer24h,
      marcaAgua: item.marcaAgua,
      drm: this.drmRestrictions(item.marcaAgua),
      usuario: item.usuario,
      documento: item.documento,
      streamDocumentoUrl: `/api/v1/documentos/${loan.docId}/ver`,
      streamPrestamoUrl: item.contenidoUrl,
    };
    return json(response);
  }

  private streamDocument(ctx: RouteContext) {
    const loan = this.drmLoan(ctx, (l) => l.docId === ctx.params[0]);
    if (loan instanceof Response) return loan;
    const item = this.loanItem(loan);
    return new Response(new TextEncoder().encode('%PDF-1.7 documento protegido'), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'X-DRM-Watermark-URI': encodeURIComponent(item.marcaAgua),
        'X-DRM-Loan-Code': item.codigoFormateado,
      },
    });
  }

  // ==========================================================================
  // Notificaciones (RF06)
  // ==========================================================================

  private notify(loan: LoanRecord, tipo: TipoNotificacion, mensaje: string | null) {
    this.notifications.push({
      id: `n-${++this.sequence}`,
      userId: loan.userId,
      loanId: loan.id,
      tipo,
      mensaje,
      fecha: Date.now() + this.sequence,
      leida: false,
    });
  }

  private notificationItem(n: NotificationRecord): NotificationItemDto {
    const loan = this.loanItem(this.loans.find((l) => l.id === n.loanId)!);
    return {
      id: n.id,
      prestamoId: n.loanId,
      tipo: n.tipo,
      mensaje: n.mensaje,
      fechaEnvio: new Date(n.fecha).toISOString(),
      leida: n.leida,
      prestamo: {
        id: loan.id,
        codigoReferencia: loan.codigoReferencia,
        codigoFormateado: loan.codigoFormateado,
        estado: loan.estado,
        fechaInicio: loan.fechaInicio,
        fechaVencimiento: loan.fechaVencimiento,
        usuario: {
          id: loan.usuario.id,
          nombre: loan.usuario.nombre,
          email: loan.usuario.email,
          departamentoNombre: loan.usuario.departamento.nombre,
        },
        documento: {
          id: loan.documento.id,
          titulo: loan.documento.titulo,
          autor: loan.documento.autor,
          carrera: loan.documento.carrera,
          tipo: loan.documento.tipo,
          anio: loan.documento.anio,
        },
      },
    };
  }

  /** Bandeja del titular, o auditoría global de Biblioteca con `user = null` */
  private listNotifications(url: URL, user: Account | null) {
    const tipo = url.searchParams.get('tipo');
    const leida = url.searchParams.get('leida');
    const own = this.notifications.filter((n) => !user || n.userId === user.profile.id).sort((a, b) => b.fecha - a.fecha);
    const items = own
      .filter((n) => (!tipo || n.tipo === tipo) && (leida === null || String(n.leida) === leida))
      .map((n) => this.notificationItem(n));
    const noLeidas = own.filter((n) => !n.leida).length;
    const response: NotificationsListResponseDto = {
      contadores: {
        total: own.length,
        noLeidas,
        leidas: own.length - noLeidas,
        porTipo: Object.fromEntries(TIPOS_NOTIFICACION.map((t) => [t, own.filter((n) => n.tipo === t).length])) as Record<
          TipoNotificacion,
          number
        >,
      },
      ...paginate(items, url, 20),
    };
    return json(response);
  }

  private markAllRead(user: Account) {
    const pending = this.notifications.filter((n) => n.userId === user.profile.id && !n.leida);
    pending.forEach((n) => (n.leida = true));
    return json({ message: 'Notificaciones marcadas como leídas.', actualizadas: pending.length });
  }
}
