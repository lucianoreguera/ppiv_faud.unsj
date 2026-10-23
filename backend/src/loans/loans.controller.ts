import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  buildProtectedPdfStream,
  extractDrmTokenFromRequest,
} from './drm-stream.util';
import { CreateLoanDto } from './dto/create-loan.dto';
import {
  AdminLoansListResponseDto,
  CreateLoanResponseDto,
  LoanItemDto,
  LoanStateTransitionResponseDto,
  LoanViewerMetadataResponseDto,
  MyLoansListResponseDto,
} from './dto/loan-response.dto';
import { QueryAdminLoansDto, QueryMyLoansDto } from './dto/query-loans.dto';
import { RevokeLoanDto } from './dto/revoke-loan.dto';
import { LoansService } from './loans.service';

@ApiTags('Préstamos Digitales y DRM Temporal 7 Días (RF03, RF04, RNF02)')
@Controller('prestamos')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Solicitar un préstamo digital temporal de 7 días y emitir token DRM (RF03, RF04)',
    description:
      'Verifica la disponibilidad del documento (`estaDisponible()`), transiciona el estado de `SOLICITADO` a `ACTIVO`, calcula `fechaVencimiento = fechaInicio + 7 días` y firma el `tokenAcceso` JWT específico de DRM (`LOAN_DRM_JWT_SECRET`). Soporta préstamos concurrentes multiusuario e impide préstamos duplicados activos de una misma persona sobre el mismo documento.',
  })
  @ApiCreatedResponse({
    description:
      'Préstamo otorgado en estado ACTIVO junto con el tokenAcceso DRM de 7 días y metadatos de marca de agua.',
    type: CreateLoanResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'UUID de documento inválido.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT de sesión ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'Cuenta de usuario no aprobada por Biblioteca.',
  })
  @ApiNotFoundResponse({
    description: 'El documento académico solicitado no existe.',
  })
  @ApiConflictResponse({
    description:
      'El documento está suspendido por Biblioteca (RECHAZADO) o el usuario ya posee un préstamo ACTIVO vigente sobre este mismo documento.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLoanDto,
  ): Promise<CreateLoanResponseDto> {
    return this.loansService.solicitarPrestamo(user.id, dto);
  }

  @Get('mis-prestamos')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Listar los préstamos del usuario autenticado con cuenta regresiva y alertas (RF03 - Figma pág. 13)',
    description:
      'Sincroniza vencimientos y devuelve los préstamos del estudiante/docente autenticado junto con contadores (`activos`, `porVencer24h`, `vencidos`, `revocados`), días/horas restantes y el `tokenAcceso` de los préstamos vigentes.',
  })
  @ApiOkResponse({
    description: 'Listado de préstamos del usuario y contadores por estado.',
    type: MyLoansListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT de sesión ausente o inválido.',
  })
  async findMyLoans(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryMyLoansDto,
  ): Promise<MyLoansListResponseDto> {
    return this.loansService.findMyLoans(user.id, query);
  }

  @Get()
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Tablero de control y listado paginado de préstamos para Biblioteca (RF03, RF04 - Solo Admin, Figma pág. 9)',
    description:
      'Devuelve las métricas operativas (`activos`, `porVencer24h`, `vencidosHoy`, `vencidosTotal`, `revocadosTotal`) y el listado paginado filtrable por estado, departamento de San Juan, usuario, documento o búsqueda libre.',
  })
  @ApiOkResponse({
    description: 'Métricas del tablero de préstamos y listado paginado.',
    type: AdminLoansListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT de sesión ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async findAllForAdmin(
    @Query() query: QueryAdminLoansDto,
  ): Promise<AdminLoansListResponseDto> {
    return this.loansService.findAllForAdmin(query);
  }

  @Get(':id')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Obtener detalle de un préstamo por su UUID (Titular o Admin)',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del préstamo a consultar',
  })
  @ApiOkResponse({
    description: 'Detalle del préstamo digital.',
    type: LoanItemDto,
  })
  @ApiNotFoundResponse({
    description: 'Préstamo no encontrado.',
  })
  @ApiForbiddenResponse({
    description: 'El préstamo pertenece a otro usuario.',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LoanItemDto> {
    return this.loansService.findOne(id, user);
  }

  @Patch(':id/revocar')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Revocar manualmente un préstamo activo e invalidar en el acto su acceso al visor PDF (RF04 - Solo Admin)',
    description:
      'Ejecuta el método de dominio `revocarAcceso()`: transiciona el préstamo de `ACTIVO` a `REVOCADO` y bloquea inmediatamente cualquier intento de lectura en el visor protegido (`403 Forbidden`), aun cuando el JWT DRM de 7 días no haya expirado.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del préstamo a revocar',
  })
  @ApiOkResponse({
    description: 'Préstamo revocado exitosamente y acceso DRM bloqueado.',
    type: LoanStateTransitionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Préstamo no encontrado.',
  })
  @ApiConflictResponse({
    description:
      'Transición inválida: el préstamo no se encuentra en estado ACTIVO (ya está VENCIDO, REVOCADO, RECHAZADO o CERRADO).',
  })
  @ApiForbiddenResponse({
    description: 'Acceso restringido exclusivamente al rol ADMINISTRADOR.',
  })
  async revoke(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RevokeLoanDto,
  ): Promise<LoanStateTransitionResponseDto> {
    return this.loansService.revocarAcceso(id, dto);
  }

  @Patch(':id/cerrar')
  @ApiBearerAuth('jwt-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Cerrar/finalizar un préstamo digital (Titular o Admin - Máquina de Estados Figura 5)',
    description:
      'Permite al estudiante devolver anticipadamente un préstamo `ACTIVO` o archivar un préstamo `VENCIDO`/`REVOCADO` pasándolo al estado terminal `CERRADO`.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del préstamo a cerrar',
  })
  @ApiOkResponse({
    description: 'Préstamo pasado a estado CERRADO.',
    type: LoanStateTransitionResponseDto,
  })
  @ApiConflictResponse({
    description: 'Transición inválida desde el estado actual.',
  })
  async closeLoan(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LoanStateTransitionResponseDto> {
    return this.loansService.cerrarPrestamo(id, user);
  }

  @Get(':id/visor')
  @ApiBearerAuth('loan-drm-token')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({
    summary:
      'Obtener metadatos de sesión del Visor Protegido con DRM y marca de agua dinámica (RF04 - Figma pág. 14)',
    description:
      'Verifica la vigencia del token DRM y del préstamo en PostgreSQL (`validarVigencia()`). Si está activo, devuelve los datos del documento, cuenta regresiva, leyenda de marca de agua (`"Nombre Apellido · Préstamo #Código"`) y banderas de restricción DRM (`permitirDescarga: false`, `permitirImpresion: false`). Si venció o fue revocado, responde `403 Forbidden`.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del préstamo',
  })
  @ApiHeader({
    name: 'x-drm-token',
    required: false,
    description:
      'Token DRM temporal alternativo si el header Authorization se usa para el token de sesión.',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'Token DRM temporal opcional por query string.',
  })
  @ApiOkResponse({
    description: 'Metadatos del visor protegido y marca de agua dinámica.',
    type: LoanViewerMetadataResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token DRM ausente o criptográficamente inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El préstamo ha vencido o fue revocado.',
  })
  async getViewerMetadata(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('authorization') authorizationHeader?: string,
    @Headers('x-drm-token') drmHeader?: string,
    @Query('token') queryToken?: string,
  ): Promise<LoanViewerMetadataResponseDto> {
    const rawToken = extractDrmTokenFromRequest(
      authorizationHeader,
      drmHeader,
      queryToken,
    );
    return this.loansService.getViewerMetadata(id, rawToken);
  }

  @Get(':id/contenido')
  @ApiBearerAuth('loan-drm-token')
  @ApiBearerAuth('jwt-auth')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Transmitir stream seguro del PDF de un préstamo activo con encabezados DRM (RF04, RNF02)',
    description:
      'Verifica la firma y vigencia del `tokenAcceso` DRM de 7 días **y** comprueba en PostgreSQL que el préstamo siga en estado `ACTIVO` y `fechaVencimiento > now()`. Si está vigente, transmite el flujo binario del PDF con encabezados `Content-Disposition: inline`, `Cache-Control: no-store` y `X-DRM-Watermark`. Si venció o fue revocado, responde `403 Forbidden` (`"El préstamo ha vencido o fue revocado"`).',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del préstamo digital',
  })
  @ApiHeader({
    name: 'x-drm-token',
    required: false,
    description: 'Token DRM temporal de 7 días (alternativo a Authorization).',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'Token DRM temporal de 7 días (opcional por query param).',
  })
  @ApiOkResponse({
    description:
      'Stream binario protegido del archivo PDF junto con encabezados X-DRM-Watermark y bloqueo de caché/descarga.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token DRM ausente o firma inválida.',
  })
  @ApiForbiddenResponse({
    description: 'El préstamo ha vencido o fue revocado (403 Forbidden).',
  })
  async streamLoanContent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') authorizationHeader?: string,
    @Headers('x-drm-token') drmHeader?: string,
    @Query('token') queryToken?: string,
  ): Promise<StreamableFile> {
    const rawToken = extractDrmTokenFromRequest(
      authorizationHeader,
      drmHeader,
      queryToken,
    );
    const access = await this.loansService.validateDrmAccessByLoan(
      id,
      rawToken,
    );
    const pdf = await this.loansService.openProtectedPdf(access);
    return buildProtectedPdfStream(res, access, pdf);
  }
}

