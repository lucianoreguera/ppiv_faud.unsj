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
    privateDir: process.env.PRIVATE_STORAGE_DIR ?? './storage/pdfs',
    maxPdfSizeMb: parseInt(process.env.MAX_PDF_SIZE_MB ?? '50', 10),
  },
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    from:
      process.env.SMTP_FROM ??
      'Biblioteca FAUD-UNSJ <biblioteca@faud.unsj.edu.ar>',
  },
});
