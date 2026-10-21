import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponseDto } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async checkHealth(): Promise<HealthResponseDto> {
    const dbStatus = await this.checkDatabaseConnection();

    return {
      status: dbStatus.status === 'up' ? 'ok' : 'degraded',
      service: 'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ',
      version: '0.1.0',
      environment: this.configService.get<string>('nodeEnv', 'development'),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      database: dbStatus,
    };
  }

  private async checkDatabaseConnection(): Promise<{
    status: 'up' | 'down';
    latencyMs?: number;
  }> {
    const start = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      return { status: 'up', latencyMs };
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar la conexión a PostgreSQL vía Prisma: ${(error as Error).message}`,
      );
      return { status: 'down' };
    }
  }
}
