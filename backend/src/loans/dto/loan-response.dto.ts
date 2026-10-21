import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPrestamo, TipoDocumento } from '@prisma/client';

export class LoanDepartmentSummaryDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  id!: string;

  @ApiProperty({ example: 'Jáchal' })
  nombre!: string;

  @ApiProperty({ example: false })
  esCapital!: boolean;
}

export class LoanUserSummaryDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  nombre!: string;

  @ApiProperty({ example: 'ana.perez@jachal.gov.ar' })
  email!: string;

  @ApiProperty({ type: LoanDepartmentSummaryDto })
  departamento!: LoanDepartmentSummaryDto;
}

export class LoanDocumentSummaryDto {
  @ApiProperty({ example: '9a8b7c6d-1234-4a5b-8c9d-0e1f2a3b4c5d' })
  id!: string;

  @ApiProperty({ example: 'Vivienda social en Cuyo' })
  titulo!: string;

  @ApiProperty({ example: 'L. Martínez' })
  autor!: string;

  @ApiPropertyOptional({
    example: 'Mg. Arq. Claudia Quiroga',
    nullable: true,
  })
  director!: string | null;

  @ApiProperty({ example: 'Arquitectura' })
  carrera!: string;

  @ApiProperty({ enum: TipoDocumento, example: TipoDocumento.INVESTIGACION })
  tipo!: TipoDocumento;

  @ApiProperty({ example: 2021 })
  anio!: number;

  @ApiProperty({ example: true })
  disponible!: boolean;

  @ApiPropertyOptional({
    type: LoanDepartmentSummaryDto,
    nullable: true,
  })
  departamentoOrigen!: LoanDepartmentSummaryDto | null;
}

export class LoanDrmRestrictionsDto {
  @ApiProperty({
    description:
      'El usuario nunca puede descargar el PDF local a su dispositivo (RNF02)',
    example: false,
  })
  permitirDescarga!: boolean;

  @ApiProperty({
    description:
      'La impresión del documento se encuentra deshabilitada (RNF02)',
    example: false,
  })
  permitirImpresion!: boolean;

  @ApiProperty({
    description:
      'La copia de texto fuera del visor se encuentra bloqueada (RNF02)',
    example: false,
  })
  permitirCopia!: boolean;

  @ApiProperty({
    description: 'Duración máxima reglamentaria del préstamo en días corridos',
    example: 7,
  })
  duracionMaximaDias!: number;

  @ApiProperty({
    description:
      'Texto de marca de agua dinámica superpuesto en el visor protegido (Figma pág. 14)',
    example: 'Ana Pérez · Préstamo #1024',
  })
  marcaAgua!: string;
}

export class LoanItemDto {
  @ApiProperty({ example: 'd4e5f6a7-8901-4b2c-9d3e-4f5a6b7c8d9e' })
  id!: string;

  @ApiProperty({
    description: 'Código numérico secuencial del préstamo',
    example: 1024,
  })
  codigoReferencia!: number;

  @ApiProperty({
    description:
      'Código de préstamo formateado para visualización en interfaz y marca de agua',
    example: '#1024',
  })
  codigoFormateado!: string;

  @ApiProperty({ enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO })
  estado!: EstadoPrestamo;

  @ApiProperty({ example: '2026-10-21T18:00:00.000Z' })
  fechaInicio!: Date;

  @ApiProperty({ example: '2026-10-28T18:00:00.000Z' })
  fechaVencimiento!: Date;

  @ApiProperty({
    description:
      'Resultado de validarVigencia(): true solo si estado === ACTIVO y fechaVencimiento > now()',
    example: true,
  })
  vigente!: boolean;

  @ApiProperty({
    description:
      'Días restantes enteros o redondeados hacia arriba mientras el préstamo está vigente (0 si venció o fue revocado)',
    example: 7,
  })
  diasRestantes!: number;

