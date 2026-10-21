import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PdfStorageService } from './pdf-storage.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, PdfStorageService],
  exports: [CatalogService, PdfStorageService],
})
export class CatalogModule {}
