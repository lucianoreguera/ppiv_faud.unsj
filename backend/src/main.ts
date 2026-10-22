import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureAppSecurityAndPipes } from './common/bootstrap/security-and-pipes.config';
import { setupSwaggerModule } from './common/swagger/swagger.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 1. Prefijo global, Hardening (Helmet), CORS y ValidationPipe
  configureAppSecurityAndPipes(app);

  // 2. Documentación OpenAPI 3.0 (Swagger) en /api/docs y /api/docs-json
  setupSwaggerModule(app);

  const port = configService.get<number>('port', 3000);
  await app.listen(port);

  logger.log(`Servidor corriendo en: http://localhost:${port}/api/v1/health`);
  logger.log(
    `Swagger OpenAPI UI disponible en: http://localhost:${port}/api/docs`,
  );
  logger.log(
    `Contrato OpenAPI JSON disponible en: http://localhost:${port}/api/docs-json`,
  );
}

void bootstrap();
