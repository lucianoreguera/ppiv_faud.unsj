export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  drm: {
    loanJwtSecret: process.env.LOAN_DRM_JWT_SECRET,
    loanDurationDays: parseInt(process.env.LOAN_DURATION_DAYS ?? '7', 10),
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    privateDir: process.env.PRIVATE_STORAGE_DIR ?? './storage/pdfs',
    maxPdfSizeMb: parseInt(process.env.MAX_PDF_SIZE_MB ?? '50', 10),
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE === 'true',
    from:
      process.env.SMTP_FROM ??
      'Biblioteca FAUD-UNSJ <biblioteca@faud.unsj.edu.ar>',
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '15', 10),
  },
});
