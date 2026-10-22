import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DepartmentsModule } from './departments/departments.module';
import { HealthModule } from './health/health.module';
import { LoansModule } from './loans/loans.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        errorMessage:
          'Demasiadas solicitudes desde esta dirección IP. Por favor, aguarde unos instantes antes de volver a intentar (Rate Limit excedido).',
        setHeaders: true,
        getTracker: (req: Record<string, any>) => {
          const forwarded = req.headers?.['x-forwarded-for'] as
            string | undefined;
          if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
            return forwarded.split(',')[0].trim();
          }
          return (
            (req.ip as string | undefined) ||
            (req.socket?.remoteAddress as string | undefined) ||
            'unknown'
          );
        },
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('throttle.ttlMs', 60000),
            limit: configService.get<number>('throttle.limit', 100),
          },
        ],
      }),
    }),
    PrismaModule,
    NotificationsModule,
    HealthModule,
    DepartmentsModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    LoansModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
