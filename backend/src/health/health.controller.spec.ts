import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health-response.dto';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthResponse: HealthResponseDto = {
    status: 'ok',
    service: 'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ',
    version: '0.1.0',
    environment: 'test',
    timestamp: new Date().toISOString(),
    uptimeSeconds: 1.23,
    database: {
      status: 'up',
      latencyMs: 3,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            checkHealth: jest.fn().mockResolvedValue(mockHealthResponse),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('debe retornar el estado operativo del servidor y la base de datos', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('up');
    expect(result.service).toContain('FAUD-UNSJ');
  });
});
