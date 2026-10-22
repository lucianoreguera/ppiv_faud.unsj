import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

/**
 * Configura de forma centralizada:
 * 1. Prefijo global `/api/v1`
 * 2. Cabeceras de endurecimiento HTTP (`helmet` — Fase 6 Hardening)
 * 3. Políticas de CORS y exposición de encabezados DRM / Rate-Limit
 * 4. Validación y transformación estricta de DTOs (`ValidationPipe`)
 */
export function configureAppSecurityAndPipes(app: INestApplication): void {
  const configService = app.get(ConfigService);

  // 1. Prefijo global de la API
  app.setGlobalPrefix('api/v1');

  // 2. Orígenes permitidos para CORS y embebido de visor PDF
  const corsOriginRaw = configService.get<string>(
    'corsOrigin',
    'http://localhost:5173',
  );
  const allowedOrigins = corsOriginRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // 3. Hardening HTTP con Helmet (compatible con Swagger UI y Visor PDF DRM)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      xFrameOptions: { action: 'sameorigin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
          scriptSrc: ["'self'", "https: 'unsafe-inline'"],
          frameAncestors: ["'self'", ...allowedOrigins],
          objectSrc: ["'self'"],
        },
      },
    }),
  );

  // 4. Configuración de CORS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: [
      'Content-Disposition',
      'X-DRM-Loan-Id',
      'X-DRM-Loan-Code',
      'X-DRM-Document-Id',
      'X-DRM-Watermark',
      'X-DRM-Watermark-URI',
      'X-DRM-Expires-At',
      'X-DRM-Remaining-Days',
      'X-DRM-Remaining-Hours',
      'X-DRM-Por-Vencer-24h',
      'X-DRM-Allow-Download',
      'X-DRM-Allow-Print',
      'X-DRM-Allow-Copy',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
  });

  // 5. Validación global de DTOs (class-validator + class-transformer)
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
}
