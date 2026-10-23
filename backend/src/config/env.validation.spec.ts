import 'reflect-metadata';
import configuration from './configuration';
import { Environment, StorageDriver, validateEnv } from './env.validation';

describe('Configuración y Validación de Variables de Entorno (Fase 0 / Fase 6 Hardening)', () => {
  it('validateEnv() debe validar una configuración completa incluyendo variables de Rate Limiting (THROTTLE_*)', () => {
    const validated = validateEnv({
      NODE_ENV: 'test',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_URL:
        'postgresql://faud_user:faud_password@localhost:5433/repositorio_faud?schema=public',
      JWT_SECRET: 'test_jwt_secret',
      JWT_EXPIRES_IN: '8h',
      LOAN_DRM_JWT_SECRET: 'test_drm_secret',
      LOAN_DURATION_DAYS: '7',
      PRIVATE_STORAGE_DIR: './storage/pdfs',
      MAX_PDF_SIZE_MB: '50',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      THROTTLE_TTL_MS: '60000',
      THROTTLE_LIMIT: '100',
      THROTTLE_AUTH_LIMIT: '15',
    });

    expect(validated.NODE_ENV).toBe(Environment.Test);
    expect(validated.PORT).toBe(3000);
    expect(validated.LOAN_DURATION_DAYS).toBe(7);
    expect(validated.THROTTLE_TTL_MS).toBe(60000);
    expect(validated.THROTTLE_LIMIT).toBe(100);
    expect(validated.THROTTLE_AUTH_LIMIT).toBe(15);
  });

  it('validateEnv() debe rechazar con Error cuando faltan secretos obligatorios (DATABASE_URL, JWT_SECRET o LOAN_DRM_JWT_SECRET)', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
      }),
    ).toThrow('Error de validación en variables de entorno (.env)');
  });

  it('validateEnv() debe exigir las credenciales S3_* solo cuando STORAGE_DRIVER=s3 (Backblaze B2)', () => {
    const baseEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
      JWT_SECRET: 'test_jwt_secret',
      LOAN_DRM_JWT_SECRET: 'test_drm_secret',
    };

    expect(validateEnv(baseEnv).STORAGE_DRIVER).toBe(StorageDriver.Local);

    expect(() => validateEnv({ ...baseEnv, STORAGE_DRIVER: 's3' })).toThrow(
      'Error de validación en variables de entorno (.env)',
    );

    const validated = validateEnv({
      ...baseEnv,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
      S3_REGION: 'us-east-005',
      S3_BUCKET: 'faud-unsj-pdfs',
      S3_ACCESS_KEY_ID: 'key-id',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(validated.STORAGE_DRIVER).toBe(StorageDriver.S3);
  });

  it('configuration() debe exponer las secciones database, auth, drm, storage, smtp y throttle con valores por defecto seguros', () => {
    const config = configuration();

    expect(config).toEqual(
      expect.objectContaining({
        port: expect.any(Number),
        drm: expect.objectContaining({
          loanDurationDays: 7,
        }),
        throttle: expect.objectContaining({
          ttlMs: expect.any(Number),
          limit: expect.any(Number),
          authLimit: expect.any(Number),
        }),
      }),
    );
  });
});
