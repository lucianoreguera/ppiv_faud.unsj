import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import {
  UpdateUserStatusResponseDto,
  UserAdminItemDto,
  UsersListResponseDto,
} from './dto/user-admin-response.dto';
import { UsersService } from './users.service';

@ApiTags('Gestión y Validación de Usuarios — Admin Biblioteca (RF05)')
@ApiBearerAuth('jwt-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios con filtros y contadores por estado (Solo Admin)',
    description:
      'Permite al Administrador de Biblioteca listar los usuarios registrados por departamento y estado (`PENDIENTE`, `APROBADO`, `RECHAZADO`), devolviendo además los contadores para las pestañas del Panel Admin (Figma pág. 8).',
  })
  @ApiOkResponse({
    description: 'Listado de usuarios y contadores de validación.',
    type: UsersListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT inválido o ausente.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async findAll(@Query() query: QueryUsersDto): Promise<UsersListResponseDto> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un usuario por su UUID (Solo Admin)',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del usuario a consultar',
  })
  @ApiOkResponse({
    description: 'Detalle del usuario.',
    type: UserAdminItemDto,
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado.',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserAdminItemDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary:
      'Aprobar o rechazar la cuenta de un usuario departamental (RF05 - Solo Admin)',
    description:
      'Cambia el `estadoValidacion` del usuario (`APROBADO`, `RECHAZADO` o `PENDIENTE`). Al pasar a `APROBADO`, el usuario queda habilitado para iniciar sesión y solicitar préstamos digitales.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del usuario a validar',
  })
  @ApiOkResponse({
    description: 'Estado de validación del usuario actualizado correctamente.',
    type: UpdateUserStatusResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Estado inválido o intento de deshabilitar la propia cuenta de administrador.',
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado.',
  })
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<UpdateUserStatusResponseDto> {
    return this.usersService.updateStatus(id, dto, admin.id);
  }
}
