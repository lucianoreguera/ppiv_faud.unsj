import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  EstadoPrestamo,
  Prisma,
  RolUsuario,
  TipoDocumento,
  TipoNotificacion,
} from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { LoanStateMachine } from '../loans/loan-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import {
  CronExecutionSummaryResponseDto,
  CronProcessedLoanItemDto,
  MarkAllNotificationsReadResponseDto,
  MarkNotificationReadResponseDto,
  NotificationCountersDto,
  NotificationItemDto,
  NotificationsListResponseDto,
} from './dto/notification-response.dto';
import {
  MarkNotificationReadDto,
  QueryAdminNotificationsDto,
  QueryNotificationsDto,
} from './dto/query-notifications.dto';
import { EmailService } from './email.service';

const MS_PER_HOUR = 1000 * 60 * 60;

type NotificacionWithLoanRelations = {
  id: string;
  prestamoId: string;
  tipo: TipoNotificacion;
  mensaje: string | null;
  fechaEnvio: Date;
  leida: boolean;
  prestamo: {
    id: string;
    codigoReferencia: number;
    usuarioId: string;
    estado: EstadoPrestamo;
    fechaInicio: Date;
    fechaVencimiento: Date;
    usuario: {
      id: string;
      nombre: string;
      email: string;
      departamento: {
        nombre: string;
      };
    };
    documento: {
      id: string;
      titulo: string;
      autor: string;
      carrera: string;
      tipo: TipoDocumento;
      anio: number;
    };
  };
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Job programado de Vencimiento Automático (Figura 4 y Figura 5 — RF06).
   * Se ejecuta periódicamente cada 5 minutos para detectar préstamos en estado ACTIVO
   * cuya `fechaVencimiento <= now()`, transicionarlos a VENCIDO y notificar al usuario.
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'faud-loan-expiration-job',
  })
  async handleCronVencimientosAutomaticos(): Promise<void> {
    const vencidos = await this.procesarPrestamosVencidos();
    if (vencidos.length > 0) {
      this.logger.log(
        `[Cron Vencimientos] ${vencidos.length} préstamo(s) pasaron automáticamente a VENCIDO y fueron notificados.`,
      );
    }
  }

  /**
   * Job programado de Alerta Temprana 24 horas antes del vencimiento (Figura 4 — RF06).
   * Se ejecuta periódicamente cada 10 minutos para detectar préstamos en estado ACTIVO
   * que vencen en las próximas 24 horas sin recordatorio previo y ejecutar `enviarRecordatorio()`.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'faud-loan-24h-reminder-job',
  })
  async handleCronAlertasTempranas24h(): Promise<void> {
    const alertas = await this.procesarAlertasVencimiento24h();
    if (alertas.length > 0) {
      this.logger.log(
        `[Cron Alerta 24h] ${alertas.length} recordatorio(s) de vencimiento próximo (24h) generados y enviados.`,
      );
    }
  }

  /**
   * Ejecuta de forma integral el ciclo del Diagrama de Actividades (Figura 4 — Control Continuo de Vigencia):
   * 1. Procesa préstamos cuyo plazo de 7 días ha expirado (`ACTIVO -> VENCIDO` + `PRESTAMO_VENCIDO`).
   * 2. Procesa préstamos activos que vencen en <= 24h sin aviso previo (`PROXIMO_VENCIMIENTO_24H` + `enviarRecordatorio()`).
   */
  async ejecutarControlVigencia(): Promise<CronExecutionSummaryResponseDto> {
    const timestamp = new Date();
    const detalleVencidos = await this.procesarPrestamosVencidos();
    const detalleAlertas24h = await this.procesarAlertasVencimiento24h();

    const correosEnviados =
      detalleVencidos.filter((item) => item.correoEnviado).length +
      detalleAlertas24h.filter((item) => item.correoEnviado).length;

    return {
      message:
        'Ciclo de control continuo de vigencia y notificaciones ejecutado correctamente (Figura 4 — RF06).',
      timestamp,
      prestamosVencidosProcesados: detalleVencidos.length,
      alertas24hGeneradas: detalleAlertas24h.length,
      correosEnviados,
      detalleVencidos,
      detalleAlertas24h,
    };
  }

  /**
   * Busca todos los préstamos en estado ACTIVO cuya `fechaVencimiento <= now()`
   * (o aquellos ya marcados como VENCIDO sin notificación de cierre),
   * aplica la transición `ACTIVO -> VENCIDO`, crea la notificación `PRESTAMO_VENCIDO`
   * y envía el correo electrónico de finalización.
   */
  async procesarPrestamosVencidos(): Promise<CronProcessedLoanItemDto[]> {
    const now = new Date();

    const prestamosParaVencer = await this.prisma.prestamo.findMany({
      where: {
        OR: [
          {
            estado: EstadoPrestamo.ACTIVO,
            fechaVencimiento: {
              lte: now,
            },
          },
          {
            estado: EstadoPrestamo.VENCIDO,
            notificaciones: {
              none: {
                tipo: TipoNotificacion.PRESTAMO_VENCIDO,
              },
            },
          },
        ],
      },
      include: {
        usuario: {
          include: {
            departamento: true,
          },
        },
        documento: true,
        notificaciones: {
          where: {
            tipo: TipoNotificacion.PRESTAMO_VENCIDO,
          },
        },
      },
      orderBy: {
        fechaVencimiento: 'asc',
      },
    });

    const procesados: CronProcessedLoanItemDto[] = [];

    for (const prestamo of prestamosParaVencer) {
      if (prestamo.estado === EstadoPrestamo.ACTIVO) {
        LoanStateMachine.assertTransition(
          EstadoPrestamo.ACTIVO,
          EstadoPrestamo.VENCIDO,
        );

        await this.prisma.prestamo.update({
          where: { id: prestamo.id },
          data: {
            estado: EstadoPrestamo.VENCIDO,
          },
        });
      }

      const codigoFormateado = this.formatLoanCode(prestamo.codigoReferencia);
      let notificacion = prestamo.notificaciones[0];

      if (!notificacion) {
        notificacion = await this.prisma.notificacion.create({
          data: {
            prestamoId: prestamo.id,
            tipo: TipoNotificacion.PRESTAMO_VENCIDO,
            mensaje: `El plazo de 7 días del préstamo ${codigoFormateado} sobre "${prestamo.documento.titulo}" ha expirado automáticamente. El acceso de visualización ha finalizado.`,
            leida: false,
          },
        });
      }

      const emailResult = await this.emailService.sendLoanExpiredEmail({
        to: prestamo.usuario.email,
        usuarioNombre: prestamo.usuario.nombre,
        departamentoNombre: prestamo.usuario.departamento.nombre,
        codigoFormateado,
        documentoTitulo: prestamo.documento.titulo,
        documentoAutor: prestamo.documento.autor,
        fechaVencimiento: prestamo.fechaVencimiento,
      });

      procesados.push({
        prestamoId: prestamo.id,
        codigoFormateado,
        usuarioEmail: prestamo.usuario.email,
        usuarioNombre: prestamo.usuario.nombre,
        departamentoNombre: prestamo.usuario.departamento.nombre,
        documentoTitulo: prestamo.documento.titulo,
        fechaVencimiento: prestamo.fechaVencimiento,
        tipoNotificacion: TipoNotificacion.PRESTAMO_VENCIDO,
        notificacionId: notificacion.id,
        correoEnviado: emailResult.sent,
      });
    }

    return procesados;
  }

  /**
   * Busca todos los préstamos en estado ACTIVO que vencen dentro de las próximas 24 horas
   * (`now() < fechaVencimiento <= now() + 24h`) y que aún no posean la notificación
   * `PROXIMO_VENCIMIENTO_24H`, invocando `enviarRecordatorio()` para cada uno (RF06).
   */
  async procesarAlertasVencimiento24h(): Promise<CronProcessedLoanItemDto[]> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * MS_PER_HOUR);

    const prestamosPorVencer = await this.prisma.prestamo.findMany({
      where: {
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: {
          gt: now,
          lte: in24Hours,
        },
        notificaciones: {
          none: {
            tipo: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
          },
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        fechaVencimiento: 'asc',
      },
    });

    const alertas: CronProcessedLoanItemDto[] = [];

    for (const item of prestamosPorVencer) {
      const resultado = await this.enviarRecordatorio(item.id);
      alertas.push(resultado);
    }

    return alertas;
  }

  /**
   * Implementa el método de dominio `enviarRecordatorio()` del Diagrama de Clases (Figura 2)
   * y Diagrama de Actividades (Figura 4 — RF06).
   * Registra de forma idempotente la entidad `Notificacion` (`PROXIMO_VENCIMIENTO_24H`)
   * y despacha el correo electrónico de aviso previo al prestatario.
   */
  async enviarRecordatorio(
    prestamoId: string,
  ): Promise<CronProcessedLoanItemDto> {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        usuario: {
          include: {
            departamento: true,
          },
        },
        documento: true,
        notificaciones: {
          where: {
            tipo: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
          },
        },
      },
    });

    if (!prestamo) {
      throw new NotFoundException(
        `No se encontró ningún préstamo con ID "${prestamoId}".`,
      );
    }

    const codigoFormateado = this.formatLoanCode(prestamo.codigoReferencia);
    const diffMs = prestamo.fechaVencimiento.getTime() - Date.now();
    const horasRestantes = Math.max(1, Math.ceil(diffMs / MS_PER_HOUR));

    // Idempotencia: si ya fue enviado el recordatorio 24h para este préstamo, no duplicar
    if (prestamo.notificaciones.length > 0) {
      const existente = prestamo.notificaciones[0];
      return {
        prestamoId: prestamo.id,
        codigoFormateado,
        usuarioEmail: prestamo.usuario.email,
        usuarioNombre: prestamo.usuario.nombre,
        departamentoNombre: prestamo.usuario.departamento.nombre,
        documentoTitulo: prestamo.documento.titulo,
        fechaVencimiento: prestamo.fechaVencimiento,
        tipoNotificacion: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
        notificacionId: existente.id,
        correoEnviado: false,
      };
    }

    const notificacion = await this.prisma.notificacion.create({
      data: {
        prestamoId: prestamo.id,
        tipo: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
        mensaje: `Recordatorio de vencimiento (24h): El préstamo ${codigoFormateado} sobre "${prestamo.documento.titulo}" vencerá en aproximadamente ${horasRestantes} hora(s).`,
        leida: false,
      },
    });

    const emailResult = await this.emailService.sendExpirationReminder24hEmail({
      to: prestamo.usuario.email,
      usuarioNombre: prestamo.usuario.nombre,
      departamentoNombre: prestamo.usuario.departamento.nombre,
      codigoFormateado,
      documentoTitulo: prestamo.documento.titulo,
      documentoAutor: prestamo.documento.autor,
      fechaVencimiento: prestamo.fechaVencimiento,
      horasRestantes,
    });

    return {
      prestamoId: prestamo.id,
      codigoFormateado,
      usuarioEmail: prestamo.usuario.email,
      usuarioNombre: prestamo.usuario.nombre,
      departamentoNombre: prestamo.usuario.departamento.nombre,
      documentoTitulo: prestamo.documento.titulo,
      fechaVencimiento: prestamo.fechaVencimiento,
      tipoNotificacion: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
      notificacionId: notificacion.id,
      correoEnviado: emailResult.sent,
    };
  }

  /**
   * Lista las notificaciones del usuario autenticado (`GET /api/v1/notificaciones`),
   * incluyendo contadores de lectura (`noLeidas`, `leidas`) y desglose por tipo.
   */
  async findMyNotifications(
    usuarioId: string,
    query: QueryNotificationsDto,
  ): Promise<NotificationsListResponseDto> {
    const baseScopeWhere: Prisma.NotificacionWhereInput = {
      prestamo: {
        usuarioId,
      },
    };

    return this.queryNotificationsWithCounters(baseScopeWhere, query);
  }

  /**
   * Lista todas las notificaciones del sistema para auditoría de Biblioteca (`GET /api/v1/notificaciones/admin`).
   */
  async findAllForAdmin(
    query: QueryAdminNotificationsDto,
  ): Promise<NotificationsListResponseDto> {
    const baseScopeWhere: Prisma.NotificacionWhereInput = query.usuarioId
      ? {
          prestamo: {
            usuarioId: query.usuarioId,
          },
        }
      : {};

    return this.queryNotificationsWithCounters(baseScopeWhere, query);
  }

  /**
   * Obtiene el detalle de una notificación específica validando titularidad o rol ADMINISTRADOR.
   */
  async findOne(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<NotificationItemDto> {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id },
      include: this.getNotificationInclude(),
    });

    if (!notificacion) {
      throw new NotFoundException(
        `No se encontró ninguna notificación con ID "${id}".`,
      );
    }

    const isOwner = notificacion.prestamo.usuarioId === requester.id;
    const isAdmin = requester.rol === RolUsuario.ADMINISTRADOR;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'No tiene permisos para consultar una notificación perteneciente a otro usuario.',
      );
    }

    return this.toNotificationItemDto(notificacion);
  }

  /**
   * Marca una notificación como leída (o actualiza su bandera `leida`) (`PATCH /api/v1/notificaciones/:id/leida`).
   */
  async markAsRead(
    id: string,
    requester: AuthenticatedUser,
    dto?: MarkNotificationReadDto,
  ): Promise<MarkNotificationReadResponseDto> {
    const existente = await this.prisma.notificacion.findUnique({
      where: { id },
      include: this.getNotificationInclude(),
    });

    if (!existente) {
      throw new NotFoundException(
        `No se encontró ninguna notificación con ID "${id}".`,
      );
    }

    const isOwner = existente.prestamo.usuarioId === requester.id;
    const isAdmin = requester.rol === RolUsuario.ADMINISTRADOR;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'No tiene permisos para modificar una notificación perteneciente a otro usuario.',
      );
    }

    const targetReadState = dto?.leida ?? true;

    const actualizada = await this.prisma.notificacion.update({
      where: { id },
      data: {
        leida: targetReadState,
      },
      include: this.getNotificationInclude(),
    });

    return {
      message: targetReadState
        ? 'La notificación fue marcada como leída correctamente.'
        : 'La notificación fue marcada como no leída.',
      notificacion: this.toNotificationItemDto(actualizada),
    };
  }

  /**
   * Marca todas las notificaciones pendientes del usuario autenticado como leídas (`PATCH /api/v1/notificaciones/marcar-todas-leidas`).
   */
  async markAllAsRead(
    usuarioId: string,
  ): Promise<MarkAllNotificationsReadResponseDto> {
    const result = await this.prisma.notificacion.updateMany({
      where: {
        leida: false,
        prestamo: {
          usuarioId,
        },
      },
      data: {
        leida: true,
      },
    });

    return {
      message: `Se marcaron ${result.count} notificación(es) como leídas.`,
      actualizadas: result.count,
    };
  }

  private async queryNotificationsWithCounters(
    baseScopeWhere: Prisma.NotificacionWhereInput,
    query: QueryNotificationsDto,
  ): Promise<NotificationsListResponseDto> {
    const filteredWhere: Prisma.NotificacionWhereInput = {
      ...baseScopeWhere,
      ...(query.leida !== undefined ? { leida: query.leida } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.prestamoId ? { prestamoId: query.prestamoId } : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, totalFiltered, groupedByRead, groupedByType] =
      await Promise.all([
        this.prisma.notificacion.findMany({
          where: filteredWhere,
          skip,
          take: limit,
          orderBy: [{ fechaEnvio: 'desc' }],
          include: this.getNotificationInclude(),
        }),
        this.prisma.notificacion.count({ where: filteredWhere }),
        this.prisma.notificacion.groupBy({
          by: ['leida'],
          where: baseScopeWhere,
          _count: { _all: true },
        }),
        this.prisma.notificacion.groupBy({
          by: ['tipo'],
          where: baseScopeWhere,
          _count: { _all: true },
        }),
      ]);

    let leidas = 0;
    let noLeidas = 0;
    for (const row of groupedByRead) {
      if (row.leida) {
        leidas = row._count._all;
      } else {
        noLeidas = row._count._all;
      }
    }

    const porTipo: Record<TipoNotificacion, number> = {
      [TipoNotificacion.CUENTA_APROBADA]: 0,
      [TipoNotificacion.PRESTAMO_OTORGADO]: 0,
      [TipoNotificacion.PROXIMO_VENCIMIENTO_24H]: 0,
      [TipoNotificacion.PRESTAMO_VENCIDO]: 0,
      [TipoNotificacion.PRESTAMO_REVOCADO]: 0,
    };

    for (const row of groupedByType) {
      porTipo[row.tipo] = row._count._all;
    }

    const contadores: NotificationCountersDto = {
      total: leidas + noLeidas,
      noLeidas,
      leidas,
      porTipo,
    };

    const totalPages =
      totalFiltered === 0 ? 0 : Math.ceil(totalFiltered / limit);

    return {
      contadores,
      meta: {
        total: totalFiltered,
        page,
        limit,
        totalPages,
      },
      items: items.map((n) => this.toNotificationItemDto(n)),
    };
  }

  private getNotificationInclude() {
    return {
      prestamo: {
        select: {
          id: true,
          codigoReferencia: true,
          usuarioId: true,
          estado: true,
          fechaInicio: true,
          fechaVencimiento: true,
          usuario: {
            select: {
              id: true,
              nombre: true,
              email: true,
              departamento: {
                select: {
                  nombre: true,
                },
              },
            },
          },
          documento: {
            select: {
              id: true,
              titulo: true,
              autor: true,
              carrera: true,
              tipo: true,
              anio: true,
            },
          },
        },
      },
    };
  }

  private toNotificationItemDto(
    notificacion: NotificacionWithLoanRelations,
  ): NotificationItemDto {
    const codigoFormateado = this.formatLoanCode(
      notificacion.prestamo.codigoReferencia,
    );

    return {
      id: notificacion.id,
      prestamoId: notificacion.prestamoId,
      tipo: notificacion.tipo,
      mensaje: notificacion.mensaje,
      fechaEnvio: notificacion.fechaEnvio,
      leida: notificacion.leida,
      prestamo: {
        id: notificacion.prestamo.id,
        codigoReferencia: notificacion.prestamo.codigoReferencia,
        codigoFormateado,
        estado: notificacion.prestamo.estado,
        fechaInicio: notificacion.prestamo.fechaInicio,
        fechaVencimiento: notificacion.prestamo.fechaVencimiento,
        usuario: {
          id: notificacion.prestamo.usuario.id,
          nombre: notificacion.prestamo.usuario.nombre,
          email: notificacion.prestamo.usuario.email,
          departamentoNombre: notificacion.prestamo.usuario.departamento.nombre,
        },
        documento: {
          id: notificacion.prestamo.documento.id,
          titulo: notificacion.prestamo.documento.titulo,
          autor: notificacion.prestamo.documento.autor,
          carrera: notificacion.prestamo.documento.carrera,
          tipo: notificacion.prestamo.documento.tipo,
          anio: notificacion.prestamo.documento.anio,
        },
      },
    };
  }

  private formatLoanCode(codigoReferencia: number): string {
    return `#${String(codigoReferencia).padStart(4, '0')}`;
  }
}
