import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CatalogService } from './catalog.service';
import {
  CreateDocumentDto,
  CreateDocumentMultipartDto,
} from './dto/create-document.dto';
import {
  DeleteDocumentResponseDto,
  DocumentItemDto,
  DocumentMutationResponseDto,
  DocumentsListResponseDto,
} from './dto/document-response.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

const MAX_PDF_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (RF01)

@ApiTags('Catálogo Académico y Documentos PDF (RF01, RF02)')
@Controller('documentos')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: {
        fileSize: MAX_PDF_UPLOAD_BYTES,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Cargar y catalogar un nuevo documento académico en PDF (RF01 - Solo Admin)',
    description:
      'Permite al Administrador de Biblioteca subir un archivo PDF (máximo 50 MB) junto con sus metadatos normalizados (`titulo`, `autor`, `director`, `carrera`, `tipo`, `anio`, `departamentoOrigenId`, `palabrasClave`, `resumen`). El PDF se almacena en un directorio privado fuera del alcance público para impedir descargas directas sin préstamo vigente.',
  })
  @ApiBody({
    type: CreateDocumentMultipartDto,
  })
  @ApiCreatedResponse({
    description:
      'Documento catalogado y archivo PDF almacenado de forma privada.',
    type: DocumentMutationResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Archivo ausente, formato distinto de PDF (%PDF-), tamaño superior a 50 MB o metadatos inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT inválido o ausente.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<DocumentMutationResponseDto> {
    return this.catalogService.create(dto, file);
  }

  @Get()
  @ApiOperation({
    summary:
      'Buscador público del catálogo académico con filtros combinados y paginación (RF02)',
    description:
      'Consulta pública de las obras académicas de la FAUD-UNSJ con filtros combinables: texto libre (`q` en título, autor, director, resumen o palabras clave), `departamentoId` (19 departamentos de San Juan), `carrera`, `tipo`, `anio`, rango `anioDesde`/`anioHasta` y `disponible`. Nunca expone la ruta física ni el binario del PDF.',
  })
  @ApiOkResponse({
    description: 'Listado paginado de fichas bibliográficas del catálogo.',
    type: DocumentsListResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de filtrado o paginación inválidos.',
  })
  async findAll(
    @Query() query: QueryDocumentsDto,
  ): Promise<DocumentsListResponseDto> {
    return this.catalogService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Obtener detalle completo de la ficha bibliográfica de un documento (RF02 - Público)',
    description:
      'Devuelve todos los metadatos normalizados del documento y el resultado de `estaDisponible()` (Figma pág. 12), sin exponer acceso directo al archivo PDF.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del documento académico',
  })
  @ApiOkResponse({
    description: 'Ficha bibliográfica detallada del documento.',
    type: DocumentItemDto,
  })
  @ApiNotFoundResponse({
    description: 'Documento académico no encontrado.',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DocumentItemDto> {
    return this.catalogService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: {
        fileSize: MAX_PDF_UPLOAD_BYTES,
      },
    }),
  )
  @ApiOperation({
    summary:
      'Actualizar metadatos o estado de disponibilidad de un documento (RF01 - Solo Admin)',
    description:
      'Permite al Administrador editar los metadatos bibliográficos, habilitar/suspender la disponibilidad (`disponible: true/false`) o reemplazar el archivo PDF adjunto.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del documento académico a actualizar',
  })
  @ApiOkResponse({
    description: 'Documento académico actualizado exitosamente.',
    type: DocumentMutationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de actualización inválidos.',
  })
  @ApiNotFoundResponse({
    description: 'Documento académico no encontrado.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT inválido o ausente.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentMutationResponseDto> {
    return this.catalogService.update(id, dto, file);
  }

  @Delete(':id')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Eliminar un documento del catálogo y su archivo PDF privado (RF01 - Solo Admin)',
    description:
      'Elimina el documento si no posee préstamos activos ni historial comprometido, removiendo también el archivo PDF del almacenamiento privado.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del documento académico a eliminar',
  })
  @ApiOkResponse({
    description: 'Documento eliminado correctamente.',
    type: DeleteDocumentResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Documento académico no encontrado.',
  })
  @ApiConflictResponse({
    description:
      'No se puede eliminar un documento con préstamos activos o historial registrado.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT inválido o ausente.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DeleteDocumentResponseDto> {
    return this.catalogService.remove(id);
  }
}
