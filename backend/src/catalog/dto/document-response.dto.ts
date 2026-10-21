import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDocumento } from '@prisma/client';

export class DocumentDepartmentSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Jáchal' })
  nombre!: string;

  @ApiProperty({ example: false })
  esCapital!: boolean;
}

export class DocumentItemDto {
  @ApiProperty({
    description: 'UUID del documento académico',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  id!: string;

  @ApiProperty({
    description: 'Título completo de la obra',
    example: 'Vivienda social en Cuyo',
  })
  titulo!: string;

  @ApiProperty({
    description: 'Autor o autores del documento',
    example: 'L. Martínez',
  })
  autor!: string;

  @ApiPropertyOptional({
    description: 'Director o codirector de tesis/investigación',
    example: 'Mg. Arq. Claudia Quiroga',
    nullable: true,
  })
  director!: string | null;

  @ApiProperty({
    description: 'Carrera o área académica en la FAUD-UNSJ',
    example: 'Arquitectura',
  })
  carrera!: string;

  @ApiProperty({
    enum: TipoDocumento,
    description: 'Tipo de producción académica',
    example: TipoDocumento.INVESTIGACION,
  })
  tipo!: TipoDocumento;

  @ApiProperty({
    description: 'Año de publicación o defensa',
    example: 2021,
  })
  anio!: number;

  @ApiProperty({
    description: 'Resumen académico (abstract) del documento',
    example:
      'Investigación aplicada sobre tipologías de vivienda de interés social adaptadas a las condiciones climáticas y culturales de los valles del norte sanjuanino.',
  })
  resumen!: string;

  @ApiProperty({
    type: [String],
    description: 'Palabras clave normalizadas para indexación y búsqueda',
    example: ['vivienda social', 'Cuyo', 'hábitat rural', 'Jáchal'],
  })
  palabrasClave!: string[];

  @ApiProperty({
    description:
      'Estado administrativo del documento en Biblioteca (habilitado o suspendido)',
    example: true,
  })
  disponible!: boolean;

  @ApiProperty({
    description:
      'Resultado del método de dominio estaDisponible() (Diagrama de Clases Fig. 2). En modalidad digital multiusuario, indica si el documento admite nuevas solicitudes de préstamo.',
    example: true,
  })
  estaDisponible!: boolean;

  @ApiPropertyOptional({
    description: 'UUID del departamento de San Juan asociado al documento',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  departamentoOrigenId!: string | null;

  @ApiPropertyOptional({
    type: () => DocumentDepartmentSummaryDto,
    nullable: true,
    description: 'Datos del departamento territorial asociado al documento',
  })
  departamentoOrigen!: DocumentDepartmentSummaryDto | null;

  @ApiProperty({
    description:
      'Cantidad de préstamos digitales concurrentes actualmente en estado ACTIVO sobre este documento',
    example: 2,
  })
  prestamosActivosCount!: number;

  @ApiProperty({
    description:
      'Cantidad total histórica de préstamos registrados sobre el documento',
    example: 5,
  })
  totalPrestamosHistoricos!: number;

  @ApiProperty({
    example: '2026-10-21T18:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-10-21T18:00:00.000Z',
  })
  updatedAt!: Date;
}

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Total de documentos que coinciden con los filtros aplicados',
    example: 4,
  })
  total!: number;

  @ApiProperty({
    description: 'Página actual consultada (base 1)',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Cantidad máxima de documentos por página',
    example: 12,
  })
  limit!: number;

  @ApiProperty({
    description: 'Cantidad total de páginas disponibles',
    example: 1,
  })
  totalPages!: number;
}

export class DocumentsListResponseDto {
  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty({ type: () => [DocumentItemDto] })
  items!: DocumentItemDto[];
}

export class DocumentMutationResponseDto {
  @ApiProperty({
    example: 'Documento académico catalogado y almacenado de forma privada.',
  })
  message!: string;

  @ApiProperty({ type: () => DocumentItemDto })
  documento!: DocumentItemDto;
}

export class DeleteDocumentResponseDto {
  @ApiProperty({
    example:
      'Documento eliminado del catálogo y archivo PDF removido del almacenamiento privado.',
  })
  message!: string;

  @ApiProperty({
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  id!: string;
}
