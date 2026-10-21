import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoValidacionUsuario } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: EstadoValidacionUsuario,
    example: EstadoValidacionUsuario.APROBADO,
    description:
      'Nuevo estado de validación para la cuenta del usuario (APROBADO, RECHAZADO o PENDIENTE)',
  })
  @IsEnum(EstadoValidacionUsuario, {
    message:
      'El estado debe ser uno de los siguientes valores: PENDIENTE, APROBADO, RECHAZADO.',
  })
  @IsNotEmpty({ message: 'El estado de validación es obligatorio.' })
  estado!: EstadoValidacionUsuario;

  @ApiPropertyOptional({
    example:
      'Documentación y pertenencia departamental verificadas por Biblioteca FAUD.',
    description:
      'Observación o motivo opcional de la aprobación/rechazo administrativo',
  })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  motivo?: string;
}
