import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Verificar estado del servidor y conexión a PostgreSQL',
    description:
      'Devuelve el estado operativo del Backend, la marca temporal del servidor y el chequeo de conectividad con la base de datos PostgreSQL 16.',
  })
  @ApiOkResponse({
    description: 'El servidor responde correctamente.',
    type: HealthResponseDto,
  })
  async check(): Promise<HealthResponseDto> {
    return this.healthService.checkHealth();
  }
}
