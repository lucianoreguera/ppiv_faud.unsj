import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoValidacionUsuario,
  RolUsuario,
  TipoDocumento,
} from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PdfStorageService } from './../src/catalog/pdf-storage.service';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Repositorio FAUD-UNSJ — Fases 0, 1, 2 y 3 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUserEmail = 'alumno.prueba.fase2@jachal.gov.ar';
  let jachalDepartamentoId: string;
  let registeredUserId: string;
  let adminAccessToken: string;
  let studentAccessToken: string;
  let createdDocumentId: string;

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
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Limpieza previa por si una corrida anterior dejó el usuario de prueba
    await prisma.usuario.deleteMany({
      where: { email: testUserEmail },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.usuario.deleteMany({
        where: { email: testUserEmail },
      });
    }
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

  describe('Fase 2 — Departamentos, Autenticación JWT y Gestión/Validación de Usuarios (RF05)', () => {
    it('GET /api/v1/departamentos debe devolver los 19 departamentos con Capital primero y métricas asociadas', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/departamentos')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(19);
      expect(response.body[0].nombre).toBe('Capital');
      expect(response.body[0].esCapital).toBe(true);

      const jachal = response.body.find(
        (d: { nombre: string }) => d.nombre === 'Jáchal',
      );
      expect(jachal).toBeDefined();
      expect(jachal.esCapital).toBe(false);
      jachalDepartamentoId = jachal.id;
    });

    it('GET /api/v1/departamentos/metricas debe devolver el consolidado territorial (Capital vs. 18 departamentos)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/departamentos/metricas')
        .expect(200);

      expect(response.body.totalDepartamentos).toBe(19);
      expect(response.body.usuariosCapital).toBeGreaterThanOrEqual(1);
      expect(
        response.body.usuariosDepartamentosAlejados,
      ).toBeGreaterThanOrEqual(5);
      expect(response.body.departamentos).toHaveLength(19);
    });

    it('POST /api/v1/auth/register debe registrar un nuevo estudiante de Jáchal en estado PENDIENTE', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          nombre: 'Ramiro Quiroga',
          email: testUserEmail,
          password: 'AlumnoTest123!',
          departamentoId: jachalDepartamentoId,
        })
        .expect(201);

      expect(response.body.message).toContain('PENDIENTE');
      expect(response.body.usuario).toEqual(
        expect.objectContaining({
          nombre: 'Ramiro Quiroga',
          email: testUserEmail,
          rol: RolUsuario.USUARIO,
          estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
          departamentoId: jachalDepartamentoId,
        }),
      );
      expect(response.body.usuario.passwordHash).toBeUndefined();
      registeredUserId = response.body.usuario.id;
    });

    it('POST /api/v1/auth/register debe rechazar con 409 Conflict un correo electrónico duplicado', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          nombre: 'Ramiro Duplicado',
          email: testUserEmail,
          password: 'AlumnoTest123!',
          departamentoId: jachalDepartamentoId,
        })
        .expect(409);
    });

    it('POST /api/v1/auth/login debe bloquear con 403 Forbidden el inicio de sesión de un usuario PENDIENTE', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: 'AlumnoTest123!',
        })
        .expect(403);

      expect(response.body.message).toContain('PENDIENTE');
    });

    it('POST /api/v1/auth/login debe autenticar al Administrador de Biblioteca y emitir un JWT válido', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@faud.unsj.edu.ar',
          password: 'Admin123!',
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.tokenType).toBe('Bearer');
      expect(response.body.usuario.rol).toBe(RolUsuario.ADMINISTRADOR);
      adminAccessToken = response.body.accessToken;
    });

    it('GET /api/v1/usuarios debe permitir al Admin listar los usuarios pendientes y obtener contadores de pestañas', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/usuarios')
        .query({ estado: EstadoValidacionUsuario.PENDIENTE })
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.contadores).toEqual(
        expect.objectContaining({
          todos: expect.any(Number),
          pendientes: expect.any(Number),
          aprobados: expect.any(Number),
          rechazados: expect.any(Number),
        }),
      );
      expect(response.body.contadores.pendientes).toBeGreaterThanOrEqual(4);

      const encontrado = response.body.items.find(
        (u: { id: string }) => u.id === registeredUserId,
      );
      expect(encontrado).toBeDefined();
      expect(encontrado.departamento.nombre).toBe('Jáchal');
    });

    it('PATCH /api/v1/usuarios/:id/estado debe permitir al Admin aprobar la cuenta del estudiante de Jáchal', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/usuarios/${registeredUserId}/estado`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          estado: EstadoValidacionUsuario.APROBADO,
          motivo: 'Alumno regular validado por Biblioteca FAUD-UNSJ.',
        })
        .expect(200);

      expect(response.body.estadoAnterior).toBe(
        EstadoValidacionUsuario.PENDIENTE,
      );
      expect(response.body.estadoActual).toBe(EstadoValidacionUsuario.APROBADO);
      expect(response.body.usuario.estadoValidacion).toBe(
        EstadoValidacionUsuario.APROBADO,
      );
    });

    it('POST /api/v1/auth/login debe permitir iniciar sesión al estudiante tras ser APROBADO por Biblioteca', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: 'AlumnoTest123!',
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.usuario.estadoValidacion).toBe(
        EstadoValidacionUsuario.APROBADO,
      );
      expect(response.body.usuario.departamento.nombre).toBe('Jáchal');
      studentAccessToken = response.body.accessToken;
    });

    it('GET /api/v1/auth/profile debe retornar el perfil del estudiante autenticado con su JWT', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(registeredUserId);
      expect(response.body.email).toBe(testUserEmail);
      expect(response.body.rol).toBe(RolUsuario.USUARIO);
      expect(response.body.departamento.nombre).toBe('Jáchal');
    });

    it('GET /api/v1/usuarios debe rechazar con 403 Forbidden el acceso de un usuario con rol USUARIO', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(403);
    });
  });

  describe('Fase 3 — Módulo de Catálogo y Almacenamiento Seguro de PDFs (RF01, RF02)', () => {
    it('GET /api/v1/documentos debe permitir búsqueda pública paginada sin exponer archivoUrl', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/documentos')
        .expect(200);

      expect(response.body.meta).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          page: 1,
          limit: 12,
          totalPages: expect.any(Number),
        }),
      );
      expect(response.body.items.length).toBeGreaterThanOrEqual(4);
      expect(response.body.items[0].archivoUrl).toBeUndefined();
      expect(response.body.items[0].estaDisponible).toBeDefined();
    });

    it('GET /api/v1/documentos debe filtrar combinadamente por departamentoId, texto (q), carrera y rango de años', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/documentos')
        .query({
          q: 'Vivienda',
          departamentoId: jachalDepartamentoId,
          carrera: 'Arquitectura',
          tipo: TipoDocumento.INVESTIGACION,
          anioDesde: 2020,
          anioHasta: 2023,
          disponible: true,
        })
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].titulo).toBe('Vivienda social en Cuyo');
      expect(response.body.items[0].departamentoOrigen.nombre).toBe('Jáchal');
    });

    it('POST /api/v1/documentos debe rechazar con 403 Forbidden el intento de carga de un estudiante (rol USUARIO)', async () => {
      const pdfBuffer = PdfStorageService.buildSamplePdfBuffer(
        'Intento No Autorizado',
        'Alumno',
        2025,
      );

      await request(app.getHttpServer())
        .post('/api/v1/documentos')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .field('titulo', 'Intento No Autorizado')
        .field('autor', 'Ramiro Quiroga')
        .field('carrera', 'Arquitectura')
        .field('tipo', TipoDocumento.TESIS)
        .field('anio', '2025')
        .field('resumen', 'Intento de subida sin rol administrador.')
        .field('palabrasClave', 'prueba, seguridad')
        .attach('archivo', pdfBuffer, {
          filename: 'intento.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);
    });

    it('POST /api/v1/documentos debe rechazar con 400 Bad Request un archivo que no sea PDF real (%PDF-)', async () => {
      const fakePdfBuffer = Buffer.from(
        'Contenido de texto plano disfrazado de PDF',
      );

      await request(app.getHttpServer())
        .post('/api/v1/documentos')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .field('titulo', 'Archivo Inválido')
        .field('autor', 'Admin')
        .field('carrera', 'Arquitectura')
        .field('tipo', TipoDocumento.MONOGRAFIA)
        .field('anio', '2025')
        .field('resumen', 'Prueba de validación de magic bytes de PDF.')
        .field('palabrasClave', 'seguridad, validacion')
        .attach('archivo', fakePdfBuffer, {
          filename: 'falso.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
    });

    it('POST /api/v1/documentos debe permitir al Administrador catalogar un documento con archivo PDF privado', async () => {
      const validPdfBuffer = PdfStorageService.buildSamplePdfBuffer(
        'Patrimonio vernáculo en Jáchal',
        'Arq. Lucía Paredes',
        2025,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/documentos')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .field('titulo', 'Patrimonio vernáculo en Jáchal')
        .field('autor', 'Arq. Lucía Paredes')
        .field('director', 'Dr. Arq. Roberto Sánchez')
        .field('carrera', 'Arquitectura')
        .field('tipo', TipoDocumento.TESIS)
        .field('anio', '2025')
        .field(
          'resumen',
          'Relevamiento y puesta en valor de construcciones históricas en tierra cruda en el departamento de Jáchal.',
        )
        .field(
          'palabrasClave',
          'patrimonio, Jáchal, tierra cruda, arquitectura',
        )
        .field('departamentoOrigenId', jachalDepartamentoId)
        .attach('archivo', validPdfBuffer, {
          filename: 'patrimonio-vernaculo-jachal.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(response.body.documento).toEqual(
        expect.objectContaining({
          titulo: 'Patrimonio vernáculo en Jáchal',
          autor: 'Arq. Lucía Paredes',
          carrera: 'Arquitectura',
          tipo: TipoDocumento.TESIS,
          anio: 2025,
          disponible: true,
          estaDisponible: true,
          departamentoOrigenId: jachalDepartamentoId,
          palabrasClave: [
            'patrimonio',
            'Jáchal',
            'tierra cruda',
            'arquitectura',
          ],
        }),
      );
      expect(response.body.documento.archivoUrl).toBeUndefined();
      createdDocumentId = response.body.documento.id;
    });

    it('GET /api/v1/documentos/:id debe devolver la ficha detallada sin exponer URL directa al PDF y bloquear acceso estático directo', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/documentos/${createdDocumentId}`)
        .expect(200);

      expect(response.body.id).toBe(createdDocumentId);
      expect(response.body.estaDisponible).toBe(true);
      expect(response.body.archivoUrl).toBeUndefined();

      // Verificamos que la ruta física en base de datos exista pero NO sea accesible públicamente vía HTTP
      const dbRecord = await prisma.documento.findUnique({
        where: { id: createdDocumentId },
      });
      expect(dbRecord?.archivoUrl).toContain('storage/pdfs/');

      await request(app.getHttpServer())
        .get(`/${dbRecord?.archivoUrl}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/v1/${dbRecord?.archivoUrl}`)
        .expect(404);
    });

    it('PATCH /api/v1/documentos/:id debe permitir al Admin actualizar metadatos y disponibilidad', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/documentos/${createdDocumentId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          disponible: false,
          director: 'Mg. Arq. Claudia Quiroga',
        })
        .expect(200);

      expect(response.body.documento.disponible).toBe(false);
      expect(response.body.documento.estaDisponible).toBe(false);
      expect(response.body.documento.director).toBe('Mg. Arq. Claudia Quiroga');
    });

    it('DELETE /api/v1/documentos/:id debe eliminar el documento de prueba y remover su PDF privado', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/documentos/${createdDocumentId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/documentos/${createdDocumentId}`)
        .expect(404);
    });
  });
});
