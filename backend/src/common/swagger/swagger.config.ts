import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Construye el contrato OpenAPI 3.0 completo del Sistema de Préstamo Digital
 * Interdepartamental (FAUD-UNSJ).
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle(
      'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ (API)',
    )
    .setDescription(
      'Especificación OpenAPI 3.0 del Backend para el Repositorio Digital de la Facultad de Arquitectura, Urbanismo y Diseño (UNSJ). Incluye gestión territorial de los 19 departamentos de San Juan, catálogo académico con almacenamiento privado de PDFs, préstamos temporales a 7 días con DRM (JWT), notificaciones automáticas (RF06) y endurecimiento de seguridad (Helmet + Rate Limiting).',
    )
    .setVersion('1.0.0')
    .setContact(
      'DHL Solutions — Grupo N°9 (IFTS N°29)',
      'https://www.faud.unsj.edu.ar',
      'biblioteca@faud.unsj.edu.ar',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de sesión emitido en POST /api/v1/auth/login',
      },
      'jwt-auth',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Token DRM temporal de préstamo (7 días) emitido al otorgar un préstamo',
      },
      'loan-drm-token',
    )
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}

/**
 * Monta la interfaz Swagger UI en `/api/docs` y el JSON en `/api/docs-json`.
 */
export function setupSwaggerModule(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'FAUD-UNSJ · API Docs (Swagger)',
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });

  return document;
}
