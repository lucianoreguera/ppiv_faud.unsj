import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoValidacionUsuario, RolUsuario } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Repositorio FAUD-UNSJ — Fase 0 & Fase 1 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HealthController (/api/v1/health)', () => {
    it('GET /api/v1/health debe responder 200 OK y confirmar conexión a PostgreSQL vía Prisma', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          service: 'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ',
          version: '0.1.0',
          database: expect.objectContaining({
            status: 'up',
          }),
        }),
      );
    });
  });

  describe('Fase 1 — Esquema Prisma y Datos de Semilla (Seed)', () => {
    it('debe contar con los 19 departamentos de San Juan (1 Capital y 18 restantes)', async () => {
      const departamentos = await prisma.departamento.findMany({
        orderBy: { nombre: 'asc' },
      });

      expect(departamentos).toHaveLength(19);

      const capital = departamentos.find((d) => d.nombre === 'Capital');
      expect(capital).toBeDefined();
      expect(capital?.esCapital).toBe(true);

      const noCapitales = departamentos.filter((d) => !d.esCapital);
      expect(noCapitales).toHaveLength(18);
    });

    it('debe contar con el Administrador de Biblioteca y los usuarios departamentales de prueba', async () => {
      const admin = await prisma.usuario.findUnique({
        where: { email: 'admin@faud.unsj.edu.ar' },
        include: { departamento: true },
      });

      expect(admin).toBeDefined();
      expect(admin?.rol).toBe(RolUsuario.ADMINISTRADOR);
      expect(admin?.estadoValidacion).toBe(EstadoValidacionUsuario.APROBADO);
      expect(admin?.departamento.nombre).toBe('Capital');

      const alumnaJachal = await prisma.usuario.findUnique({
        where: { email: 'ana.perez@jachal.gov.ar' },
        include: { departamento: true },
      });

      expect(alumnaJachal).toBeDefined();
      expect(alumnaJachal?.rol).toBe(RolUsuario.USUARIO);
      expect(alumnaJachal?.estadoValidacion).toBe(
        EstadoValidacionUsuario.APROBADO,
      );
      expect(alumnaJachal?.departamento.nombre).toBe('Jáchal');

      const pendientesCount = await prisma.usuario.count({
        where: { estadoValidacion: EstadoValidacionUsuario.PENDIENTE },
      });
      expect(pendientesCount).toBeGreaterThanOrEqual(3);
    });

    it('debe contar con el catálogo inicial de 4 documentos académicos vinculados a departamentos', async () => {
      const documentos = await prisma.documento.findMany({
        include: { departamentoOrigen: true },
      });

      expect(documentos.length).toBeGreaterThanOrEqual(4);

      const titulos = documentos.map((d) => d.titulo);
      expect(titulos).toEqual(
        expect.arrayContaining([
          'Accesibilidad urbana en San Juan',
          'Vivienda social en Cuyo',
          'Patrimonio arquitectónico sanjuanino',
          'Diseño bioclimático en zonas áridas',
        ]),
      );
    });
  });
});
