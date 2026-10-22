import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EstadoPrestamo,
  TipoDocumento,
  TipoNotificacion,
} from '@prisma/client';

export class NotificationLoanDocumentSummaryDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  id!: string;

  @ApiProperty({ example: 'Vivienda social en Cuyo' })
  titulo!: string;

  @ApiProperty({ example: 'L. Martínez' })
  autor!: string;

  @ApiProperty({ example: 'Arquitectura' })
  carrera!: string;

  @ApiProperty({ enum: TipoDocumento, example: TipoDocumento.INVESTIGACION })
  tipo!: TipoDocumento;

  @ApiProperty({ example: 2021 })
  anio!: number;
}

export class NotificationLoanUserSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  nombre!: string;

  @ApiProperty({ example: 'ana.perez@jachal.gov.ar' })
  email!: string;

  @ApiProperty({ example: 'Jáchal' })
  departamentoNombre!: string;
}

export class NotificationLoanSummaryDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ example: 1024 })
  codigoReferencia!: number;

  @ApiProperty({ example: '#1024' })
  codigoFormateado!: string;

  @ApiProperty({ enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO })
  estado!: EstadoPrestamo;

  @ApiProperty({ example: '2026-10-16T10:00:00.000Z' })
  fechaInicio!: Date;

  @ApiProperty({ example: '2026-10-23T10:00:00.000Z' })
  fechaVencimiento!: Date;

  @ApiProperty({ type: () => NotificationLoanUserSummaryDto })
  usuario!: NotificationLoanUserSummaryDto;

  @ApiProperty({ type: () => NotificationLoanDocumentSummaryDto })
  documento!: NotificationLoanDocumentSummaryDto;
}

export class NotificationItemDto {
  @ApiProperty({ example: 'b3d21480-9a21-4e7b-b831-98a472e1c301' })
  id!: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  prestamoId!: string;

  @ApiProperty({
    enum: TipoNotificacion,
    example: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
  })
  tipo!: TipoNotificacion;

  @ApiPropertyOptional({
    nullable: true,
    example:
      'Recordatorio de vencimiento (24h): El préstamo #1024 sobre "Vivienda social en Cuyo" vencerá en 18 hora(s).',
  })
  mensaje!: string | null;

  @ApiProperty({ example: '2026-10-22T10:00:00.000Z' })
  fechaEnvio!: Date;

  @ApiProperty({ example: false })
  leida!: boolean;

  @ApiProperty({ type: () => NotificationLoanSummaryDto })
  prestamo!: NotificationLoanSummaryDto;
}

export class NotificationCountersDto {
  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 2 })
  noLeidas!: number;

  @ApiProperty({ example: 2 })
  leidas!: number;

  @ApiProperty({
    description: 'Desglose de notificaciones por TipoNotificacion',
    example: {
      CUENTA_APROBADA: 0,
      PRESTAMO_OTORGADO: 2,
      PROXIMO_VENCIMIENTO_24H: 1,
      PRESTAMO_VENCIDO: 1,
      PRESTAMO_REVOCADO: 0,
    },
  })
  porTipo!: Record<TipoNotificacion, number>;
}

export class NotificationsPaginationMetaDto {
  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class NotificationsListResponseDto {
  @ApiProperty({ type: () => NotificationCountersDto })
  contadores!: NotificationCountersDto;

  @ApiProperty({ type: () => NotificationsPaginationMetaDto })
  meta!: NotificationsPaginationMetaDto;

  @ApiProperty({ type: () => [NotificationItemDto] })
  items!: NotificationItemDto[];
}

export class MarkNotificationReadResponseDto {
  @ApiProperty({
    example: 'La notificación fue marcada como leída correctamente.',
  })
  message!: string;

  @ApiProperty({ type: () => NotificationItemDto })
  notificacion!: NotificationItemDto;
}

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty({
    example: 'Se marcaron 3 notificación(es) como leídas.',
  })
  message!: string;

  @ApiProperty({ example: 3 })
  actualizadas!: number;
}

export class CronProcessedLoanItemDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  prestamoId!: string;

  @ApiProperty({ example: '#1024' })
  codigoFormateado!: string;

  @ApiProperty({ example: 'ana.perez@jachal.gov.ar' })
  usuarioEmail!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  usuarioNombre!: string;

  @ApiProperty({ example: 'Jáchal' })
  departamentoNombre!: string;

  @ApiProperty({ example: 'Vivienda social en Cuyo' })
  documentoTitulo!: string;

  @ApiProperty({ example: '2026-10-23T10:00:00.000Z' })
  fechaVencimiento!: Date;

  @ApiProperty({ enum: TipoNotificacion })
  tipoNotificacion!: TipoNotificacion;

  @ApiProperty({ example: 'b3d21480-9a21-4e7b-b831-98a472e1c301' })
  notificacionId!: string;

  @ApiProperty({ example: true })
  correoEnviado!: boolean;
}

export class CronExecutionSummaryResponseDto {
  @ApiProperty({
    example:
      'Ciclo de control continuo de vigencia y notificaciones ejecutado correctamente (Figura 4 — RF06).',
  })
  message!: string;

  @ApiProperty({ example: '2026-10-22T10:35:00.000Z' })
  timestamp!: Date;

  @ApiProperty({
    description:
      'Cantidad de préstamos que cumplieron los 7 días y pasaron de ACTIVO a VENCIDO',
    example: 1,
  })
  prestamosVencidosProcesados!: number;

  @ApiProperty({
    description:
      'Cantidad de recordatorios tempranos (24h antes del vencimiento) generados',
    example: 1,
  })
  alertas24hGeneradas!: number;

  @ApiProperty({
    description:
      'Cantidad de correos electrónicos despachados exitosamente vía SMTP / Mailpit',
    example: 2,
  })
  correosEnviados!: number;

  @ApiProperty({ type: () => [CronProcessedLoanItemDto] })
  detalleVencidos!: CronProcessedLoanItemDto[];

  @ApiProperty({ type: () => [CronProcessedLoanItemDto] })
  detalleAlertas24h!: CronProcessedLoanItemDto[];
}
