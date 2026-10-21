import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CatalogModule } from '../catalog/catalog.module';
import { DocumentViewerController, LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [CatalogModule, JwtModule.register({})],
  controllers: [LoansController, DocumentViewerController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