  @ApiProperty({
    description:
      'Horas restantes hasta el vencimiento del préstamo (0 si venció)',
    example: 168,
  })
  horasRestantes!: number;

  @ApiProperty({
    description:
      'Indicador de alerta temprana si el préstamo sigue ACTIVO y vence en <= 24 horas (Figma pág. 9 y 13 / RF06)',
    example: false,
  })
  porVencer24h!: boolean;

  @ApiProperty({
    description:
      'Marca de agua dinámica para el visor protegido (Figma pág. 14)',
    example: 'Ana Pérez · Préstamo #1024',
  })
  marcaAgua!: string;

  @ApiProperty({
    description:
      'Ruta del endpoint protegido de visualización según Diagrama de Secuencia (Figura 3)',
    example: '/api/v1/documentos/9a8b7c6d-1234-4a5b-8c9d-0e1f2a3b4c5d/ver',
  })
  visorUrl!: string;

  @ApiProperty({
    description:
      'Ruta alternativa del endpoint protegido de stream de contenido por préstamo',
    example: '/api/v1/prestamos/d4e5f6a7-8901-4b2c-9d3e-4f5a6b7c8d9e/contenido',
  })
  contenidoUrl!: string;

  @ApiPropertyOptional({
    description:
      'Token JWT DRM de 7 días (solo se expone al titular cuando el préstamo se encuentra ACTIVO y vigente)',
    nullable: true,
  })
  tokenAcceso?: string | null;

  @ApiProperty({ type: LoanUserSummaryDto })
  usuario!: LoanUserSummaryDto;

  @ApiProperty({ type: LoanDocumentSummaryDto })
  documento!: LoanDocumentSummaryDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CreateLoanResponseDto {
  @ApiProperty({
    example:
      'Préstamo digital #1024 otorgado exitosamente por 7 días corridos. Puede visualizar el documento en el visor protegido.',
  })
  message!: string;

  @ApiProperty({ type: LoanItemDto })
  prestamo!: LoanItemDto;

  @ApiProperty({
    description:
      'Token JWT de acceso temporal DRM firmado con vigencia de 7 días (RF03 / RF04)',
  })
  tokenAcceso!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 7 })
  expiresInDays!: number;

  @ApiProperty({ example: 'Ana Pérez · Préstamo #1024' })
  marcaAgua!: string;

  @ApiProperty({ type: LoanDrmRestrictionsDto })
  drm!: LoanDrmRestrictionsDto;

  @ApiProperty({
    example: '/api/v1/documentos/9a8b7c6d-1234-4a5b-8c9d-0e1f2a3b4c5d/ver',
  })
  visorUrl!: string;

  @ApiProperty({
    example: '/api/v1/prestamos/d4e5f6a7-8901-4b2c-9d3e-4f5a6b7c8d9e/contenido',
  })
  contenidoUrl!: string;
}

export class MyLoansCountersDto {
  @ApiProperty({ example: 3 })
  todos!: number;

  @ApiProperty({ example: 2 })
  activos!: number;

  @ApiProperty({ example: 1 })
  porVencer24h!: number;

  @ApiProperty({ example: 1 })
  vencidos!: number;

  @ApiProperty({ example: 0 })
  revocados!: number;

  @ApiProperty({ example: 0 })
  cerrados!: number;
}

export class MyLoansListResponseDto {
  @ApiProperty({ type: MyLoansCountersDto })
  contadores!: MyLoansCountersDto;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ type: [LoanItemDto] })
  items!: LoanItemDto[];
}

export class AdminLoansMetricsDto {
  @ApiProperty({
    description:
      'Cantidad de préstamos actualmente en estado ACTIVO y vigentes',
    example: 18,
  })
  activos!: number;

  @ApiProperty({
    description:
      'Cantidad de préstamos activos que vencen dentro de las próximas 24 horas (Figma pág. 9)',
    example: 4,
  })
  porVencer24h!: number;

