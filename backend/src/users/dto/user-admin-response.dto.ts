import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoValidacionUsuario } from '@prisma/client';
import { UserProfileResponseDto } from '../../auth/dto/auth-response.dto';

export class UserStatusCountersDto {
  @ApiProperty({
    example: 6,
    description: 'Total de usuarios registrados en el sistema',
  })
  todos!: number;

  @ApiProperty({
    example: 3,
    description:
      'Usuarios en estado PENDIENTE aguardando validación de Biblioteca (pestaña Pendientes en Figma)',
  })
  pendientes!: number;

  @ApiProperty({
    example: 3,
    description: 'Usuarios con cuenta APROBADA',
  })
  aprobados!: number;

  @ApiProperty({
    example: 0,
    description: 'Usuarios con solicitud RECHAZADA',
  })
  rechazados!: number;
}

export class UserAdminItemDto extends UserProfileResponseDto {
  @ApiProperty({
    example: 2,
    description: 'Cantidad histórica de préstamos asociados al usuario',
  })
  totalPrestamos!: number;
}

export class UsersListResponseDto {
  @ApiProperty({
    type: UserStatusCountersDto,
    description:
      'Contadores globales por estado de validación para las pestañas del Panel Admin de Biblioteca',
  })
  contadores!: UserStatusCountersDto;

  @ApiProperty({
    example: 3,
    description: 'Total de registros que coinciden con los filtros aplicados',
  })
  total!: number;

  @ApiProperty({
    type: [UserAdminItemDto],
    description: 'Listado de usuarios filtrados',
  })
  items!: UserAdminItemDto[];
}

export class UpdateUserStatusResponseDto {
  @ApiProperty({
    example:
      'El estado de validación del usuario Carlos Gómez (Valle Fértil) fue actualizado a APROBADO.',
    description: 'Mensaje de confirmación de la acción administrativa',
  })
  message!: string;

  @ApiProperty({
    enum: EstadoValidacionUsuario,
    example: EstadoValidacionUsuario.PENDIENTE,
    description: 'Estado previo de la cuenta',
  })
  estadoAnterior!: EstadoValidacionUsuario;

  @ApiProperty({
    enum: EstadoValidacionUsuario,
    example: EstadoValidacionUsuario.APROBADO,
    description: 'Nuevo estado asignado a la cuenta',
  })
  estadoActual!: EstadoValidacionUsuario;

  @ApiPropertyOptional({
    example: 'Pertenencia departamental verificada.',
    description: 'Observación administrativa opcional',
  })
  motivo?: string;

  @ApiProperty({
    type: UserAdminItemDto,
    description: 'Datos actualizados del usuario',
  })
  usuario!: UserAdminItemDto;
}
