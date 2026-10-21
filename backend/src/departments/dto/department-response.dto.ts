import { ApiProperty } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador único UUID del departamento',
  })
  id!: string;

  @ApiProperty({
    example: 'Jáchal',
    description: 'Nombre oficial del departamento de la provincia de San Juan',
  })
  nombre!: string;

  @ApiProperty({
    example: false,
    description:
      'Indica si corresponde al departamento Capital (true) o a un departamento del interior/gran San Juan (false)',
  })
  esCapital!: boolean;

  @ApiProperty({
    example: 3,
    description: 'Cantidad total de usuarios registrados en este departamento',
  })
  totalUsuarios!: number;

  @ApiProperty({
    example: 2,
    description:
      'Cantidad de usuarios con cuenta APROBADA en este departamento',
  })
  usuariosAprobados!: number;

  @ApiProperty({
    example: 1,
    description:
      'Cantidad de usuarios con cuenta PENDIENTE de validación en este departamento',
  })
  usuariosPendientes!: number;

  @ApiProperty({
    example: 1,
    description:
      'Cantidad de documentos académicos asociados a este departamento de origen',
  })
  totalDocumentos!: number;
}

export class TerritorialMetricsResponseDto {
  @ApiProperty({
    example: 19,
    description:
      'Cantidad oficial de departamentos de la provincia de San Juan',
  })
  totalDepartamentos!: number;

  @ApiProperty({
    example: 6,
    description:
      'Total de usuarios registrados en todo el territorio provincial',
  })
  totalUsuariosProvincia!: number;

  @ApiProperty({
    example: 1,
    description: 'Total de usuarios registrados en el departamento Capital',
  })
  usuariosCapital!: number;

  @ApiProperty({
    example: 5,
    description:
      'Total de usuarios registrados en los 18 departamentos fuera de Capital (alcance interdepartamental)',
  })
  usuariosDepartamentosAlejados!: number;

  @ApiProperty({
    example: 4,
    description: 'Total de documentos catalogados en el repositorio',
  })
  totalDocumentosCatalogados!: number;

  @ApiProperty({
    type: [DepartmentResponseDto],
    description: 'Desglose detallado por cada uno de los 19 departamentos',
  })
  departamentos!: DepartmentResponseDto[];
}