  @ApiProperty({
    description:
      'Cantidad de préstamos cuyo vencimiento ocurrió en el día de hoy',
    example: 2,
  })
  vencidosHoy!: number;

  @ApiProperty({
    description: 'Total histórico de préstamos en estado VENCIDO',
    example: 12,
  })
  vencidosTotal!: number;

  @ApiProperty({
    description: 'Total de préstamos revocados manualmente por Biblioteca',
    example: 1,
  })
  revocadosTotal!: number;

  @ApiProperty({
    description: 'Total de solicitudes rechazadas por no disponibilidad',
    example: 0,
  })
  rechazadosTotal!: number;

  @ApiProperty({
    description: 'Total de préstamos cerrados/finalizados',
    example: 5,
  })
  cerradosTotal!: number;

  @ApiProperty({
    description: 'Total general de registros de préstamos en el sistema',
    example: 36,
  })
  totalHistorico!: number;
}

export class AdminLoansPaginationMetaDto {
  @ApiProperty({ example: 36 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 15 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class AdminLoansListResponseDto {
  @ApiProperty({ type: AdminLoansMetricsDto })
  metricas!: AdminLoansMetricsDto;

  @ApiProperty({ type: AdminLoansPaginationMetaDto })
  meta!: AdminLoansPaginationMetaDto;

  @ApiProperty({ type: [LoanItemDto] })
  items!: LoanItemDto[];
}

export class LoanStateTransitionResponseDto {
  @ApiProperty({
    example:
      'El préstamo #1024 fue revocado inmediatamente por Biblioteca FAUD-UNSJ. El acceso al visor PDF ha quedado bloqueado.',
  })
  message!: string;

  @ApiProperty({ enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO })
  estadoAnterior!: EstadoPrestamo;

  @ApiProperty({ enum: EstadoPrestamo, example: EstadoPrestamo.REVOCADO })
  estadoActual!: EstadoPrestamo;

  @ApiPropertyOptional({
    example: 'Revocación administrativa por auditoría de Biblioteca.',
  })
  motivo?: string;

  @ApiProperty({ type: LoanItemDto })
  prestamo!: LoanItemDto;
}

export class LoanViewerMetadataResponseDto {
  @ApiProperty({ example: 'd4e5f6a7-8901-4b2c-9d3e-4f5a6b7c8d9e' })
  prestamoId!: string;

  @ApiProperty({ example: 1024 })
  codigoReferencia!: number;

  @ApiProperty({ example: '#1024' })
  codigoFormateado!: string;

  @ApiProperty({ enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO })
  estado!: EstadoPrestamo;

  @ApiProperty({ example: '2026-10-21T18:00:00.000Z' })
  fechaInicio!: Date;

  @ApiProperty({ example: '2026-10-28T18:00:00.000Z' })
  fechaVencimiento!: Date;

  @ApiProperty({ example: 7 })
  diasRestantes!: number;

  @ApiProperty({ example: 168 })
  horasRestantes!: number;

  @ApiProperty({ example: 604800 })
  segundosRestantes!: number;

  @ApiProperty({ example: false })
  porVencer24h!: boolean;

  @ApiProperty({ example: 'Ana Pérez · Préstamo #1024' })
  marcaAgua!: string;

  @ApiProperty({ type: LoanDrmRestrictionsDto })
  drm!: LoanDrmRestrictionsDto;

  @ApiProperty({ type: LoanUserSummaryDto })
  usuario!: LoanUserSummaryDto;

  @ApiProperty({ type: LoanDocumentSummaryDto })
  documento!: LoanDocumentSummaryDto;

  @ApiProperty({
    example: '/api/v1/documentos/9a8b7c6d-1234-4a5b-8c9d-0e1f2a3b4c5d/ver',
  })
  streamDocumentoUrl!: string;

  @ApiProperty({
    example: '/api/v1/prestamos/d4e5f6a7-8901-4b2c-9d3e-4f5a6b7c8d9e/contenido',
  })
  streamPrestamoUrl!: string;
}
