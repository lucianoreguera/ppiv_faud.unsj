import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoValidacionUsuario, RolUsuario } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryUsersDto {
  @ApiPropertyOptional({
    enum: EstadoValidacionUsuario,
    description:
      'Filtrar por estado de validación administrativa (PENDIENTE, APROBADO, RECHAZADO)',
    example: EstadoValidacionUsuario.PENDIENTE,
  })
  @IsEnum(EstadoValidacionUsuario, {
    message:
      'El filtro de estado debe ser PENDIENTE, APROBADO o RECHAZADO.',
  })
  @IsOptional()
  estado?: EstadoValidacionUsuario;

  @ApiPropertyOptional({
    description: 'Filtrar por UUID del departamento de San Juan',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', {
    message: 'El filtro departamentoId debe ser un UUID v4 válido.',
  })
  @IsOptional()
  departamentoId?: string;

  @ApiPropertyOptional({
    enum: RolUsuario,
    description: 'Filtrar por rol del sistema (USUARIO o ADMINISTRADOR)',
    example: RolUsuario.USUARIO,
  })
  @IsEnum(RolUsuario, {
    message: 'El filtro de rol debe ser USUARIO o ADMINISTRADOR.',
  })
  @IsOptional()
  rol?: RolUsuario;

  @ApiPropertyOptional({
    description: 'Búsqueda libre por nombre o correo electrónico',
    example: 'vallefertil',
  })
  @IsString()
  @IsOptional()
  q?: string;
}