@ApiTags('Préstamos Digitales y DRM Temporal 7 Días (RF03, RF04, RNF02)')
@Controller('documentos')
export class DocumentViewerController {
  constructor(private readonly loansService: LoansService) {}

  @Get(':id/ver')
  @ApiBearerAuth('loan-drm-token')
  @ApiBearerAuth('jwt-auth')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Visualización protegida del documento PDF con validación doble DRM (Figura 3 — RF04, RNF02)',
    description:
      'Implementa exactamente el flujo del **Diagrama de Secuencia (Figura 3)** y **Spec 03**: verifica la firma y expiración del JWT temporal (`tokenAcceso`) **y** valida en PostgreSQL (`validarVigencia()`) que el préstamo siga en estado `ACTIVO` y `fechaVencimiento > now()`. Si está vigente, entrega el stream seguro del PDF e inyecta los metadatos de marca de agua dinámica (`X-DRM-Watermark: "Nombre Apellido · Préstamo #Código"`). Si el préstamo venció o fue revocado, responde `403 Forbidden` (`"El préstamo ha vencido o fue revocado"`).',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del documento académico a visualizar',
  })
  @ApiHeader({
    name: 'x-drm-token',
    required: false,
    description: 'Token DRM temporal de 7 días (alternativo a Authorization).',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'Token DRM temporal de 7 días (opcional por query param).',
  })
  @ApiOkResponse({
    description:
      'Stream binario protegido del archivo PDF con encabezados DRM y marca de agua dinámica.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token DRM ausente o firma criptográfica inválida.',
  })
  @ApiForbiddenResponse({
    description: 'El préstamo ha vencido o fue revocado (403 Forbidden).',
  })
  @ApiNotFoundResponse({
    description: 'El documento académico no existe.',
  })
  async viewProtectedDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') authorizationHeader?: string,
    @Headers('x-drm-token') drmHeader?: string,
    @Query('token') queryToken?: string,
  ): Promise<StreamableFile> {
    const rawToken = extractDrmTokenFromRequest(
      authorizationHeader,
      drmHeader,
      queryToken,
    );
    const access = await this.loansService.validateDrmAccessByDocument(
      id,
      rawToken,
    );
    const pdf = await this.loansService.openProtectedPdf(access);
    return buildProtectedPdfStream(res, access, pdf);
  }
}
