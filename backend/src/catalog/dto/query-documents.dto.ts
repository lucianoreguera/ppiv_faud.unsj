import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDocumento } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { parseOptionalBoolean } from './create-document.dto';

export class QueryDocumentsDto {
  @ApiPropertyOptional({
    description:
      'Búsqueda por texto libre en título, autor, director, resumen o palabras clave (RF02)',
    example: 'accesibilidad',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por UUID del departamento de San Juan asociado al documento (Figma pág. 11)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', {
    message: 'El filtro departamentoId debe ser un UUID v4 válido.',
  })
  @IsOptional()
  departamentoId?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por carrera o área académica (ej. Arquitectura, Diseño, Urbanismo)',
    example: 'Arquitectura',
  })
  @IsString()
  @IsOptional()
  carrera?: string;

  @ApiPropertyOptional({
    enum: TipoDocumento,
    description:
      'Filtrar por tipo de documento (TESIS, MONOGRAFIA, INVESTIGACION, OTROS)',
    example: TipoDocumento.TESIS,
  })
  @IsEnum(TipoDocumento, {
    message:
      'El filtro tipo debe ser TESIS, MONOGRAFIA, INVESTIGACION u OTROS.',
  })
  @IsOptional()
  tipo?: TipoDocumento;

  @ApiPropertyOptional({
    description: 'Filtrar por año exacto de publicación',
    example: 2023,
  })
  @Type(() => Number)
  @IsInt({ message: 'El filtro anio debe ser un número entero.' })
  @Min(1950)
  @Max(2100)
  @IsOptional()
  anio?: number;

  @ApiPropertyOptional({
    description: 'Filtrar desde un año de publicación (inclusive)',
    example: 2018,
  })
  @Type(() => Number)
  @IsInt({ message: 'El filtro anioDesde debe ser un número entero.' })
  @Min(1950)
  @Max(2100)
  @IsOptional()
  anioDesde?: number;

  @ApiPropertyOptional({
    description: 'Filtrar hasta un año de publicación (inclusive)',
    example: 2024,
  })
  @Type(() => Number)
  @IsInt({ message: 'El filtro anioHasta debe ser un número entero.' })
  @Min(1950)
  @Max(2100)
  @IsOptional()
  anioHasta?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por estado de disponibilidad del documento en el catálogo (true/false)',
    example: true,
  })
  @Transform(({ obj, key }) =>
    parseOptionalBoolean((obj as Record<string, unknown>)[key]),
  )
  @IsBoolean({
    message: 'El filtro disponible debe ser un valor booleano (true/false).',
  })
  @IsOptional()
  disponible?: boolean;

  @ApiPropertyOptional({
    description: 'Número de página para paginación (base 1)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página (máximo 100)',
    default: 12,
    minimum: 1,
    maximum: 100,
    example: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 12;
}
