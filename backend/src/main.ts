import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 1. Prefijo global de la API
  app.setGlobalPrefix('api/v1');

  // 2. Configuración de CORS
  const corsOrigin = configService.get<string>(
    'corsOrigin',
    'http://localhost:5173',
  );
  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  // 3. Validación global de DTOs (class-validator + class-transformer)
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

  // 4. Documentación OpenAPI 3.0 (Swagger) en /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle(
      'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ (API)',
    )
    .setDescription(
      'Especificación OpenAPI 3.0 del Backend para el Repositorio Digital de la Facultad de Arquitectura, Urbanismo y Diseño (UNSJ). Incluye gestión territorial de los 19 departamentos de San Juan, catálogo académico, préstamos temporales a 7 días con DRM (JWT) y notificaciones.',
    )
    .setVersion('0.1.0')
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
        description:
          'Token JWT de sesión emitido en POST /api/v1/auth/login',
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

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'FAUD-UNSJ · API Docs (Swagger)',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });

  const port = configService.get<number>('port', 3000);
  await app.listen(port);

  logger.log(`Servidor corriendo en: http://localhost:${port}/api/v1/health`);
  logger.log(`Swagger OpenAPI UI disponible en: http://localhost:${port}/api/docs`);
}

void bootstrap();
