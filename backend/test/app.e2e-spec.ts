import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoPrestamo,
  EstadoValidacionUsuario,
  RolUsuario,
  TipoDocumento,
} from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PdfStorageService } from './../src/catalog/pdf-storage.service';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Repositorio FAUD-UNSJ — Fases 0, 1, 2, 3 y 4 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUserEmail = 'alumno.prueba.fase2@jachal.gov.ar';
  let jachalDepartamentoId: string;
  let registeredUserId: string;
  let adminAccessToken: string;
  let studentAccessToken: string;
  let anaAccessToken: string;
  let createdDocumentId: string;
  let seedDocumentId: string;
  let studentLoanId: string;
  let studentLoanDrmToken: string;
  let anaLoanId: string;
  let anaLoanDrmToken: string;

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

    // Limpieza previa por si una corrida anterior dejó datos de prueba
    await prisma.prestamo.deleteMany({
      where: {
        usuario: {
          email: { in: [testUserEmail, 'ana.perez@jachal.gov.ar'] },
        },
      },
    });
    await prisma.usuario.deleteMany({
      where: { email: testUserEmail },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.prestamo.deleteMany({
        where: {
          usuario: {
            email: { in: [testUserEmail, 'ana.perez@jachal.gov.ar'] },
          },
        },
      });
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

  describe('Fase 4 — Módulo de Préstamos, Máquina de Estados y DRM Temporal de 7 Días (RF03, RF04, RNF02)', () => {
    beforeAll(async () => {
      const docVivienda = await prisma.documento.findFirst({
        where: { titulo: 'Vivienda social en Cuyo' },
      });
      expect(docVivienda).toBeDefined();
      seedDocumentId = docVivienda!.id;
    });

    it('POST /api/v1/prestamos debe otorgar un préstamo ACTIVO por 7 días corridos, firmar el tokenAcceso DRM y construir la marca de agua', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/prestamos')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          documentoId: seedDocumentId,
        })
        .expect(201);

      expect(response.body.tokenAcceso).toBeDefined();
      expect(response.body.expiresInDays).toBe(7);
      expect(response.body.marcaAgua).toContain('Ramiro Quiroga · Préstamo #');
      expect(response.body.drm).toEqual(
        expect.objectContaining({
          permitirDescarga: false,
          permitirImpresion: false,
          permitirCopia: false,
          duracionMaximaDias: 7,
        }),
      );
      expect(response.body.prestamo).toEqual(
        expect.objectContaining({
          estado: EstadoPrestamo.ACTIVO,
          vigente: true,
          diasRestantes: 7,
          porVencer24h: false,
        }),
      );

      studentLoanId = response.body.prestamo.id;
      studentLoanDrmToken = response.body.tokenAcceso;
    });

    it('POST /api/v1/prestamos debe bloquear con 409 Conflict si el mismo usuario solicita un segundo préstamo ACTIVO sobre el mismo documento', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/prestamos')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          documentoId: seedDocumentId,
        })
        .expect(409);
    });

    it('POST /api/v1/prestamos debe permitir préstamos simultáneos multiusuario a otro estudiante sobre el mismo documento (Spec 03)', async () => {
      const loginAna = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'ana.perez@jachal.gov.ar',
          password: 'Alumno123!',
        })
        .expect(200);

      anaAccessToken = loginAna.body.accessToken;

      const loanAna = await request(app.getHttpServer())
        .post('/api/v1/prestamos')
        .set('Authorization', `Bearer ${anaAccessToken}`)
        .send({
          documentoId: seedDocumentId,
        })
        .expect(201);

      expect(loanAna.body.prestamo.estado).toBe(EstadoPrestamo.ACTIVO);
      expect(loanAna.body.marcaAgua).toContain('Ana Pérez · Préstamo #');
      anaLoanId = loanAna.body.prestamo.id;
      anaLoanDrmToken = loanAna.body.tokenAcceso;
    });

    it('GET /api/v1/prestamos/mis-prestamos debe listar los préstamos del estudiante con días restantes y contadores (Figma pág. 13)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/prestamos/mis-prestamos')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200);

      expect(response.body.contadores).toEqual(
        expect.objectContaining({
          todos: 1,
          activos: 1,
          porVencer24h: 0,
          vencidos: 0,
          revocados: 0,
        }),
      );
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].id).toBe(studentLoanId);
      expect(response.body.items[0].tokenAcceso).toBe(studentLoanDrmToken);
    });

    it('GET /api/v1/documentos/:id/ver (Camino alt 1 Figura 3) debe permitir visualizar el stream PDF con token DRM vigente e incluir encabezados de marca de agua (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/documentos/${seedDocumentId}/ver`)
        .set('Authorization', `Bearer ${studentLoanDrmToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('inline');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['x-drm-loan-id']).toBe(studentLoanId);
      expect(response.headers['x-drm-watermark']).toContain('Ramiro Quiroga');
      expect(response.headers['x-drm-allow-download']).toBe('false');
      expect(response.headers['x-drm-allow-print']).toBe('false');

      const pdfBuffer = response.body as Buffer;
      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('GET /api/v1/prestamos/:id/visor debe retornar los metadatos completos para el Visor Protegido (Figma pág. 14)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/prestamos/${studentLoanId}/visor`)
        .set('Authorization', `Bearer ${studentLoanDrmToken}`)
        .expect(200);

      expect(response.body.prestamoId).toBe(studentLoanId);
      expect(response.body.estado).toBe(EstadoPrestamo.ACTIVO);
      expect(response.body.marcaAgua).toContain('Ramiro Quiroga · Préstamo #');
      expect(response.body.drm.permitirDescarga).toBe(false);
      expect(response.body.documento.titulo).toBe('Vivienda social en Cuyo');
    });

    it('GET /api/v1/prestamos debe permitir al Administrador consultar el Tablero de Control con métricas operativas (Figma pág. 9)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/prestamos')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.metricas).toEqual(
        expect.objectContaining({
          activos: expect.any(Number),
          porVencer24h: expect.any(Number),
          vencidosHoy: expect.any(Number),
          vencidosTotal: expect.any(Number),
          revocadosTotal: expect.any(Number),
          totalHistorico: expect.any(Number),
        }),
      );
      expect(response.body.metricas.activos).toBeGreaterThanOrEqual(2);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);
    });

    it('PATCH /api/v1/prestamos/:id/revocar (Camino alt 2 Figura 3) debe revocar manualmente el préstamo y bloquear en el acto el visor PDF con 403 Forbidden aunque el JWT no haya expirado', async () => {
      const revokeResponse = await request(app.getHttpServer())
        .patch(`/api/v1/prestamos/${studentLoanId}/revocar`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          motivo:
            'Revocación manual por Biblioteca para prueba de corte inmediato de acceso DRM.',
        })
        .expect(200);

      expect(revokeResponse.body.estadoAnterior).toBe(EstadoPrestamo.ACTIVO);
      expect(revokeResponse.body.estadoActual).toBe(EstadoPrestamo.REVOCADO);

      // Intentamos acceder al documento con el mismo JWT DRM que aún tiene 7 días de validez criptográfica
      const blockedView = await request(app.getHttpServer())
        .get(`/api/v1/documentos/${seedDocumentId}/ver`)
        .set('Authorization', `Bearer ${studentLoanDrmToken}`)
        .expect(403);

      expect(blockedView.body.message).toContain(
        'El préstamo ha vencido o fue revocado',
      );

      // También debe bloquear el endpoint /prestamos/:id/contenido
      await request(app.getHttpServer())
        .get(`/api/v1/prestamos/${studentLoanId}/contenido`)
        .set('Authorization', `Bearer ${studentLoanDrmToken}`)
        .expect(403);
    });

    it('Expiración de 7 días (Camino alt 3 Figura 3): debe transicionar automáticamente a VENCIDO y bloquear la visualización con 403 Forbidden', async () => {
      // Simulamos que el préstamo de Ana Pérez cumplió los 7 días hace 1 hora
      await prisma.prestamo.update({
        where: { id: anaLoanId },
        data: {
          fechaVencimiento: new Date(Date.now() - 3600 * 1000),
        },
      });

      const expiredView = await request(app.getHttpServer())
        .get(`/api/v1/documentos/${seedDocumentId}/ver`)
        .set('Authorization', `Bearer ${anaLoanDrmToken}`)
        .expect(403);

      expect(expiredView.body.message).toContain(
        'El préstamo ha vencido o fue revocado',
      );

      const updatedLoan = await prisma.prestamo.findUnique({
        where: { id: anaLoanId },
      });
      expect(updatedLoan?.estado).toBe(EstadoPrestamo.VENCIDO);
    });
  });
});
