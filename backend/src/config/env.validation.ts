import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum StorageDriver {
  Local = 'local',
  S3 = 's3',
}

const usesS3Storage = (env: EnvironmentVariables) =>
  env.STORAGE_DRIVER === StorageDriver.S3;

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:5173';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '8h';

  @IsString()
  @IsNotEmpty()
  LOAN_DRM_JWT_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  LOAN_DURATION_DAYS: number = 7;

  @IsEnum(StorageDriver)
  @IsOptional()
  STORAGE_DRIVER: StorageDriver = StorageDriver.Local;

  @IsString()
  @IsOptional()
  PRIVATE_STORAGE_DIR: string = './storage/pdfs';

  // Bucket privado compatible con S3 (Backblaze B2, Cloudflare R2, MinIO) — obligatorio con STORAGE_DRIVER=s3
  @ValidateIf(usesS3Storage)
  @IsString()
  @IsNotEmpty()
  S3_ENDPOINT?: string;

  @ValidateIf(usesS3Storage)
  @IsString()
  @IsNotEmpty()
  S3_REGION?: string;

  @ValidateIf(usesS3Storage)
  @IsString()
  @IsNotEmpty()
  S3_BUCKET?: string;

  @ValidateIf(usesS3Storage)
  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY_ID?: string;

  @ValidateIf(usesS3Storage)
  @IsString()
  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  MAX_PDF_SIZE_MB: number = 50;

  @IsString()
  @IsOptional()
  SMTP_HOST: string = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  SMTP_PORT: number = 1025;

  @IsString()
  @IsOptional()
  SMTP_FROM: string = 'Biblioteca FAUD-UNSJ <biblioteca@faud.unsj.edu.ar>';

  // Credenciales SMTP: vacías con Mailpit; obligatorias en proveedores externos (Brevo, Mailtrap)
  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsBooleanString()
  @IsOptional()
  SMTP_SECURE: string = 'false';

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @IsOptional()
  THROTTLE_TTL_MS: number = 60000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_LIMIT: number = 100;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_AUTH_LIMIT: number = 15;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Error de validación en variables de entorno (.env):\n${errors.toString()}`,
    );
  }

  return validatedConfig;
}
