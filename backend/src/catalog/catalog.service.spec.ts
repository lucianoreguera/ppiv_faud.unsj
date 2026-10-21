import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TipoDocumento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';
import { PdfStorageService } from './pdf-storage.service';

describe('CatalogService & PdfStorageService (Fase 3 - RF01, RF02)', () => {
  let catalogService: CatalogService;
  let pdfStorageService: PdfStorageService;

  const mockPrismaService = {
    departamento: {
      findUnique: jest.fn(),
    },
    documento: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    prestamo: {
      findFirst: jest.fn(),
    },
  };

  const mockPdfStorageService = {
    validateAndSavePdf: jest.fn(),
    deletePdfIfExists: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PdfStorageService, useValue: mockPdfStorageService },
      ],
    }).compile();

    catalogService = module.get<CatalogService>(CatalogService);

    pdfStorageService = new PdfStorageService({
      get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
    } as unknown as ConfigService);
  });

  describe('PdfStorageService (Almacenamiento privado y validación de PDFs - RF01)', () => {
    it('debe rechazar con BadRequestException cuando no se adjunta archivo', async () => {
      await expect(
        pdfStorageService.validateAndSavePdf(undefined, 'Tesis Prueba'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar un archivo cuya extensión o MIME type no sea application/pdf', async () => {
      const fakeFile = {
        originalname: 'documento.exe',
        mimetype: 'application/octet-stream',
        size: 1024,
        buffer: Buffer.from('MZ-fake-executable'),
      } as Express.Multer.File;

      await expect(
        pdfStorageService.validateAndSavePdf(fakeFile, 'Documento Inválido'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar un archivo .pdf renombrado que no posea la firma binaria %PDF-', async () => {
      const spoofedPdf = {
        originalname: 'falso.pdf',
        mimetype: 'application/pdf',
        size: 128,
        buffer: Buffer.from('Esto no es un archivo PDF real'),
      } as Express.Multer.File;

      await expect(
        pdfStorageService.validateAndSavePdf(spoofedPdf, 'Falso PDF'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar un archivo PDF que supere el límite de 50 MB', async () => {
      const validBuffer = PdfStorageService.buildSamplePdfBuffer(
        'Tesis Grande',
        'Autor',
        2024,
      );
      const oversizedPdf = {
        originalname: 'tesis-pesada.pdf',
        mimetype: 'application/pdf',
        size: 51 * 1024 * 1024, // 51 MB
        buffer: validBuffer,
      } as Express.Multer.File;

      await expect(
        pdfStorageService.validateAndSavePdf(oversizedPdf, 'Tesis Grande'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('CatalogService (Gestión de catálogo y buscador público - RF01, RF02)', () => {
    const sampleDocRecord = {
      id: 'doc-uuid-1',
      titulo: 'Arquitectura sustentable en Calingasta',
      autor: 'Arq. Mariana Lucero',
      director: 'Dr. Arq. Roberto Sánchez',
      carrera: 'Arquitectura',
      tipo: TipoDocumento.TESIS,
      anio: 2024,
      resumen:
        'Análisis de estrategias bioclimáticas y constructivas en tierra.',
      palabrasClave: ['sustentabilidad', 'Calingasta', 'bioclimática'],
      archivoUrl: 'storage/pdfs/170000-arquitectura-sustentable.pdf',
      disponible: true,
      departamentoOrigenId: 'depto-calingasta-uuid',
      departamentoOrigen: {
        id: 'depto-calingasta-uuid',
        nombre: 'Calingasta',
        esCapital: false,
      },
      prestamos: [],
      _count: { prestamos: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('create() debe catalogar un documento con PDF privado sin exponer archivoUrl en la respuesta', async () => {
      mockPrismaService.departamento.findUnique.mockResolvedValue({
        id: 'depto-calingasta-uuid',
      });
      mockPdfStorageService.validateAndSavePdf.mockResolvedValue({
        relativePath: 'storage/pdfs/170000-arquitectura-sustentable.pdf',
        fileName: '170000-arquitectura-sustentable.pdf',
        sizeBytes: 2048,
      });
      mockPrismaService.documento.create.mockResolvedValue(sampleDocRecord);

      const mockFile = {
        originalname: 'tesis.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: PdfStorageService.buildSamplePdfBuffer(
          'Arquitectura sustentable en Calingasta',
          'Arq. Mariana Lucero',
          2024,
        ),
      } as Express.Multer.File;

      const result = await catalogService.create(
        {
          titulo: 'Arquitectura sustentable en Calingasta',
          autor: 'Arq. Mariana Lucero',
          director: 'Dr. Arq. Roberto Sánchez',
          carrera: 'Arquitectura',
          tipo: TipoDocumento.TESIS,
          anio: 2024,
          resumen:
            'Análisis de estrategias bioclimáticas y constructivas en tierra.',
          palabrasClave: ['sustentabilidad', 'Calingasta', 'bioclimática'],
          departamentoOrigenId: 'depto-calingasta-uuid',
          disponible: true,
        },
        mockFile,
      );

      expect(result.documento.id).toBe('doc-uuid-1');
      expect(result.documento.estaDisponible).toBe(true);
      expect(
        (result.documento as unknown as Record<string, unknown>).archivoUrl,
      ).toBeUndefined();
    });

    it('findAll() debe aplicar filtros combinados y devolver paginación', async () => {
      mockPrismaService.documento.findMany.mockResolvedValue([sampleDocRecord]);
      mockPrismaService.documento.count.mockResolvedValue(1);

      const response = await catalogService.findAll({
        q: 'Calingasta',
        carrera: 'Arquitectura',
        tipo: TipoDocumento.TESIS,
        anioDesde: 2020,
        anioHasta: 2025,
        disponible: true,
        page: 1,
        limit: 12,
      });

      expect(response.meta).toEqual({
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      });
      expect(response.items).toHaveLength(1);
      expect(response.items[0].titulo).toBe(
        'Arquitectura sustentable en Calingasta',
      );
    });

    it('findAll() debe rechazar con BadRequestException si anioDesde > anioHasta', async () => {
      await expect(
        catalogService.findAll({
          anioDesde: 2025,
          anioHasta: 2020,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('estaDisponible() debe permitir préstamos simultáneos multiusuario pero impedir duplicados del mismo usuario', async () => {
      mockPrismaService.documento.findUnique.mockResolvedValue({
        id: 'doc-uuid-1',
        disponible: true,
      });

      // Caso 1: Otro usuario no tiene préstamo activo -> disponible = true
      mockPrismaService.prestamo.findFirst.mockResolvedValueOnce(null);
      await expect(
        catalogService.estaDisponible('doc-uuid-1', 'user-uuid-nuevo'),
      ).resolves.toBe(true);

      // Caso 2: El mismo usuario ya tiene préstamo ACTIVO vigente -> disponible = false
      mockPrismaService.prestamo.findFirst.mockResolvedValueOnce({
        id: 'prestamo-activo-uuid',
      });
      await expect(
        catalogService.estaDisponible('doc-uuid-1', 'user-uuid-repetido'),
      ).resolves.toBe(false);
    });

    it('remove() debe bloquear con ConflictException la eliminación de un documento con préstamos activos', async () => {
      mockPrismaService.documento.findUnique.mockResolvedValue({
        ...sampleDocRecord,
        prestamos: [{ id: 'prestamo-activo-1' }],
        _count: { prestamos: 1 },
      });

      await expect(catalogService.remove('doc-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('findOne() debe lanzar NotFoundException si el documento no existe', async () => {
      mockPrismaService.documento.findUnique.mockResolvedValue(null);

      await expect(catalogService.findOne('uuid-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
