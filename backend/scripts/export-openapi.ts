import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { configureAppSecurityAndPipes } from '../src/common/bootstrap/security-and-pipes.config';
import { buildOpenApiDocument } from '../src/common/swagger/swagger.config';

async function exportOpenApiSpec(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  configureAppSecurityAndPipes(app);

  const document = buildOpenApiDocument(app);
  const serialized = JSON.stringify(document, null, 2) + '\n';

  const backendSpecPath = path.resolve(__dirname, '..', 'openapi.json');
  const docsSpecPath = path.resolve(
    __dirname,
    '..',
    '..',
    'docs',
    'specs',
    'openapi.json',
  );

  fs.mkdirSync(path.dirname(docsSpecPath), { recursive: true });
  fs.writeFileSync(backendSpecPath, serialized, 'utf-8');
  fs.writeFileSync(docsSpecPath, serialized, 'utf-8');

  const pathsCount = Object.keys(document.paths ?? {}).length;
  const schemasCount = Object.keys(document.components?.schemas ?? {}).length;

  console.log(
    `[OpenAPI 3.0] Contrato exportado exitosamente (${pathsCount} rutas, ${schemasCount} esquemas):`,
  );
  console.log(`  - ${backendSpecPath}`);
  console.log(`  - ${docsSpecPath}`);

  await app.close();
}

void exportOpenApiSpec();
