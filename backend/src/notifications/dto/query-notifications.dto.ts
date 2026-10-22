import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoNotificacion } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const transformOptionalBoolean = ({
  value,
  obj,
  key,
}: {
  value: unknown;
  obj?: Record<string, unknown>;
  key?: string;
}) => {
  const raw = key && obj && key in obj ? obj[key] : value;
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  return value;
};

export class QueryNotificationsDto {
  @ApiPropertyOptional({
    description:
      'Filtrar notificaciones por estado de lectura (true = leídas, false = no leídas)',
    example: false,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({
    message: 'El filtro leida debe ser un valor booleano (true/false).',
  })
  leida?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar notificaciones por su tipo de evento',
    enum: TipoNotificacion,
    example: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
  })
  @IsOptional()
  @IsEnum(TipoNotificacion, {
    message: `El tipo de notificación debe ser uno de: ${Object.values(TipoNotificacion).join(', ')}`,
  })
  tipo?: TipoNotificacion;

  @ApiPropertyOptional({
    description: 'Filtrar notificaciones vinculadas a un préstamo específico',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'El filtro prestamoId debe ser un UUID v4 válido.',
  })
  prestamoId?: string;

  @ApiPropertyOptional({
    description: 'Número de página (comenzando en 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de notificaciones por página',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class QueryAdminNotificationsDto extends QueryNotificationsDto {
  @ApiPropertyOptional({
    description:
      'Filtrar notificaciones pertenecientes a un usuario específico (solo Admin)',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'El filtro usuarioId debe ser un UUID v4 válido.',
  })
  usuarioId?: string;
}

export class MarkNotificationReadDto {
  @ApiPropertyOptional({
    description:
      'Estado de lectura a establecer sobre la notificación (por defecto true)',
    default: true,
    example: true,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({
    message: 'El campo leida debe ser un valor booleano (true/false).',
  })
  leida?: boolean = true;
}
