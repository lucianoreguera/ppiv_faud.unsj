import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDocumento } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  parseOptionalBoolean,
  parsePalabrasClave,
} from './create-document.dto';

export class UpdateDocumentDto {
  @ApiPropertyOptional({
    description: 'Título completo de la obra académica',
    example:
      'Arquitectura sustentable en el Valle de Calingasta (Edición Revisada)',
  })
  @IsString()
  @MinLength(3, {
    message: 'El título debe tener al menos 3 caracteres.',
  })
  @MaxLength(250, {
    message: 'El título no puede superar los 250 caracteres.',
  })
  @IsOptional()
  titulo?: string;

  @ApiPropertyOptional({
    description: 'Autor o autores principales del documento',
    example: 'Arq. Mariana Lucero',
  })
  @IsString()
  @MinLength(2, {
    message: 'El autor debe tener al menos 2 caracteres.',
  })
  @MaxLength(180, {
    message: 'El autor no puede superar los 180 caracteres.',
  })
  @IsOptional()
  autor?: string;

  @ApiPropertyOptional({
    description: 'Director o codirector de tesis/investigación',
    example: 'Dr. Arq. Roberto Sánchez',
  })
  @IsString()
  @MaxLength(180, {
    message: 'El nombre del director no puede superar los 180 caracteres.',
  })
  @IsOptional()
  director?: string;

  @ApiPropertyOptional({
    description: 'Carrera o área académica de la FAUD-UNSJ',
    example: 'Arquitectura',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  carrera?: string;

  @ApiPropertyOptional({
    enum: TipoDocumento,
    description:
      'Tipo de producción académica (TESIS, MONOGRAFIA, INVESTIGACION, OTROS)',
    example: TipoDocumento.TESIS,
  })
  @IsEnum(TipoDocumento, {
    message:
      'El tipo de documento debe ser TESIS, MONOGRAFIA, INVESTIGACION u OTROS.',
  })
  @IsOptional()
  tipo?: TipoDocumento;

  @ApiPropertyOptional({
    description: 'Año de publicación o defensa del documento',
    example: 2024,
  })
  @Type(() => Number)
  @IsInt({ message: 'El año de publicación debe ser un número entero.' })
  @Min(1950, { message: 'El año no puede ser anterior a 1950.' })
  @Max(new Date().getFullYear() + 1, {
    message: 'El año no puede ser posterior al próximo año lectivo.',
  })
  @IsOptional()
  anio?: number;

  @ApiPropertyOptional({
    description: 'Resumen académico (abstract) del documento',
  })
  @IsString()
  @MinLength(10, {
    message: 'El resumen debe tener al menos 10 caracteres.',
  })
  @IsOptional()
  resumen?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Palabras clave normalizadas (arreglo de strings o lista separada por comas)',
    example: ['sustentabilidad', 'Calingasta', 'bioclimática'],
  })
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }
    return parsePalabrasClave(raw);
  })
  @IsArray({ message: 'Las palabras clave deben enviarse como una lista.' })
  @ArrayMinSize(1, {
    message: 'Debe especificar al menos una palabra clave.',
  })
  @IsString({ each: true })
  @IsOptional()
  palabrasClave?: string[];

  @ApiPropertyOptional({
    description: 'UUID del departamento de origen vinculado al documento',
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
    example: true,
  })
  @Transform(({ obj, key }) =>
    parseOptionalBoolean((obj as Record<string, unknown>)[key]),
  )
  @IsBoolean({
    message: 'El campo disponible debe ser un valor booleano (true/false).',
  })
  @IsOptional()
  disponible?: boolean;
}
