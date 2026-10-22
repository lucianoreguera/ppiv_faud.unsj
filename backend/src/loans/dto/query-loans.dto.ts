import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPrestamo } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
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

export class QueryMyLoansDto {
  @ApiPropertyOptional({
    description:
      'Filtrar los préstamos del usuario autenticado por estado de la máquina de estados',
    enum: EstadoPrestamo,
    example: EstadoPrestamo.ACTIVO,
  })
  @IsOptional()
  @IsEnum(EstadoPrestamo, {
    message: `El estado debe ser uno de: ${Object.values(EstadoPrestamo).join(', ')}`,
  })
  estado?: EstadoPrestamo;

  @ApiPropertyOptional({
    description:
      'Si es true, filtra únicamente los préstamos activos próximos a vencer en las siguientes 24 horas (Figma pág. 13)',
    example: false,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({
    message: 'El filtro porVencer24h debe ser un valor booleano (true/false).',
  })
  porVencer24h?: boolean;

  @ApiPropertyOptional({
    description: 'Búsqueda por título, autor o carrera del documento prestado',
    example: 'Vivienda social',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;
}

export class QueryAdminLoansDto {
  @ApiPropertyOptional({
    description: 'Filtrar préstamos por estado de la máquina de estados',
    enum: EstadoPrestamo,
  })
  @IsOptional()
  @IsEnum(EstadoPrestamo, {
    message: `El estado debe ser uno de: ${Object.values(EstadoPrestamo).join(', ')}`,
  })
  estado?: EstadoPrestamo;

  @ApiPropertyOptional({
    description:
      'Filtrar por UUID del departamento del usuario prestatario (los 19 departamentos de San Juan)',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'El filtro departamentoId debe ser un UUID v4 válido.',
  })
  departamentoId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por UUID del usuario prestatario',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'El filtro usuarioId debe ser un UUID v4 válido.',
  })
  usuarioId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por UUID del documento académico',
  })
  @IsOptional()
  @IsUUID('4', {
    message: 'El filtro documentoId debe ser un UUID v4 válido.',
  })
  documentoId?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar préstamos activos que vencen en las próximas 24 horas (alerta temprana)',
    example: false,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({
    message: 'El filtro porVencer24h debe ser un valor booleano (true/false).',
  })
  porVencer24h?: boolean;

  @ApiPropertyOptional({
    description:
      'Búsqueda libre por nombre/email de usuario, título de documento o código de préstamo (#1024)',
    example: 'Jáchal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

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
    description: 'Cantidad de préstamos por página',
    default: 15,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 15;
}
