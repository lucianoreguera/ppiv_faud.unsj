import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import {
  DepartmentResponseDto,
  TerritorialMetricsResponseDto,
} from './dto/department-response.dto';

@ApiTags('Departamentos (San Juan)')
@Controller('departamentos')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar los 19 departamentos de la provincia de San Juan',
    description:
      'Endpoint público utilizado en el formulario de registro de usuarios (RF05), en los filtros territoriales del catálogo público (RF02) y en las estadísticas de alcance interdepartamental.',
  })
  @ApiOkResponse({
    description: 'Listado de los 19 departamentos de San Juan con sus métricas.',
    type: [DepartmentResponseDto],
  })
  async findAll(): Promise<DepartmentResponseDto[]> {
    return this.departmentsService.findAll();
  }

  @Get('metricas')
  @ApiOperation({
    summary: 'Obtener métricas de distribución territorial (Capital vs. Interior)',
    description:
      'Consolida el alcance interdepartamental del repositorio diferenciando usuarios de Capital (`esCapital = true`) frente a los 18 departamentos restantes de San Juan.',
  })
  @ApiOkResponse({
    description: 'Métricas territoriales consolidadas.',
    type: TerritorialMetricsResponseDto,
  })
  async getMetrics(): Promise<TerritorialMetricsResponseDto> {
    return this.departmentsService.getTerritorialMetrics();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un departamento por su ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del departamento de San Juan',
  })
  @ApiOkResponse({
    description: 'Datos y métricas del departamento solicitado.',
    type: DepartmentResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Departamento no encontrado.',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.findOne(id);
  }
}
