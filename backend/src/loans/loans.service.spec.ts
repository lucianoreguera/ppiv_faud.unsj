import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoPrestamo,
  EstadoValidacionUsuario,
  RolUsuario,
  TipoDocumento,
} from '@prisma/client';
import * as path from 'path';
import { CatalogService } from '../catalog/catalog.service';
import { PdfStorageService } from '../catalog/pdf-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractDrmTokenFromRequest } from './drm-stream.util';
import { LoanStateMachine } from './loan-state-machine';
import { LoansService } from './loans.service';

describe('LoansService & LoanStateMachine (Fase 4 - RF03, RF04, RNF02)', () => {
  let loansService: LoansService;
  let jwtService: JwtService;

  const testDrmSecret = 'test_drm_secret_7d_faud_unsj';
  const testSessionSecret = 'test_session_secret_faud_unsj';

  const mockPrismaService = {
    usuario: {
      findUnique: jest.fn(),
    },
    documento: {
      findUnique: jest.fn(),
    },
    prestamo: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockCatalogService = {
    estaDisponible: jest.fn(),
  };

  const mockPdfStorageService = {
    resolveSafeFilePath: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'drm.loanJwtSecret') return testDrmSecret;
      if (key === 'auth.jwtSecret') return testSessionSecret;
      if (key === 'drm.loanDurationDays') return 7;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.prestamo.updateMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        LoansService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: PdfStorageService, useValue: mockPdfStorageService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    loansService = module.get<LoansService>(LoansService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('LoanStateMachine (Diagrama de Estados — Figura 5)', () => {
    it('debe permitir las transiciones válidas del ciclo de vida del préstamo', () => {
      expect(
        LoanStateMachine.canTransition(
          EstadoPrestamo.SOLICITADO,
          EstadoPrestamo.ACTIVO,
        ),
      ).toBe(true);
      expect(
        LoanStateMachine.canTransition(
          EstadoPrestamo.SOLICITADO,
          EstadoPrestamo.RECHAZADO,
        ),
      ).toBe(true);
      expect(
        LoanStateMachine.canTransition(
          EstadoPrestamo.ACTIVO,
          EstadoPrestamo.VENCIDO,
        ),
      ).toBe(true);
      expect(
        LoanStateMachine.canTransition(
          EstadoPrestamo.ACTIVO,
          EstadoPrestamo.REVOCADO,
        ),
      ).toBe(true);
      expect(
        LoanStateMachine.canTransition(
          EstadoPrestamo.ACTIVO,
          EstadoPrestamo.CERRADO,
        ),
      ).toBe(true);
      expect(
        LoanStateMachine.canTransition(
          EstadoPrestamo.VENCIDO,
          EstadoPrestamo.CERRADO,
        ),
      ).toBe(true);
      expect(
        LoanStateMachine.canTransition(
          EstadoPrestamo.REVOCADO,
          EstadoPrestamo.CERRADO,
        ),
      ).toBe(true);
    });

    it('debe bloquear con ConflictException cualquier transición inválida o reactivación ilegal', () => {
      expect(() =>
        LoanStateMachine.assertTransition(
          EstadoPrestamo.VENCIDO,
          EstadoPrestamo.ACTIVO,
        ),
      ).toThrow(ConflictException);

      expect(() =>
        LoanStateMachine.assertTransition(
          EstadoPrestamo.REVOCADO,
          EstadoPrestamo.ACTIVO,
        ),
      ).toThrow(ConflictException);

      expect(() =>
        LoanStateMachine.assertTransition(
          EstadoPrestamo.VENCIDO,
          EstadoPrestamo.REVOCADO,
        ),
      ).toThrow(ConflictException);

      expect(() =>
        LoanStateMachine.assertTransition(
          EstadoPrestamo.RECHAZADO,
          EstadoPrestamo.ACTIVO,
        ),
      ).toThrow(ConflictException);
    });

    it('allowsReading() solo debe habilitar la lectura para estado ACTIVO', () => {
      expect(LoanStateMachine.allowsReading(EstadoPrestamo.ACTIVO)).toBe(true);
      expect(LoanStateMachine.allowsReading(EstadoPrestamo.VENCIDO)).toBe(
        false,
      );
      expect(LoanStateMachine.allowsReading(EstadoPrestamo.REVOCADO)).toBe(
        false,
      );
      expect(LoanStateMachine.allowsReading(EstadoPrestamo.RECHAZADO)).toBe(
        false,
      );
      expect(LoanStateMachine.allowsReading(EstadoPrestamo.CERRADO)).toBe(
        false,
      );
    });

    it('isTerminal() debe identificar como terminales únicamente a RECHAZADO y CERRADO', () => {
      expect(LoanStateMachine.isTerminal(EstadoPrestamo.RECHAZADO)).toBe(true);
      expect(LoanStateMachine.isTerminal(EstadoPrestamo.CERRADO)).toBe(true);
      expect(LoanStateMachine.isTerminal(EstadoPrestamo.SOLICITADO)).toBe(
        false,
      );
      expect(LoanStateMachine.isTerminal(EstadoPrestamo.ACTIVO)).toBe(false);
      expect(LoanStateMachine.isTerminal(EstadoPrestamo.VENCIDO)).toBe(false);
      expect(LoanStateMachine.isTerminal(EstadoPrestamo.REVOCADO)).toBe(false);
    });
  });

  describe('LoansService (Solicitud, Vigencia, Revocación y Doble Verificación DRM)', () => {
    const sampleUser = {
      id: 'user-ana-uuid',
      nombre: 'Ana Pérez',
      email: 'ana.perez@jachal.gov.ar',
      estadoValidacion: EstadoValidacionUsuario.APROBADO,
      departamento: {
        id: 'depto-jachal-uuid',
        nombre: 'Jáchal',
        esCapital: false,
      },
    };

    const sampleDoc = {
      id: 'doc-vivienda-uuid',
      titulo: 'Vivienda social en Cuyo',
      autor: 'L. Martínez',
      director: 'Mg. Arq. Claudia Quiroga',
      carrera: 'Arquitectura',
      tipo: TipoDocumento.INVESTIGACION,
      anio: 2021,
      archivoUrl: 'storage/pdfs/vivienda-social-cuyo-2021.pdf',
      disponible: true,
      departamentoOrigen: {
        id: 'depto-jachal-uuid',
        nombre: 'Jáchal',
        esCapital: false,
      },
    };

    it('solicitarPrestamo() debe otorgar un préstamo ACTIVO por 7 días, firmar el JWT DRM y generar la marca de agua', async () => {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      mockPrismaService.usuario.findUnique.mockResolvedValue(sampleUser);
      mockPrismaService.documento.findUnique.mockResolvedValue({
        id: sampleDoc.id,
        titulo: sampleDoc.titulo,
        disponible: true,
      });
      mockPrismaService.prestamo.findFirst.mockResolvedValue(null);
      mockCatalogService.estaDisponible.mockResolvedValue(true);

      mockPrismaService.prestamo.create.mockResolvedValue({
        id: 'prestamo-uuid-1024',
        codigoReferencia: 1024,
        usuarioId: sampleUser.id,
        documentoId: sampleDoc.id,
        fechaInicio: now,
        fechaVencimiento: in7Days,
        estado: EstadoPrestamo.ACTIVO,
      });

      mockPrismaService.prestamo.update.mockImplementation(
        async ({ data }: { data: { tokenAcceso: string } }) => ({
          id: 'prestamo-uuid-1024',
          codigoReferencia: 1024,
          usuarioId: sampleUser.id,
          documentoId: sampleDoc.id,
          fechaInicio: now,
          fechaVencimiento: in7Days,
          estado: EstadoPrestamo.ACTIVO,
          tokenAcceso: data.tokenAcceso,
          createdAt: now,
          updatedAt: now,
          usuario: sampleUser,
          documento: sampleDoc,
        }),
      );

      const response = await loansService.solicitarPrestamo(sampleUser.id, {
        documentoId: sampleDoc.id,
      });

      expect(response.prestamo.estado).toBe(EstadoPrestamo.ACTIVO);
      expect(response.prestamo.codigoFormateado).toBe('#1024');
      expect(response.marcaAgua).toBe('Ana Pérez · Préstamo #1024');
      expect(response.expiresInDays).toBe(7);
      expect(response.tokenAcceso).toBeDefined();
      expect(response.drm.permitirDescarga).toBe(false);
      expect(response.drm.permitirImpresion).toBe(false);

      const decoded = await jwtService.verifyAsync(response.tokenAcceso, {
        secret: testDrmSecret,
      });
      expect(decoded.sub).toBe(sampleUser.id);
      expect(decoded.prestamoId).toBe('prestamo-uuid-1024');
      expect(decoded.documentoId).toBe(sampleDoc.id);
      expect(decoded.type).toBe('LOAN_DRM_7D');
    });

    it('solicitarPrestamo() debe rechazar con ConflictException si el usuario ya tiene un préstamo ACTIVO sobre ese documento', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(sampleUser);
      mockPrismaService.documento.findUnique.mockResolvedValue({
        id: sampleDoc.id,
        titulo: sampleDoc.titulo,
        disponible: true,
      });
      mockPrismaService.prestamo.findFirst.mockResolvedValue({
        id: 'prestamo-existente',
        codigoReferencia: 1024,
        fechaVencimiento: new Date(Date.now() + 86400000),
      });

      await expect(
        loansService.solicitarPrestamo(sampleUser.id, {
          documentoId: sampleDoc.id,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('solicitarPrestamo() debe registrar estado RECHAZADO y lanzar ConflictException si el documento está suspendido por Biblioteca', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(sampleUser);
      mockPrismaService.documento.findUnique.mockResolvedValue({
        id: sampleDoc.id,
        titulo: sampleDoc.titulo,
        disponible: false,
      });
      mockPrismaService.prestamo.findFirst.mockResolvedValue(null);
      mockCatalogService.estaDisponible.mockResolvedValue(false);
      mockPrismaService.prestamo.create.mockResolvedValue({
        id: 'prestamo-rechazado-uuid',
        estado: EstadoPrestamo.RECHAZADO,
      });

      await expect(
        loansService.solicitarPrestamo(sampleUser.id, {
          documentoId: sampleDoc.id,
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.prestamo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: EstadoPrestamo.RECHAZADO,
          }),
        }),
      );
    });

    it('validarVigencia() debe pasar automáticamente a VENCIDO y retornar false si fechaVencimiento <= now()', async () => {
      const expiredDate = new Date(Date.now() - 60000);
      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'prestamo-vencido-uuid',
        codigoReferencia: 1025,
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: expiredDate,
        documento: { titulo: sampleDoc.titulo },
      });
      mockPrismaService.prestamo.update.mockResolvedValue({
        id: 'prestamo-vencido-uuid',
        estado: EstadoPrestamo.VENCIDO,
      });

      const vigente = await loansService.validarVigencia(
        'prestamo-vencido-uuid',
      );

      expect(vigente).toBe(false);
      expect(mockPrismaService.prestamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prestamo-vencido-uuid' },
          data: expect.objectContaining({
            estado: EstadoPrestamo.VENCIDO,
          }),
        }),
      );
    });

    it('revocarAcceso() debe cambiar el estado de ACTIVO a REVOCADO y bloquear intentos posteriores', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'prestamo-activo-1024',
        codigoReferencia: 1024,
        usuarioId: sampleUser.id,
        documentoId: sampleDoc.id,
        fechaInicio: new Date(),
        fechaVencimiento: futureDate,
        estado: EstadoPrestamo.ACTIVO,
        tokenAcceso: 'token',
        createdAt: new Date(),
        updatedAt: new Date(),
        usuario: sampleUser,
        documento: sampleDoc,
      });

      mockPrismaService.prestamo.update.mockResolvedValue({
        id: 'prestamo-activo-1024',
        codigoReferencia: 1024,
        usuarioId: sampleUser.id,
        documentoId: sampleDoc.id,
        fechaInicio: new Date(),
        fechaVencimiento: futureDate,
        estado: EstadoPrestamo.REVOCADO,
        tokenAcceso: 'token',
        createdAt: new Date(),
        updatedAt: new Date(),
        usuario: sampleUser,
        documento: sampleDoc,
      });

      const res = await loansService.revocarAcceso('prestamo-activo-1024', {
        motivo: 'Auditoría de derechos de autor.',
      });

      expect(res.estadoAnterior).toBe(EstadoPrestamo.ACTIVO);
      expect(res.estadoActual).toBe(EstadoPrestamo.REVOCADO);
      expect(res.prestamo.vigente).toBe(false);
    });

    it('validateDrmAccessByDocument() debe rechazar con 403 Forbidden si el préstamo fue REVOCADO aunque el JWT DRM no haya expirado', async () => {
      const validUnexpiredDrmToken = await jwtService.signAsync(
        {
          sub: sampleUser.id,
          prestamoId: 'prestamo-revocado-uuid',
          documentoId: sampleDoc.id,
          docId: sampleDoc.id,
          codigoReferencia: 1024,
          marcaAgua: 'Ana Pérez · Préstamo #1024',
          type: 'LOAN_DRM_7D',
        },
        {
          secret: testDrmSecret,
          expiresIn: '7d',
        },
      );

      mockPrismaService.documento.findUnique.mockResolvedValue({
        id: sampleDoc.id,
      });
      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'prestamo-revocado-uuid',
        codigoReferencia: 1024,
        estado: EstadoPrestamo.REVOCADO,
        fechaVencimiento: new Date(Date.now() + 5 * 86400000),
        documento: { titulo: sampleDoc.titulo },
      });

      await expect(
        loansService.validateDrmAccessByDocument(
          sampleDoc.id,
          `Bearer ${validUnexpiredDrmToken}`,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validateDrmAccessByDocument() debe rechazar con 401 Unauthorized si no se envía token', async () => {
      mockPrismaService.documento.findUnique.mockResolvedValue({
        id: sampleDoc.id,
      });

      await expect(
        loansService.validateDrmAccessByDocument(sampleDoc.id, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('validateDrmAccessByDocument() debe autorizar el acceso cuando el JWT DRM es válido y el préstamo sigue ACTIVO en PostgreSQL', async () => {
      const futureDate = new Date(Date.now() + 6 * 86400000);
      const validDrmToken = await jwtService.signAsync(
        {
          sub: sampleUser.id,
          prestamoId: 'prestamo-vigente-uuid',
          documentoId: sampleDoc.id,
          docId: sampleDoc.id,
          codigoReferencia: 1024,
          marcaAgua: 'Ana Pérez · Préstamo #1024',
          type: 'LOAN_DRM_7D',
        },
        {
          secret: testDrmSecret,
          expiresIn: '7d',
        },
      );

      mockPrismaService.documento.findUnique.mockResolvedValue({
        id: sampleDoc.id,
      });
      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'prestamo-vigente-uuid',
        codigoReferencia: 1024,
        usuarioId: sampleUser.id,
        documentoId: sampleDoc.id,
        fechaInicio: new Date(),
        fechaVencimiento: futureDate,
        estado: EstadoPrestamo.ACTIVO,
        tokenAcceso: validDrmToken,
        createdAt: new Date(),
        updatedAt: new Date(),
        usuario: sampleUser,
        documento: sampleDoc,
      });

      const realSamplePdf = path.resolve(
        process.cwd(),
        'storage/pdfs/vivienda-social-cuyo-2021.pdf',
      );
      mockPdfStorageService.resolveSafeFilePath.mockReturnValue(realSamplePdf);

      const access = await loansService.validateDrmAccessByDocument(
        sampleDoc.id,
        `Bearer ${validDrmToken}`,
      );

      expect(access.prestamoId).toBe('prestamo-vigente-uuid');
      expect(access.marcaAgua).toBe('Ana Pérez · Préstamo #1024');
      expect(access.diasRestantes).toBeGreaterThanOrEqual(6);
    });

    it('validarVigencia() debe retornar true sin modificar estado cuando el préstamo está ACTIVO y fechaVencimiento > now()', async () => {
      const futureDate = new Date(Date.now() + 4 * 86400000);
      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'prestamo-activo-ok',
        codigoReferencia: 1030,
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: futureDate,
        documento: { titulo: sampleDoc.titulo },
      });

      const vigente = await loansService.validarVigencia('prestamo-activo-ok');

      expect(vigente).toBe(true);
      expect(mockPrismaService.prestamo.update).not.toHaveBeenCalled();
    });

    it('validarVigencia() debe retornar false para préstamos en estado REVOCADO, CERRADO o inexistentes', async () => {
      mockPrismaService.prestamo.findUnique.mockResolvedValueOnce({
        id: 'prestamo-revocado-1',
        codigoReferencia: 1031,
        estado: EstadoPrestamo.REVOCADO,
        fechaVencimiento: new Date(Date.now() + 86400000),
        documento: { titulo: sampleDoc.titulo },
      });
      await expect(
        loansService.validarVigencia('prestamo-revocado-1'),
      ).resolves.toBe(false);

      mockPrismaService.prestamo.findUnique.mockResolvedValueOnce(null);
      await expect(
        loansService.validarVigencia('prestamo-inexistente'),
      ).resolves.toBe(false);
    });

    it('revocarAcceso() debe lanzar ConflictException si el préstamo ya está VENCIDO o REVOCADO', async () => {
      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'prestamo-ya-vencido',
        codigoReferencia: 1032,
        usuarioId: sampleUser.id,
        documentoId: sampleDoc.id,
        fechaInicio: new Date(Date.now() - 8 * 86400000),
        fechaVencimiento: new Date(Date.now() - 86400000),
        estado: EstadoPrestamo.VENCIDO,
        tokenAcceso: 'token',
        createdAt: new Date(),
        updatedAt: new Date(),
        usuario: sampleUser,
        documento: sampleDoc,
      });

      await expect(
        loansService.revocarAcceso('prestamo-ya-vencido', {
          motivo: 'Intento de revocar préstamo ya vencido',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('cerrarPrestamo() debe permitir al titular pasar un préstamo ACTIVO a CERRADO y rechazar a terceros con ForbiddenException', async () => {
      const futureDate = new Date(Date.now() + 3 * 86400000);
      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'prestamo-cerrar-1',
        codigoReferencia: 1033,
        usuarioId: sampleUser.id,
        documentoId: sampleDoc.id,
        fechaInicio: new Date(),
        fechaVencimiento: futureDate,
        estado: EstadoPrestamo.ACTIVO,
        tokenAcceso: 'token',
        createdAt: new Date(),
        updatedAt: new Date(),
        usuario: sampleUser,
        documento: sampleDoc,
      });

      // Intento por otro estudiante no titular -> ForbiddenException
      await expect(
        loansService.cerrarPrestamo('prestamo-cerrar-1', {
          id: 'otro-usuario-uuid',
          nombre: 'Otro Estudiante',
          email: 'otro@unsj.edu.ar',
          rol: RolUsuario.USUARIO,
          estadoValidacion: EstadoValidacionUsuario.APROBADO,
          departamentoId: 'depto-jachal-uuid',
          departamento: sampleUser.departamento,
        }),
      ).rejects.toThrow(ForbiddenException);

      // Cierre por el titular -> CERRADO
      mockPrismaService.prestamo.update.mockResolvedValue({
        id: 'prestamo-cerrar-1',
        codigoReferencia: 1033,
        usuarioId: sampleUser.id,
        documentoId: sampleDoc.id,
        fechaInicio: new Date(),
        fechaVencimiento: futureDate,
        estado: EstadoPrestamo.CERRADO,
        tokenAcceso: 'token',
        createdAt: new Date(),
        updatedAt: new Date(),
        usuario: sampleUser,
        documento: sampleDoc,
      });

      const closed = await loansService.cerrarPrestamo('prestamo-cerrar-1', {
        id: sampleUser.id,
        nombre: sampleUser.nombre,
        email: sampleUser.email,
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.APROBADO,
        departamentoId: sampleUser.departamento.id,
        departamento: sampleUser.departamento,
      });

      expect(closed.estadoAnterior).toBe(EstadoPrestamo.ACTIVO);
      expect(closed.estadoActual).toBe(EstadoPrestamo.CERRADO);
    });

    it('extractDrmTokenFromRequest() debe priorizar x-drm-token, luego query token y finalmente Authorization', () => {
      expect(
        extractDrmTokenFromRequest(
          'Bearer auth-header',
          'drm-header-token',
          'query-token',
        ),
      ).toBe('drm-header-token');
      expect(
        extractDrmTokenFromRequest(
          'Bearer auth-header',
          undefined,
          'query-token',
        ),
      ).toBe('query-token');
      expect(
        extractDrmTokenFromRequest('Bearer auth-header', undefined, undefined),
      ).toBe('Bearer auth-header');
      expect(extractDrmTokenFromRequest(undefined, undefined, undefined)).toBe(
        undefined,
      );
    });
  });
});
