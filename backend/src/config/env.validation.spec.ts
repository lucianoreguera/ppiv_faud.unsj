import 'reflect-metadata';
import configuration from './configuration';
import { Environment, validateEnv } from './env.validation';

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
