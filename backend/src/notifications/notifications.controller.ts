import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  CronExecutionSummaryResponseDto,
  MarkAllNotificationsReadResponseDto,
  MarkNotificationReadResponseDto,
  NotificationItemDto,
  NotificationsListResponseDto,
} from './dto/notification-response.dto';
import {
  MarkNotificationReadDto,
  QueryAdminNotificationsDto,
  QueryNotificationsDto,
} from './dto/query-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificaciones y Tareas Programadas de Vigencia (RF06)')
@ApiBearerAuth('jwt-auth')
@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar las notificaciones del usuario autenticado con contadores de lectura (RF06)',
    description:
      'Devuelve la bandeja de notificaciones del estudiante/docente autenticado (`PRESTAMO_OTORGADO`, `PROXIMO_VENCIMIENTO_24H`, `PRESTAMO_VENCIDO`, `PRESTAMO_REVOCADO`), filtrable por estado de lectura (`leida`), `tipo` o `prestamoId`, junto con los contadores globales (`noLeidas`, `leidas`, `porTipo`).',
  })
  @ApiOkResponse({
    description: 'Bandeja de notificaciones del usuario y contadores.',
    type: NotificationsListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT de sesión ausente o inválido.',
  })
  async findMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ): Promise<NotificationsListResponseDto> {
    return this.notificationsService.findMyNotifications(user.id, query);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Listar historial global de notificaciones enviadas en el sistema (RF06 - Solo Admin)',
    description:
      'Permite al Administrador de Biblioteca auditar todas las notificaciones emitidas y filtrarlas por usuario, préstamo, tipo o estado de lectura.',
  })
  @ApiOkResponse({
    description: 'Listado paginado global de notificaciones y contadores.',
    type: NotificationsListResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async findAllForAdmin(
    @Query() query: QueryAdminNotificationsDto,
  ): Promise<NotificationsListResponseDto> {
    return this.notificationsService.findAllForAdmin(query);
  }

  @Patch('marcar-todas-leidas')
  @ApiOperation({
    summary:
      'Marcar todas las notificaciones pendientes del usuario autenticado como leídas (RF06)',
  })
  @ApiOkResponse({
    description: 'Cantidad de notificaciones actualizadas a leida = true.',
    type: MarkAllNotificationsReadResponseDto,
  })
  async markAllAsRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MarkAllNotificationsReadResponseDto> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Post('ejecutar-control-vigencia')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Ejecutar bajo demanda el ciclo de Control Continuo de Vigencia y Alertas 24h (Figura 4 — RF06, Solo Admin)',
    description:
      'Dispara inmediatamente los dos procesos programados del **Diagrama de Actividades (Figura 4)**: (1) pasa de `ACTIVO` a `VENCIDO` todos los préstamos cuya `fechaVencimiento <= now()`, registrando `PRESTAMO_VENCIDO` y enviando el email de cierre; (2) identifica los préstamos `ACTIVO` que vencen en las próximas 24 horas sin aviso previo y ejecuta `enviarRecordatorio()` (`PROXIMO_VENCIMIENTO_24H` + email en Mailpit/SMTP).',
  })
  @ApiOkResponse({
    description:
      'Resumen detallado de préstamos vencidos procesados, alertas tempranas de 24h generadas y correos despachados.',
    type: CronExecutionSummaryResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async triggerControlVigencia(): Promise<CronExecutionSummaryResponseDto> {
    return this.notificationsService.ejecutarControlVigencia();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener el detalle de una notificación por su UUID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la notificación',
  })
  @ApiOkResponse({
    description: 'Detalle de la notificación y su préstamo asociado.',
    type: NotificationItemDto,
  })
  @ApiNotFoundResponse({
    description: 'Notificación no encontrada.',
  })
  @ApiForbiddenResponse({
    description: 'La notificación pertenece a otro usuario.',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationItemDto> {
    return this.notificationsService.findOne(id, user);
  }

  @Patch(':id/leida')
  @ApiOperation({
    summary:
      'Marcar una notificación específica como leída (RF06 — PATCH /api/v1/notificaciones/:id/leida)',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la notificación a marcar como leída',
  })
  @ApiOkResponse({
    description: 'Notificación actualizada.',
    type: MarkNotificationReadResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Notificación no encontrada.',
  })
  @ApiForbiddenResponse({
    description: 'La notificación pertenece a otro usuario.',
  })
  async markAsRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto?: MarkNotificationReadDto,
  ): Promise<MarkNotificationReadResponseDto> {
    return this.notificationsService.markAsRead(id, user, dto);
  }
}
