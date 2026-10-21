import { ApiProperty } from '@nestjs/swagger';

export class DatabaseHealthDto {
  @ApiProperty({
    example: 'up',
    description: 'Estado de la conexión con PostgreSQL 16',
    enum: ['up', 'down'],
  })
  status!: 'up' | 'down';

  @ApiProperty({
    example: 4,
    description: 'Tiempo de respuesta de la base de datos en milisegundos',
    required: false,
  })
  latencyMs?: number;
}

export class HealthResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Estado general del servidor Backend',
    enum: ['ok', 'degraded'],
  })
  status!: 'ok' | 'degraded';

  @ApiProperty({
    example: 'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ',
    description: 'Nombre del servicio',
  })
  service!: string;

  @ApiProperty({
    example: '0.1.0',
    description: 'Versión actual de la API',
  })
  version!: string;

  @ApiProperty({
    example: 'development',
    description: 'Entorno de ejecución activo',
  })
  environment!: string;

  @ApiProperty({
    example: '2026-10-21T19:45:00.000Z',
    description: 'Marca temporal ISO 8601 del servidor',
  })
  timestamp!: string;

  @ApiProperty({
    example: 12.45,
    description: 'Tiempo de actividad del proceso en segundos',
  })
  uptimeSeconds!: number;

  @ApiProperty({
    type: DatabaseHealthDto,
    description: 'Estado de conectividad con PostgreSQL',
  })
  database!: DatabaseHealthDto;
}
