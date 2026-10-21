import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoValidacionUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentsService } from './departments.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  const mockPrismaService = {
    departamento: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  it('debe listar los departamentos calculando usuarios aprobados, pendientes y documentos', async () => {
    mockPrismaService.departamento.findMany.mockResolvedValue([
      {
        id: 'uuid-capital',
        nombre: 'Capital',
        esCapital: true,
        usuarios: [{ estadoValidacion: EstadoValidacionUsuario.APROBADO }],
        _count: { usuarios: 1, documentos: 2 },
      },
      {
        id: 'uuid-jachal',
        nombre: 'Jáchal',
        esCapital: false,
        usuarios: [
          { estadoValidacion: EstadoValidacionUsuario.APROBADO },
          { estadoValidacion: EstadoValidacionUsuario.PENDIENTE },
        ],
        _count: { usuarios: 2, documentos: 1 },
      },
    ]);

    const result = await service.findAll();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'uuid-capital',
      nombre: 'Capital',
      esCapital: true,
      totalUsuarios: 1,
      usuariosAprobados: 1,
      usuariosPendientes: 0,
      totalDocumentos: 2,
    });
    expect(result[1]).toEqual({
      id: 'uuid-jachal',
      nombre: 'Jáchal',
      esCapital: false,
      totalUsuarios: 2,
      usuariosAprobados: 1,
      usuariosPendientes: 1,
      totalDocumentos: 1,
    });
  });

  it('debe calcular las métricas territoriales consolidando Capital vs. departamentos alejados', async () => {
    mockPrismaService.departamento.findMany.mockResolvedValue([
      {
        id: 'uuid-capital',
        nombre: 'Capital',
        esCapital: true,
        usuarios: [{ estadoValidacion: EstadoValidacionUsuario.APROBADO }],
        _count: { usuarios: 1, documentos: 1 },
      },
      {
        id: 'uuid-jachal',
        nombre: 'Jáchal',
        esCapital: false,
        usuarios: [
          { estadoValidacion: EstadoValidacionUsuario.APROBADO },
          { estadoValidacion: EstadoValidacionUsuario.PENDIENTE },
        ],
        _count: { usuarios: 2, documentos: 3 },
      },
    ]);

    const metrics = await service.getTerritorialMetrics();

    expect(metrics.totalDepartamentos).toBe(2);
    expect(metrics.usuariosCapital).toBe(1);
    expect(metrics.usuariosDepartamentosAlejados).toBe(2);
    expect(metrics.totalUsuariosProvincia).toBe(3);
    expect(metrics.totalDocumentosCatalogados).toBe(4);
  });

  it('debe lanzar NotFoundException si el departamento no existe en findOne', async () => {
    mockPrismaService.departamento.findUnique.mockResolvedValue(null);

    await expect(service.findOne('uuid-inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});
