import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPrestamo, Prisma, TipoDocumento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import {
  DeleteDocumentResponseDto,
  DocumentItemDto,
  DocumentMutationResponseDto,
  DocumentsListResponseDto,
} from './dto/document-response.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PdfStorageService } from './pdf-storage.service';

type DocumentoWithRelations = {
  id: string;
  titulo: string;
  autor: string;
  director: string | null;
  carrera: string;
  tipo: TipoDocumento;
  anio: number;
  resumen: string;
  palabrasClave: string[];
  archivoUrl: string;
  disponible: boolean;
  departamentoOrigenId: string | null;
  departamentoOrigen: {
    id: string;
    nombre: string;
    esCapital: boolean;
  } | null;
  prestamos: { id: string }[];
  _count: {
    prestamos: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfStorageService: PdfStorageService,
  ) {}

  /**
   * Registra un nuevo documento académico en el catálogo y almacena su archivo PDF
   * en el directorio privado fuera del alcance público (RF01 / RNF02).
   */
  async create(
    dto: CreateDocumentDto,
    file: Express.Multer.File | undefined,
  ): Promise<DocumentMutationResponseDto> {
    if (dto.departamentoOrigenId) {
      await this.ensureDepartamentoExists(dto.departamentoOrigenId);
    }

    const savedPdf = await this.pdfStorageService.validateAndSavePdf(
      file,
      dto.titulo,
    );

    const creado = await this.prisma.documento.create({
      data: {
        titulo: dto.titulo.trim(),
        autor: dto.autor.trim(),
        director: dto.director ? dto.director.trim() : null,
        carrera: dto.carrera.trim(),
        tipo: dto.tipo,
        anio: dto.anio,
        resumen: dto.resumen.trim(),
        palabrasClave: dto.palabrasClave,
        archivoUrl: savedPdf.relativePath,
        disponible: dto.disponible ?? true,
        departamentoOrigenId: dto.departamentoOrigenId ?? null,
      },
      include: this.getDocumentoInclude(),
    });

    return {
      message: `El documento "${creado.titulo}" fue catalogado exitosamente y su archivo PDF quedó resguardado en almacenamiento privado.`,
      documento: this.toDocumentItemDto(creado),
    };
  }

  /**
   * Buscador público paginado del catálogo con filtros combinables (RF02):
   * texto libre (q), departamentoId, carrera, tipo, anio / rango anioDesde-anioHasta y disponible.
   */
  async findAll(query: QueryDocumentsDto): Promise<DocumentsListResponseDto> {
    if (
      query.anioDesde !== undefined &&
      query.anioHasta !== undefined &&
      query.anioDesde > query.anioHasta
    ) {
      throw new BadRequestException(
        'El filtro anioDesde no puede ser mayor que anioHasta.',
      );
    }

    const where: Prisma.DocumentoWhereInput = {};

    if (query.q && query.q.trim().length > 0) {
      const search = query.q.trim();
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { autor: { contains: search, mode: 'insensitive' } },
        { director: { contains: search, mode: 'insensitive' } },
        { resumen: { contains: search, mode: 'insensitive' } },
        { carrera: { contains: search, mode: 'insensitive' } },
        {
          palabrasClave: {
            hasSome: [search, search.toLowerCase(), search.toUpperCase()],
          },
        },
      ];
    }

    if (query.departamentoId) {
      where.departamentoOrigenId = query.departamentoId;
    }

    if (query.carrera && query.carrera.trim().length > 0) {
      where.carrera = {
        contains: query.carrera.trim(),
        mode: 'insensitive',
      };
    }

    if (query.tipo) {
      where.tipo = query.tipo;
    }

    if (query.anio !== undefined) {
      where.anio = query.anio;
    } else if (query.anioDesde !== undefined || query.anioHasta !== undefined) {
      where.anio = {
        ...(query.anioDesde !== undefined ? { gte: query.anioDesde } : {}),
        ...(query.anioHasta !== undefined ? { lte: query.anioHasta } : {}),
      };
    }

    if (query.disponible !== undefined) {
      where.disponible = query.disponible;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const [documentos, total] = await Promise.all([
      this.prisma.documento.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ anio: 'desc' }, { titulo: 'asc' }],
        include: this.getDocumentoInclude(),
      }),
      this.prisma.documento.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
      items: documentos.map((doc) => this.toDocumentItemDto(doc)),
    };
  }

  /**
   * Obtiene la ficha bibliográfica completa de un documento por su UUID (RF02),
   * sin exponer nunca la ruta física ni el contenido binario del PDF.
   */
  async findOne(id: string): Promise<DocumentItemDto> {
    const documento = await this.prisma.documento.findUnique({
      where: { id },
      include: this.getDocumentoInclude(),
    });

    if (!documento) {
      throw new NotFoundException(
        `No se encontró ningún documento académico con ID "${id}".`,
      );
    }

    return this.toDocumentItemDto(documento);
  }

  /**
   * Implementa el método de dominio estaDisponible() del Diagrama de Clases (Figura 2).
   * En modalidad de préstamo digital multiusuario:
   * 1. Verifica que el documento esté habilitado administrativamente por Biblioteca (disponible = true).
   * 2. Si se indica un usuarioId, comprueba que ese mismo usuario no posea ya un préstamo ACTIVO vigente sobre este documento.
   */
  async estaDisponible(id: string, usuarioId?: string): Promise<boolean> {
    const documento = await this.prisma.documento.findUnique({
      where: { id },
      select: {
        id: true,
        disponible: true,
      },
    });

    if (!documento || !documento.disponible) {
      return false;
    }

    if (!usuarioId) {
      return true;
    }

    const prestamoActivoUsuario = await this.prisma.prestamo.findFirst({
      where: {
        documentoId: id,
        usuarioId,
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });

    return !prestamoActivoUsuario;
  }

  /**
   * Actualiza los metadatos de un documento y, opcionalmente, reemplaza su archivo PDF (Solo Admin - RF01).
   */
  async update(
    id: string,
    dto: UpdateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<DocumentMutationResponseDto> {
    const existente = await this.prisma.documento.findUnique({
      where: { id },
    });

    if (!existente) {
      throw new NotFoundException(
        `No se encontró ningún documento académico con ID "${id}".`,
      );
    }

    if (dto.departamentoOrigenId) {
      await this.ensureDepartamentoExists(dto.departamentoOrigenId);
    }

    let nuevaRutaPdf: string | undefined;
    if (file) {
      const savedPdf = await this.pdfStorageService.validateAndSavePdf(
        file,
        dto.titulo ?? existente.titulo,
      );
      nuevaRutaPdf = savedPdf.relativePath;
    }

    const actualizado = await this.prisma.documento.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.autor !== undefined ? { autor: dto.autor.trim() } : {}),
        ...(dto.director !== undefined
          ? { director: dto.director ? dto.director.trim() : null }
          : {}),
        ...(dto.carrera !== undefined ? { carrera: dto.carrera.trim() } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.anio !== undefined ? { anio: dto.anio } : {}),
        ...(dto.resumen !== undefined ? { resumen: dto.resumen.trim() } : {}),
        ...(dto.palabrasClave !== undefined
          ? { palabrasClave: dto.palabrasClave }
          : {}),
        ...(dto.departamentoOrigenId !== undefined
          ? { departamentoOrigenId: dto.departamentoOrigenId }
          : {}),
        ...(dto.disponible !== undefined ? { disponible: dto.disponible } : {}),
        ...(nuevaRutaPdf !== undefined ? { archivoUrl: nuevaRutaPdf } : {}),
      },
      include: this.getDocumentoInclude(),
    });

    if (nuevaRutaPdf && existente.archivoUrl !== nuevaRutaPdf) {
      await this.pdfStorageService.deletePdfIfExists(existente.archivoUrl);
    }

    return {
      message: `El documento "${actualizado.titulo}" fue actualizado correctamente.`,
      documento: this.toDocumentItemDto(actualizado),
    };
  }

  /**
   * Elimina un documento del catálogo y remueve su archivo PDF del almacenamiento privado (Solo Admin - RF01).
   * Impide eliminar documentos con préstamos activos en curso.
   */
  async remove(id: string): Promise<DeleteDocumentResponseDto> {
    const existente = await this.prisma.documento.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            prestamos: true,
          },
        },
        prestamos: {
          where: {
            estado: EstadoPrestamo.ACTIVO,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!existente) {
      throw new NotFoundException(
        `No se encontró ningún documento académico con ID "${id}".`,
      );
    }

    if (existente.prestamos.length > 0) {
      throw new ConflictException(
        `No se puede eliminar el documento "${existente.titulo}" porque posee ${existente.prestamos.length} préstamo(s) activo(s) en curso. Deshabilítelo (disponible = false) o revoque los préstamos primero.`,
      );
    }

    if (existente._count.prestamos > 0) {
      throw new ConflictException(
        `No se puede eliminar físicamente el documento "${existente.titulo}" porque registra historial de préstamos en auditoría. Puede suspender su disponibilidad con PATCH /api/v1/documentos/${id} ({ "disponible": false }).`,
      );
    }

    await this.prisma.documento.delete({
      where: { id },
    });

    await this.pdfStorageService.deletePdfIfExists(existente.archivoUrl);

    return {
      message: `El documento "${existente.titulo}" fue eliminado del catálogo y su archivo PDF fue removido del almacenamiento privado.`,
      id,
    };
  }

  private async ensureDepartamentoExists(
    departamentoId: string,
  ): Promise<void> {
    const depto = await this.prisma.departamento.findUnique({
      where: { id: departamentoId },
      select: { id: true },
    });

    if (!depto) {
      throw new BadRequestException(
        `El departamentoOrigenId "${departamentoId}" no corresponde a ninguno de los 19 departamentos de San Juan.`,
      );
    }
  }

  private getDocumentoInclude() {
    return {
      departamentoOrigen: {
        select: {
          id: true,
          nombre: true,
          esCapital: true,
        },
      },
      prestamos: {
        where: {
          estado: EstadoPrestamo.ACTIVO,
        },
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          prestamos: true,
        },
      },
    };
  }

  private toDocumentItemDto(doc: DocumentoWithRelations): DocumentItemDto {
    return {
      id: doc.id,
      titulo: doc.titulo,
      autor: doc.autor,
      director: doc.director,
      carrera: doc.carrera,
      tipo: doc.tipo,
      anio: doc.anio,
      resumen: doc.resumen,
      palabrasClave: doc.palabrasClave,
      disponible: doc.disponible,
      estaDisponible: doc.disponible,
      departamentoOrigenId: doc.departamentoOrigenId,
      departamentoOrigen: doc.departamentoOrigen,
      prestamosActivosCount: doc.prestamos.length,
      totalPrestamosHistoricos: doc._count.prestamos,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
