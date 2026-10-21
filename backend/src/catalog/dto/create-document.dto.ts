import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDocumento } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export function parsePalabrasClave(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw
      .flatMap((item) => String(item).split(','))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item).trim())
            .filter((s) => s.length > 0);
        }
      } catch {
        // Si no es JSON válido, se procesa separado por comas
      }
    }
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return [];
}

export function parseOptionalBoolean(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }
  return Boolean(raw);
}

export class CreateDocumentDto {
  @ApiProperty({
    description: 'Título completo de la obra académica',
    example: 'Arquitectura sustentable en el Valle de Calingasta',
  })
  @IsString()
  @IsNotEmpty({ message: 'El título del documento es obligatorio.' })
  @MinLength(3, {
    message: 'El título debe tener al menos 3 caracteres.',
  })
  @MaxLength(250, {
    message: 'El título no puede superar los 250 caracteres.',
  })
  titulo!: string;

  @ApiProperty({
    description: 'Autor o autores principales del documento',
    example: 'Arq. Mariana Lucero',
  })
  @IsString()
  @IsNotEmpty({ message: 'El autor del documento es obligatorio.' })
  @MinLength(2, {
    message: 'El autor debe tener al menos 2 caracteres.',
  })
  @MaxLength(180, {
    message: 'El autor no puede superar los 180 caracteres.',
  })
  autor!: string;

  @ApiPropertyOptional({
    description: 'Director o codirector de tesis/investigación',
    example: 'Dr. Arq. Roberto Sánchez',
  })
  @IsString()
  @IsOptional()
  @MaxLength(180, {
    message: 'El nombre del director no puede superar los 180 caracteres.',
  })
  director?: string;

  @ApiProperty({
    description:
      'Carrera o área académica de la FAUD-UNSJ (ej. Arquitectura, Diseño, Urbanismo)',
    example: 'Arquitectura',
  })
  @IsString()
  @IsNotEmpty({ message: 'La carrera o área académica es obligatoria.' })
  @MaxLength(100)
  carrera!: string;

  @ApiProperty({
    enum: TipoDocumento,
    description:
      'Tipo de producción académica (TESIS, MONOGRAFIA, INVESTIGACION, OTROS)',
    example: TipoDocumento.TESIS,
  })
  @IsEnum(TipoDocumento, {
    message:
      'El tipo de documento debe ser TESIS, MONOGRAFIA, INVESTIGACION u OTROS.',
  })
  tipo!: TipoDocumento;

  @ApiProperty({
    description: 'Año de publicación o defensa del documento',
    example: 2024,
    minimum: 1950,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt({ message: 'El año de publicación debe ser un número entero.' })
  @Min(1950, { message: 'El año no puede ser anterior a 1950.' })
  @Max(new Date().getFullYear() + 1, {
    message: 'El año no puede ser posterior al próximo año lectivo.',
  })
  anio!: number;

  @ApiProperty({
    description: 'Resumen académico (abstract) del documento',
    example:
      'Análisis de estrategias bioclimáticas y constructivas en tierra aplicadas a equipamientos comunitarios en el departamento de Calingasta.',
  })
  @IsString()
  @IsNotEmpty({ message: 'El resumen académico es obligatorio.' })
  @MinLength(10, {
    message: 'El resumen debe tener al menos 10 caracteres.',
  })
  resumen!: string;

  @ApiProperty({
    type: [String],
    description:
      'Palabras clave normalizadas (acepta arreglo de strings o lista separada por comas en multipart/form-data)',
    example: ['sustentabilidad', 'Calingasta', 'bioclimática', 'tierra cruda'],
  })
  @Transform(({ obj, key }) =>
    parsePalabrasClave((obj as Record<string, unknown>)[key]),
  )
  @IsArray({ message: 'Las palabras clave deben enviarse como una lista.' })
  @ArrayMinSize(1, {
    message: 'Debe especificar al menos una palabra clave.',
  })
  @IsString({ each: true })
  palabrasClave!: string[];

  @ApiPropertyOptional({
    description:
      'UUID del departamento de San Juan vinculado a la temática u origen del documento',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (typeof raw === 'string' && raw.trim() === '') {
      return undefined;
    }
    return raw;
  })
  @IsUUID('4', {
    message: 'El departamentoOrigenId debe ser un UUID v4 válido.',
  })
  @IsOptional()
  departamentoOrigenId?: string;

  @ApiPropertyOptional({
    description:
      'Indica si el documento se encuentra habilitado por Biblioteca para préstamos digitales',
    default: true,
    example: true,
  })
  @Transform(({ obj, key }) =>
    parseOptionalBoolean((obj as Record<string, unknown>)[key]),
  )
  @IsBoolean({
    message: 'El campo disponible debe ser un valor booleano (true/false).',
  })
  @IsOptional()
  disponible?: boolean = true;
}

export class CreateDocumentMultipartDto extends CreateDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo digital en formato PDF (tamaño máximo: 50 MB)',
  })
  archivo?: unknown;
}
