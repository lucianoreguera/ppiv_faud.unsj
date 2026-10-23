import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  EstadoPrestamo,
  EstadoValidacionUsuario,
  Prisma,
  RolUsuario,
  TipoDocumento,
  TipoNotificacion,
} from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { PdfStorageService } from '../catalog/pdf-storage.service';
import { PdfReadStream } from '../catalog/storage/pdf-storage-driver.interface';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../common/interfaces/authenticated-user.interface';
import { EmailService } from '../notifications/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import {
  AdminLoansListResponseDto,
  CreateLoanResponseDto,
  LoanDrmRestrictionsDto,
  LoanItemDto,
  LoanStateTransitionResponseDto,
  LoanViewerMetadataResponseDto,
  MyLoansListResponseDto,
} from './dto/loan-response.dto';
import { QueryAdminLoansDto, QueryMyLoansDto } from './dto/query-loans.dto';
import { RevokeLoanDto } from './dto/revoke-loan.dto';
import {
  LoanDrmJwtPayload,
  ValidatedDrmAccess,
} from './interfaces/loan-drm-payload.interface';
import { LoanStateMachine } from './loan-state-machine';

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

type PrestamoWithRelations = {
  id: string;
  codigoReferencia: number;
  usuarioId: string;
  documentoId: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  estado: EstadoPrestamo;
  tokenAcceso: string | null;
  createdAt: Date;
  updatedAt: Date;
  usuario: {
    id: string;
    nombre: string;
    email: string;
    estadoValidacion: EstadoValidacionUsuario;
    departamento: {
      id: string;
      nombre: string;
      esCapital: boolean;
    };
  };
  documento: {
    id: string;
    titulo: string;
    autor: string;
    director: string | null;
    carrera: string;
    tipo: TipoDocumento;
    anio: number;
    archivoUrl: string;
    disponible: boolean;
    departamentoOrigen: {
      id: string;
      nombre: string;
      esCapital: boolean;
    } | null;
  };
};

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);
  private readonly loanDrmSecret: string;
  private readonly sessionJwtSecret: string;
  private readonly loanDurationDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly catalogService: CatalogService,
    private readonly pdfStorageService: PdfStorageService,
    @Optional() private readonly emailService?: EmailService,
  ) {
    const drmSecret = this.configService.get<string>('drm.loanJwtSecret');
    if (!drmSecret) {
      throw new Error(
        'LOAN_DRM_JWT_SECRET no está definido en las variables de entorno.',
      );
    }
    this.loanDrmSecret = drmSecret;
    this.sessionJwtSecret =
      this.configService.get<string>('auth.jwtSecret') ?? '';
    this.loanDurationDays = this.configService.get<number>(
      'drm.loanDurationDays',
      7,
    );
  }

  /**
   * Solicita y otorga un préstamo digital temporal por 7 días corridos (RF03, RF04, RNF02).
   * Implementa el método `solicitarPrestamo()` del Diagrama de Clases (Figura 2) y
   * las transiciones `SOLICITADO -> ACTIVO` o `SOLICITADO -> RECHAZADO` del Diagrama de Estados (Figura 5).
   */
  async solicitarPrestamo(
    usuarioId: string,
    dto: CreateLoanDto,
  ): Promise<CreateLoanResponseDto> {
    // 1. Sincronizar eventuales préstamos vencidos previos de este usuario
    await this.sincronizarPrestamosVencidos({
      usuarioId,
      documentoId: dto.documentoId,
    });

    // 2. Verificar que el usuario exista y esté APROBADO
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        departamento: {
          select: {
            id: true,
            nombre: true,
            esCapital: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException('El usuario solicitante no existe.');
    }

    if (usuario.estadoValidacion !== EstadoValidacionUsuario.APROBADO) {
      throw new ForbiddenException(
        `Su cuenta no se encuentra habilitada para solicitar préstamos (estado actual: ${usuario.estadoValidacion}).`,
      );
    }

    // 3. Verificar que el documento académico exista
    const documento = await this.prisma.documento.findUnique({
      where: { id: dto.documentoId },
      select: {
        id: true,
        titulo: true,
        disponible: true,
      },
    });

    if (!documento) {
      throw new NotFoundException(
        `No se encontró ningún documento académico con ID "${dto.documentoId}".`,
      );
    }

    // 4. Comprobar si el mismo usuario ya posee un préstamo ACTIVO vigente sobre este documento
    const prestamoActivoExistente = await this.prisma.prestamo.findFirst({
      where: {
        usuarioId,
        documentoId: documento.id,
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        codigoReferencia: true,
        fechaVencimiento: true,
      },
    });

    if (prestamoActivoExistente) {
      throw new ConflictException(
        `Ya posees un préstamo ACTIVO vigente (${this.formatLoanCode(prestamoActivoExistente.codigoReferencia)}) sobre el documento "${documento.titulo}".`,
      );
    }

    // 5. Evaluar disponibilidad administrativa (`estaDisponible()`)
    const disponible = await this.catalogService.estaDisponible(
      documento.id,
      usuarioId,
    );

    if (!disponible || !documento.disponible) {
      // Transición explícita SOLICITADO -> RECHAZADO (Figura 5)
      LoanStateMachine.assertTransition(
        EstadoPrestamo.SOLICITADO,
        EstadoPrestamo.RECHAZADO,
      );

      const now = new Date();
      await this.prisma.prestamo.create({
        data: {
          usuarioId,
          documentoId: documento.id,
          fechaInicio: now,
          fechaVencimiento: now,
          estado: EstadoPrestamo.RECHAZADO,
          tokenAcceso: null,
        },
      });

      throw new ConflictException(
        `El documento "${documento.titulo}" no se encuentra disponible para préstamo por disposición de Biblioteca FAUD-UNSJ (solicitud en estado RECHAZADO).`,
      );
    }

    // 6. Transición explícita SOLICITADO -> ACTIVO (Figura 5)
    LoanStateMachine.assertTransition(
      EstadoPrestamo.SOLICITADO,
      EstadoPrestamo.ACTIVO,
    );

    const fechaInicio = new Date();
    const fechaVencimiento = new Date(
      fechaInicio.getTime() + this.loanDurationDays * MS_PER_DAY,
    );

    // Creamos el préstamo en estado ACTIVO y registramos la notificación PRESTAMO_OTORGADO
    const prestamoCreado = await this.prisma.prestamo.create({
      data: {
        usuarioId,
        documentoId: documento.id,
        fechaInicio,
        fechaVencimiento,
        estado: EstadoPrestamo.ACTIVO,
        notificaciones: {
          create: {
            tipo: TipoNotificacion.PRESTAMO_OTORGADO,
            mensaje: `Préstamo digital otorgado por ${this.loanDurationDays} días corridos para "${documento.titulo}".`,
          },
        },
      },
    });

    const marcaAgua = this.buildWatermark(
      usuario.nombre,
      prestamoCreado.codigoReferencia,
    );

    const drmPayload: LoanDrmJwtPayload = {
      sub: usuario.id,
      prestamoId: prestamoCreado.id,
      documentoId: documento.id,
      docId: documento.id,
      codigoReferencia: prestamoCreado.codigoReferencia,
      marcaAgua,
      type: 'LOAN_DRM_7D',
    };

    const tokenAcceso = await this.jwtService.signAsync(drmPayload, {
      secret: this.loanDrmSecret,
      expiresIn: `${this.loanDurationDays}d` as never,
    });

    const prestamoConToken = await this.prisma.prestamo.update({
      where: { id: prestamoCreado.id },
      data: { tokenAcceso },
      include: this.getPrestamoInclude(),
    });

    const codigoFormateado = this.formatLoanCode(
      prestamoConToken.codigoReferencia,
    );
    const loanDto = this.toLoanItemDto(prestamoConToken, true);

    this.logger.log(
      `Préstamo ${codigoFormateado} otorgado a ${usuario.email} (${usuario.departamento.nombre}) sobre "${documento.titulo}" hasta ${fechaVencimiento.toISOString()}`,
    );

    if (this.emailService) {
      await this.emailService.sendLoanGrantedEmail({
        to: usuario.email,
        usuarioNombre: usuario.nombre,
        departamentoNombre: usuario.departamento.nombre,
        codigoFormateado,
        documentoTitulo: prestamoConToken.documento.titulo,
        documentoAutor: prestamoConToken.documento.autor,
        fechaInicio,
        fechaVencimiento,
      });
    }

    return {
      message: `Préstamo digital ${codigoFormateado} otorgado exitosamente por ${this.loanDurationDays} días corridos. Ya puede acceder al visor protegido.`,
      prestamo: loanDto,
      tokenAcceso,
      tokenType: 'Bearer',
      expiresInDays: this.loanDurationDays,
      marcaAgua,
      drm: this.buildDrmRestrictions(marcaAgua),
      visorUrl: loanDto.visorUrl,
      contenidoUrl: loanDto.contenidoUrl,
    };
  }

  /**
   * Lista los préstamos del usuario autenticado ("Mis Préstamos" — Figma pág. 13),
   * calculando días restantes, alerta de vencimiento en 24h y contadores por estado.
   */
  async findMyLoans(
    usuarioId: string,
    query: QueryMyLoansDto,
  ): Promise<MyLoansListResponseDto> {
    await this.sincronizarPrestamosVencidos({ usuarioId });

    const todosDelUsuario = await this.prisma.prestamo.findMany({
      where: { usuarioId },
      orderBy: [{ createdAt: 'desc' }],
      include: this.getPrestamoInclude(),
    });

    const allDtos = todosDelUsuario.map((p) => this.toLoanItemDto(p, true));

    const contadores = {
      todos: allDtos.length,
      activos: allDtos.filter((p) => p.estado === EstadoPrestamo.ACTIVO).length,
      porVencer24h: allDtos.filter((p) => p.porVencer24h).length,
      vencidos: allDtos.filter((p) => p.estado === EstadoPrestamo.VENCIDO)
        .length,
      revocados: allDtos.filter((p) => p.estado === EstadoPrestamo.REVOCADO)
        .length,
      cerrados: allDtos.filter((p) => p.estado === EstadoPrestamo.CERRADO)
        .length,
    };

    let filtered = allDtos;

    if (query.estado) {
      filtered = filtered.filter((p) => p.estado === query.estado);
    }

    if (query.porVencer24h !== undefined) {
      filtered = filtered.filter((p) => p.porVencer24h === query.porVencer24h);
    }

    if (query.q && query.q.trim().length > 0) {
      const search = query.q.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.documento.titulo.toLowerCase().includes(search) ||
          p.documento.autor.toLowerCase().includes(search) ||
          p.documento.carrera.toLowerCase().includes(search) ||
          p.codigoFormateado.toLowerCase().includes(search),
      );
    }

    return {
      contadores,
      total: filtered.length,
      items: filtered,
    };
  }

  /**
   * Tablero de control de préstamos para el Administrador de Biblioteca (Figma pág. 9).
   * Devuelve métricas consolidadas (`activos`, `porVencer24h`, `vencidosHoy`, etc.) y listado paginado.
   */
  async findAllForAdmin(
    query: QueryAdminLoansDto,
  ): Promise<AdminLoansListResponseDto> {
    await this.sincronizarPrestamosVencidos();

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * MS_PER_HOUR);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const where: Prisma.PrestamoWhereInput = {};

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.usuarioId) {
      where.usuarioId = query.usuarioId;
    }

    if (query.documentoId) {
      where.documentoId = query.documentoId;
    }

    if (query.departamentoId) {
      where.usuario = {
        departamentoId: query.departamentoId,
      };
    }

    if (query.porVencer24h === true) {
      where.estado = EstadoPrestamo.ACTIVO;
      where.fechaVencimiento = {
        gt: now,
        lte: in24Hours,
      };
    } else if (query.porVencer24h === false) {
      where.NOT = {
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: {
          gt: now,
          lte: in24Hours,
        },
      };
    }

    if (query.q && query.q.trim().length > 0) {
      const search = query.q.trim();
      const numericCode = parseInt(search.replace(/^#/, ''), 10);

      const orConditions: Prisma.PrestamoWhereInput[] = [
        {
          usuario: {
            nombre: { contains: search, mode: 'insensitive' },
          },
        },
        {
          usuario: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
        {
          usuario: {
            departamento: {
              nombre: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          documento: {
            titulo: { contains: search, mode: 'insensitive' },
          },
        },
        {
          documento: {
            autor: { contains: search, mode: 'insensitive' },
          },
        },
      ];

      if (!Number.isNaN(numericCode)) {
        orConditions.push({ codigoReferencia: numericCode });
      }

      where.OR = orConditions;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 15;
    const skip = (page - 1) * limit;

    const [
      prestamos,
      totalFiltered,
      groupedByState,
      porVencer24hCount,
      vencidosHoyCount,
    ] = await Promise.all([
      this.prisma.prestamo.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: this.getPrestamoInclude(),
      }),
      this.prisma.prestamo.count({ where }),
      this.prisma.prestamo.groupBy({
        by: ['estado'],
        _count: { _all: true },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: EstadoPrestamo.ACTIVO,
          fechaVencimiento: {
            gt: now,
            lte: in24Hours,
          },
        },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: EstadoPrestamo.VENCIDO,
          fechaVencimiento: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
    ]);

    const stateCounts: Record<EstadoPrestamo, number> = {
      [EstadoPrestamo.SOLICITADO]: 0,
      [EstadoPrestamo.ACTIVO]: 0,
      [EstadoPrestamo.RECHAZADO]: 0,
      [EstadoPrestamo.VENCIDO]: 0,
      [EstadoPrestamo.REVOCADO]: 0,
      [EstadoPrestamo.CERRADO]: 0,
    };

    let totalHistorico = 0;
    for (const row of groupedByState) {
      stateCounts[row.estado] = row._count._all;
      totalHistorico += row._count._all;
    }

    const totalPages =
      totalFiltered === 0 ? 0 : Math.ceil(totalFiltered / limit);

    return {
      metricas: {
        activos: stateCounts[EstadoPrestamo.ACTIVO],
        porVencer24h: porVencer24hCount,
        vencidosHoy: vencidosHoyCount,
        vencidosTotal: stateCounts[EstadoPrestamo.VENCIDO],
        revocadosTotal: stateCounts[EstadoPrestamo.REVOCADO],
        rechazadosTotal: stateCounts[EstadoPrestamo.RECHAZADO],
        cerradosTotal: stateCounts[EstadoPrestamo.CERRADO],
        totalHistorico,
      },
      meta: {
        total: totalFiltered,
        page,
        limit,
        totalPages,
      },
      items: prestamos.map((p) => this.toLoanItemDto(p, false)),
    };
  }

  /**
   * Obtiene el detalle de un préstamo por su UUID.
   * Permite el acceso únicamente al titular del préstamo o a un ADMINISTRADOR.
   */
  async findOne(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<LoanItemDto> {
    await this.sincronizarPrestamosVencidos({ prestamoId: id });

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id },
      include: this.getPrestamoInclude(),
    });

    if (!prestamo) {
      throw new NotFoundException(
        `No se encontró ningún préstamo con ID "${id}".`,
      );
    }

    const isOwner = prestamo.usuarioId === requester.id;
    const isAdmin = requester.rol === RolUsuario.ADMINISTRADOR;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'No tiene permisos para consultar un préstamo perteneciente a otro usuario.',
      );
    }

    return this.toLoanItemDto(prestamo, isOwner);
  }

  /**
   * Implementa el método de dominio `revocarAcceso()` del Diagrama de Clases (Figura 2).
   * Transiciona el préstamo de ACTIVO a REVOCADO e invalida inmediatamente el acceso al visor PDF,
   * aun cuando el token JWT DRM de 7 días no haya alcanzado su fecha de expiración.
   */
  async revocarAcceso(
    id: string,
    dto?: RevokeLoanDto,
  ): Promise<LoanStateTransitionResponseDto> {
    await this.sincronizarPrestamosVencidos({ prestamoId: id });

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id },
      include: this.getPrestamoInclude(),
    });

    if (!prestamo) {
      throw new NotFoundException(
        `No se encontró ningún préstamo con ID "${id}".`,
      );
    }

    const estadoAnterior = prestamo.estado;

    // Valida que la transición hacia REVOCADO sea permitida (solo desde ACTIVO)
    LoanStateMachine.assertTransition(
      estadoAnterior,
      EstadoPrestamo.REVOCADO,
      `No se puede revocar el préstamo ${this.formatLoanCode(prestamo.codigoReferencia)} porque su estado actual es "${estadoAnterior}" (solo se pueden revocar préstamos en estado ACTIVO).`,
    );

    const motivoTexto = dto?.motivo?.trim()
      ? dto.motivo.trim()
      : 'Revocado manualmente por administración de Biblioteca FAUD-UNSJ.';

    const actualizado = await this.prisma.prestamo.update({
      where: { id },
      data: {
        estado: EstadoPrestamo.REVOCADO,
        notificaciones: {
          create: {
            tipo: TipoNotificacion.PRESTAMO_REVOCADO,
            mensaje: `El préstamo ${this.formatLoanCode(prestamo.codigoReferencia)} sobre "${prestamo.documento.titulo}" fue revocado por Biblioteca. Motivo: ${motivoTexto}`,
          },
        },
      },
      include: this.getPrestamoInclude(),
    });

    const codigoFormateado = this.formatLoanCode(actualizado.codigoReferencia);
    this.logger.log(
      `Préstamo ${codigoFormateado} revocado manualmente. Usuario: ${actualizado.usuario.email}`,
    );

    if (this.emailService) {
      await this.emailService.sendLoanRevokedEmail({
        to: actualizado.usuario.email,
        usuarioNombre: actualizado.usuario.nombre,
        departamentoNombre: actualizado.usuario.departamento.nombre,
        codigoFormateado,
        documentoTitulo: actualizado.documento.titulo,
        motivo: motivoTexto,
      });
    }

    return {
      message: `El préstamo ${codigoFormateado} fue revocado inmediatamente. El acceso de visualización al documento PDF ha quedado bloqueado.`,
      estadoAnterior,
      estadoActual: actualizado.estado,
      motivo: motivoTexto,
      prestamo: this.toLoanItemDto(actualizado, false),
    };
  }

  /**
   * Permite al usuario titular o al Administrador cerrar/devolver un préstamo (`ACTIVO | VENCIDO | REVOCADO -> CERRADO`).
   */
  async cerrarPrestamo(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<LoanStateTransitionResponseDto> {
    await this.sincronizarPrestamosVencidos({ prestamoId: id });

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id },
      include: this.getPrestamoInclude(),
    });

    if (!prestamo) {
      throw new NotFoundException(
        `No se encontró ningún préstamo con ID "${id}".`,
      );
    }

    const isOwner = prestamo.usuarioId === requester.id;
    const isAdmin = requester.rol === RolUsuario.ADMINISTRADOR;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'No tiene permisos para cerrar un préstamo perteneciente a otro usuario.',
      );
    }

    const estadoAnterior = prestamo.estado;

    LoanStateMachine.assertTransition(
      estadoAnterior,
      EstadoPrestamo.CERRADO,
      `No se puede cerrar el préstamo ${this.formatLoanCode(prestamo.codigoReferencia)} desde el estado "${estadoAnterior}".`,
    );

    const actualizado = await this.prisma.prestamo.update({
      where: { id },
      data: {
        estado: EstadoPrestamo.CERRADO,
      },
      include: this.getPrestamoInclude(),
    });

    const codigoFormateado = this.formatLoanCode(actualizado.codigoReferencia);

    return {
      message: `El préstamo ${codigoFormateado} ha pasado al estado CERRADO y su ciclo ha finalizado.`,
      estadoAnterior,
      estadoActual: actualizado.estado,
      prestamo: this.toLoanItemDto(actualizado, false),
    };
  }

  /**
   * Implementa el método de dominio `validarVigencia()` del Diagrama de Clases (Figura 2) y Diagrama de Secuencia (Figura 3).
   * Verifica que el préstamo exista, esté en estado ACTIVO y su `fechaVencimiento > now()`.
   * Si se encontraba ACTIVO pero ya superó los 7 días, ejecuta la transición automática `ACTIVO -> VENCIDO`.
   */
  async validarVigencia(prestamoId: string): Promise<boolean> {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      select: {
        id: true,
        codigoReferencia: true,
        estado: true,
        fechaVencimiento: true,
        documento: {
          select: {
            titulo: true,
          },
        },
      },
    });

    if (!prestamo) {
      return false;
    }

    const now = new Date();

    if (
      prestamo.estado === EstadoPrestamo.ACTIVO &&
      prestamo.fechaVencimiento.getTime() <= now.getTime()
    ) {
      LoanStateMachine.assertTransition(
        EstadoPrestamo.ACTIVO,
        EstadoPrestamo.VENCIDO,
      );

      await this.prisma.prestamo.update({
        where: { id: prestamo.id },
        data: {
          estado: EstadoPrestamo.VENCIDO,
          notificaciones: {
            create: {
              tipo: TipoNotificacion.PRESTAMO_VENCIDO,
              mensaje: `El plazo de 7 días del préstamo ${this.formatLoanCode(prestamo.codigoReferencia)} sobre "${prestamo.documento.titulo}" ha expirado.`,
            },
          },
        },
      });

      return false;
    }

    return (
      LoanStateMachine.allowsReading(prestamo.estado) &&
      prestamo.fechaVencimiento.getTime() > now.getTime()
    );
  }

  /**
   * Valida el acceso DRM para el endpoint `GET /api/v1/documentos/:id/ver` (Diagrama de Secuencia Figura 3).
   * Realiza la doble comprobación obligatoria:
   * 1. Firma y expiración del token JWT DRM (o token de sesión del prestatario).
   * 2. Estado ACTIVO y `fechaVencimiento > now()` en PostgreSQL (garantizando bloqueo inmediato ante revocación o vencimiento).
   */
  async validateDrmAccessByDocument(
    documentoId: string,
    rawToken?: string,
  ): Promise<ValidatedDrmAccess> {
    // Aseguramos que el documento exista
    const documentoExiste = await this.prisma.documento.findUnique({
      where: { id: documentoId },
      select: { id: true },
    });

    if (!documentoExiste) {
      throw new NotFoundException(
        `No se encontró ningún documento académico con ID "${documentoId}".`,
      );
    }

    return this.resolveAndVerifyDrmAccess({
      expectedDocumentoId: documentoId,
      rawToken,
    });
  }

  /**
   * Valida el acceso DRM para el endpoint `GET /api/v1/prestamos/:id/contenido` y `/visor`.
   */
  async validateDrmAccessByLoan(
    prestamoId: string,
    rawToken?: string,
  ): Promise<ValidatedDrmAccess> {
    const prestamoExiste = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      select: { id: true },
    });

    if (!prestamoExiste) {
      throw new NotFoundException(
        `No se encontró ningún préstamo con ID "${prestamoId}".`,
      );
    }

    return this.resolveAndVerifyDrmAccess({
      expectedPrestamoId: prestamoId,
      rawToken,
    });
  }

  /**
   * Abre el stream del PDF privado de un acceso DRM ya validado (disco local o bucket S3).
   */
  async openProtectedPdf(access: ValidatedDrmAccess): Promise<PdfReadStream> {
    const pdf = await this.pdfStorageService.openPdf(access.archivoUrl);

    if (!pdf) {
      throw new NotFoundException(
        `El archivo PDF privado asociado al documento "${access.documentoTitulo}" no se encuentra en el almacenamiento seguro.`,
      );
    }

    return pdf;
  }

  /**
   * Devuelve los metadatos completos para construir la interfaz del Visor Protegido (Figma pág. 14):
   * marca de agua dinámica, cuenta regresiva, banderas de bloqueo de descarga/impresión y URLs de stream.
   */
  async getViewerMetadata(
    prestamoId: string,
    rawToken?: string,
  ): Promise<LoanViewerMetadataResponseDto> {
    const access = await this.validateDrmAccessByLoan(prestamoId, rawToken);

    const prestamo = await this.prisma.prestamo.findUniqueOrThrow({
      where: { id: access.prestamoId },
      include: this.getPrestamoInclude(),
    });

    return {
      prestamoId: access.prestamoId,
      codigoReferencia: access.codigoReferencia,
      codigoFormateado: access.codigoFormateado,
      estado: prestamo.estado,
      fechaInicio: access.fechaInicio,
      fechaVencimiento: access.fechaVencimiento,
      diasRestantes: access.diasRestantes,
      horasRestantes: access.horasRestantes,
      segundosRestantes: access.segundosRestantes,
      porVencer24h: access.porVencer24h,
      marcaAgua: access.marcaAgua,
      drm: this.buildDrmRestrictions(access.marcaAgua),
      usuario: {
        id: prestamo.usuario.id,
        nombre: prestamo.usuario.nombre,
        email: prestamo.usuario.email,
        departamento: prestamo.usuario.departamento,
      },
      documento: {
        id: prestamo.documento.id,
        titulo: prestamo.documento.titulo,
        autor: prestamo.documento.autor,
        director: prestamo.documento.director,
        carrera: prestamo.documento.carrera,
        tipo: prestamo.documento.tipo,
        anio: prestamo.documento.anio,
        disponible: prestamo.documento.disponible,
        departamentoOrigen: prestamo.documento.departamentoOrigen,
      },
      streamDocumentoUrl: `/api/v1/documentos/${access.documentoId}/ver`,
      streamPrestamoUrl: `/api/v1/prestamos/${access.prestamoId}/contenido`,
    };
  }

  /**
   * Sincroniza en lote los préstamos que figuraban en estado ACTIVO pero cuya `fechaVencimiento <= now()`,
   * pasándolos automáticamente a `VENCIDO` (Figura 4 y Figura 5).
   */
  async sincronizarPrestamosVencidos(filter?: {
    usuarioId?: string;
    documentoId?: string;
    prestamoId?: string;
  }): Promise<number> {
    const now = new Date();
    const where: Prisma.PrestamoWhereInput = {
      estado: EstadoPrestamo.ACTIVO,
      fechaVencimiento: {
        lte: now,
      },
      ...(filter?.usuarioId ? { usuarioId: filter.usuarioId } : {}),
      ...(filter?.documentoId ? { documentoId: filter.documentoId } : {}),
      ...(filter?.prestamoId ? { id: filter.prestamoId } : {}),
    };

    const result = await this.prisma.prestamo.updateMany({
      where,
      data: {
        estado: EstadoPrestamo.VENCIDO,
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Sincronización automática de vigencia: ${result.count} préstamo(s) pasaron de ACTIVO a VENCIDO.`,
      );
    }

    return result.count;
  }

  /**
   * Formatea el código correlativo del préstamo (ej. #0001 o #1024).
   */
  formatLoanCode(codigoReferencia: number): string {
    return `#${String(codigoReferencia).padStart(4, '0')}`;
  }

  /**
   * Construye la leyenda de marca de agua dinámica (Figma pág. 14: "Ana Pérez · Préstamo #1024").
   */
  buildWatermark(usuarioNombre: string, codigoReferencia: number): string {
    return `${usuarioNombre} · Préstamo ${this.formatLoanCode(codigoReferencia)}`;
  }

  /**
   * Núcleo de verificación DRM del Diagrama de Secuencia (Figura 3):
   * 1. Extrae y verifica criptográficamente el token (DRM JWT o Session JWT).
   * 2. Comprueba expiración del JWT y estado ACTIVO + fechaVencimiento en PostgreSQL.
   * 3. Si el préstamo venció o fue revocado, responde determinísticamente con 403 Forbidden:
   *    "El préstamo ha vencido o fue revocado".
   */
  private async resolveAndVerifyDrmAccess(params: {
    expectedDocumentoId?: string;
    expectedPrestamoId?: string;
    rawToken?: string;
  }): Promise<ValidatedDrmAccess> {
    const token = this.cleanBearerToken(params.rawToken);

    if (!token) {
      throw new UnauthorizedException(
        'Token de acceso temporal DRM ausente. Debe enviar el token en el encabezado Authorization: Bearer <tokenAcceso>.',
      );
    }

    // Paso 1: Intentar verificar como Token DRM de 7 días (LOAN_DRM_JWT_SECRET)
    const drmVerification = await this.tryVerifyDrmJwt(token);

    if (drmVerification.isDrmToken && drmVerification.payload) {
      const payload = drmVerification.payload;

      if (
        params.expectedDocumentoId &&
        payload.documentoId !== params.expectedDocumentoId &&
        payload.docId !== params.expectedDocumentoId
      ) {
        throw new ForbiddenException(
          'El token de acceso temporal DRM presentado corresponde a otro documento académico.',
        );
      }

      if (
        params.expectedPrestamoId &&
        payload.prestamoId !== params.expectedPrestamoId
      ) {
        throw new ForbiddenException(
          'El token de acceso temporal DRM presentado corresponde a otro préstamo.',
        );
      }

      // Verificar estado en base de datos y vigencia temporal
      const esVigenteEnDb = await this.validarVigencia(payload.prestamoId);

      if (drmVerification.isJwtExpired || !esVigenteEnDb) {
        // Si el JWT expiró pero en DB aún figuraba ACTIVO, lo pasamos a VENCIDO
        if (drmVerification.isJwtExpired) {
          await this.prisma.prestamo.updateMany({
            where: {
              id: payload.prestamoId,
              estado: EstadoPrestamo.ACTIVO,
            },
            data: {
              estado: EstadoPrestamo.VENCIDO,
            },
          });
        }

        throw new ForbiddenException(
          'El préstamo ha vencido o fue revocado. El acceso al documento ha sido bloqueado.',
        );
      }

      return this.buildValidatedDrmAccess(payload.prestamoId);
    }

    // Paso 2: Fallback si el cliente envió su JWT de sesión regular (JWT_SECRET)
    const sessionPayload = await this.tryVerifySessionJwt(token);

    if (sessionPayload) {
      const whereClause: Prisma.PrestamoWhereInput = {
        ...(params.expectedPrestamoId ? { id: params.expectedPrestamoId } : {}),
        ...(params.expectedDocumentoId
          ? { documentoId: params.expectedDocumentoId }
          : {}),
        ...(sessionPayload.rol !== RolUsuario.ADMINISTRADOR
          ? { usuarioId: sessionPayload.sub }
          : {}),
      };

      const prestamo = await this.prisma.prestamo.findFirst({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          usuarioId: true,
          estado: true,
          fechaVencimiento: true,
        },
      });

      if (!prestamo) {
        throw new ForbiddenException(
          'No posee un préstamo activo vigente para visualizar este documento académico.',
        );
      }

      if (
        sessionPayload.rol !== RolUsuario.ADMINISTRADOR &&
        prestamo.usuarioId !== sessionPayload.sub
      ) {
        throw new ForbiddenException(
          'No tiene permisos para acceder al contenido de un préstamo perteneciente a otro usuario.',
        );
      }

      const esVigente = await this.validarVigencia(prestamo.id);
      if (!esVigente) {
        throw new ForbiddenException(
          'El préstamo ha vencido o fue revocado. El acceso al documento ha sido bloqueado.',
        );
      }

      return this.buildValidatedDrmAccess(prestamo.id);
    }

    throw new UnauthorizedException(
      'Token de acceso DRM inválido o firma criptográfica no reconocida.',
    );
  }

  private async tryVerifyDrmJwt(token: string): Promise<{
    isDrmToken: boolean;
    isJwtExpired: boolean;
    payload?: LoanDrmJwtPayload;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync<LoanDrmJwtPayload>(
        token,
        {
          secret: this.loanDrmSecret,
          ignoreExpiration: true,
        },
      );

      if (!payload || payload.type !== 'LOAN_DRM_7D' || !payload.prestamoId) {
        return { isDrmToken: false, isJwtExpired: false };
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const isJwtExpired =
        typeof payload.exp === 'number' && payload.exp <= nowSeconds;

      return {
        isDrmToken: true,
        isJwtExpired,
        payload,
      };
    } catch {
      return { isDrmToken: false, isJwtExpired: false };
    }
  }

  private async tryVerifySessionJwt(token: string): Promise<JwtPayload | null> {
    if (!this.sessionJwtSecret) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.sessionJwtSecret,
        ignoreExpiration: false,
      });

      if (payload && payload.sub && payload.email && payload.rol) {
        return payload;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async buildValidatedDrmAccess(
    prestamoId: string,
  ): Promise<ValidatedDrmAccess> {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: this.getPrestamoInclude(),
    });

    if (!prestamo) {
      throw new NotFoundException('El registro del préstamo ya no existe.');
    }

    if (
      prestamo.usuario.estadoValidacion !== EstadoValidacionUsuario.APROBADO
    ) {
      throw new ForbiddenException(
        'La cuenta del usuario titular ya no se encuentra habilitada por Biblioteca.',
      );
    }

    const timing = this.calculateRemainingTime(
      prestamo.estado,
      prestamo.fechaVencimiento,
    );

    if (!timing.vigente) {
      throw new ForbiddenException(
        'El préstamo ha vencido o fue revocado. El acceso al documento ha sido bloqueado.',
      );
    }

    // Garantizamos que el archivo exista en el almacenamiento privado
    const pdfExiste = await this.pdfStorageService.pdfExists(
      prestamo.documento.archivoUrl,
    );
    if (!pdfExiste) {
      throw new NotFoundException(
        `El archivo PDF privado asociado al documento "${prestamo.documento.titulo}" no se encuentra en el almacenamiento seguro.`,
      );
    }

    const codigoFormateado = this.formatLoanCode(prestamo.codigoReferencia);
    const marcaAgua = this.buildWatermark(
      prestamo.usuario.nombre,
      prestamo.codigoReferencia,
    );

    return {
      prestamoId: prestamo.id,
      codigoReferencia: prestamo.codigoReferencia,
      codigoFormateado,
      usuarioId: prestamo.usuario.id,
      usuarioNombre: prestamo.usuario.nombre,
      usuarioEmail: prestamo.usuario.email,
      departamentoNombre: prestamo.usuario.departamento.nombre,
      documentoId: prestamo.documento.id,
      documentoTitulo: prestamo.documento.titulo,
      documentoAutor: prestamo.documento.autor,
      documentoCarrera: prestamo.documento.carrera,
      documentoTipo: prestamo.documento.tipo,
      documentoAnio: prestamo.documento.anio,
      archivoUrl: prestamo.documento.archivoUrl,
      fechaInicio: prestamo.fechaInicio,
      fechaVencimiento: prestamo.fechaVencimiento,
      diasRestantes: timing.diasRestantes,
      horasRestantes: timing.horasRestantes,
      segundosRestantes: timing.segundosRestantes,
      porVencer24h: timing.porVencer24h,
      marcaAgua,
    };
  }

  private cleanBearerToken(raw?: string): string | undefined {
    if (!raw) {
      return undefined;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }

  private calculateRemainingTime(
    estado: EstadoPrestamo,
    fechaVencimiento: Date,
  ): {
    vigente: boolean;
    diasRestantes: number;
    horasRestantes: number;
    segundosRestantes: number;
    porVencer24h: boolean;
  } {
    const diffMs = fechaVencimiento.getTime() - Date.now();
    const vigente = LoanStateMachine.allowsReading(estado) && diffMs > 0;

    if (!vigente) {
      return {
        vigente: false,
        diasRestantes: 0,
        horasRestantes: 0,
        segundosRestantes: 0,
        porVencer24h: false,
      };
    }

    const segundosRestantes = Math.max(1, Math.ceil(diffMs / 1000));
    const horasRestantes = Math.max(1, Math.ceil(diffMs / MS_PER_HOUR));
    const diasRestantes = Math.max(1, Math.ceil(diffMs / MS_PER_DAY));
    const porVencer24h = diffMs <= 24 * MS_PER_HOUR;

    return {
      vigente: true,
      diasRestantes,
      horasRestantes,
      segundosRestantes,
      porVencer24h,
    };
  }

  private buildDrmRestrictions(marcaAgua: string): LoanDrmRestrictionsDto {
    return {
      permitirDescarga: false,
      permitirImpresion: false,
      permitirCopia: false,
      duracionMaximaDias: this.loanDurationDays,
      marcaAgua,
    };
  }

  private getPrestamoInclude() {
    return {
      usuario: {
        select: {
          id: true,
          nombre: true,
          email: true,
          estadoValidacion: true,
          departamento: {
            select: {
              id: true,
              nombre: true,
              esCapital: true,
            },
          },
        },
      },
      documento: {
        select: {
          id: true,
          titulo: true,
          autor: true,
          director: true,
          carrera: true,
          tipo: true,
          anio: true,
          archivoUrl: true,
          disponible: true,
          departamentoOrigen: {
            select: {
              id: true,
              nombre: true,
              esCapital: true,
            },
          },
        },
      },
    };
  }

  private toLoanItemDto(
    prestamo: PrestamoWithRelations,
    includeTokenIfActive: boolean,
  ): LoanItemDto {
    const timing = this.calculateRemainingTime(
      prestamo.estado,
      prestamo.fechaVencimiento,
    );
    const codigoFormateado = this.formatLoanCode(prestamo.codigoReferencia);
    const marcaAgua = this.buildWatermark(
      prestamo.usuario.nombre,
      prestamo.codigoReferencia,
    );

    return {
      id: prestamo.id,
      codigoReferencia: prestamo.codigoReferencia,
      codigoFormateado,
      estado: prestamo.estado,
      fechaInicio: prestamo.fechaInicio,
      fechaVencimiento: prestamo.fechaVencimiento,
      vigente: timing.vigente,
      diasRestantes: timing.diasRestantes,
      horasRestantes: timing.horasRestantes,
      porVencer24h: timing.porVencer24h,
      marcaAgua,
      visorUrl: `/api/v1/documentos/${prestamo.documento.id}/ver`,
      contenidoUrl: `/api/v1/prestamos/${prestamo.id}/contenido`,
      ...(includeTokenIfActive
        ? { tokenAcceso: timing.vigente ? prestamo.tokenAcceso : null }
        : {}),
      usuario: {
        id: prestamo.usuario.id,
        nombre: prestamo.usuario.nombre,
        email: prestamo.usuario.email,
        departamento: prestamo.usuario.departamento,
      },
      documento: {
        id: prestamo.documento.id,
        titulo: prestamo.documento.titulo,
        autor: prestamo.documento.autor,
        director: prestamo.documento.director,
        carrera: prestamo.documento.carrera,
        tipo: prestamo.documento.tipo,
        anio: prestamo.documento.anio,
        disponible: prestamo.documento.disponible,
        departamentoOrigen: prestamo.documento.departamentoOrigen,
      },
      createdAt: prestamo.createdAt,
      updatedAt: prestamo.updatedAt,
    };
  }
}
