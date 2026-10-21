import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoValidacionUsuario, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    usuario: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('debe listar usuarios y calcular los contadores por estado (todos, pendientes, aprobados, rechazados)', async () => {
    const now = new Date();
    mockPrismaService.usuario.findMany.mockResolvedValue([
      {
        id: 'uuid-1',
        nombre: 'Carlos Gómez',
        email: 'carlos.gomez@vallefertil.gob.ar',
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
        departamentoId: 'uuid-vf',
        departamento: {
          id: 'uuid-vf',
          nombre: 'Valle Fértil',
          esCapital: false,
        },
        _count: { prestamos: 0 },
        createdAt: now,
        updatedAt: now,
      },
    ]);

    mockPrismaService.usuario.groupBy.mockResolvedValue([
      {
        estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
        _count: { _all: 3 },
      },
      {
        estadoValidacion: EstadoValidacionUsuario.APROBADO,
        _count: { _all: 3 },
      },
    ]);

    const result = await service.findAll({
      estado: EstadoValidacionUsuario.PENDIENTE,
    });

    expect(result.contadores).toEqual({
      todos: 6,
      pendientes: 3,
      aprobados: 3,
      rechazados: 0,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].nombre).toBe('Carlos Gómez');
  });

  it('debe aprobar un usuario pendiente y retornar el estado anterior y actual', async () => {
    const now = new Date();
    mockPrismaService.usuario.findUnique.mockResolvedValue({
      id: 'uuid-carlos',
      nombre: 'Carlos Gómez',
      email: 'carlos.gomez@vallefertil.gob.ar',
      rol: RolUsuario.USUARIO,
      estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
      departamentoId: 'uuid-vf',
      departamento: {
        id: 'uuid-vf',
        nombre: 'Valle Fértil',
        esCapital: false,
      },
    });

    mockPrismaService.usuario.update.mockResolvedValue({
      id: 'uuid-carlos',
      nombre: 'Carlos Gómez',
      email: 'carlos.gomez@vallefertil.gob.ar',
      rol: RolUsuario.USUARIO,
      estadoValidacion: EstadoValidacionUsuario.APROBADO,
      departamentoId: 'uuid-vf',
      departamento: {
        id: 'uuid-vf',
        nombre: 'Valle Fértil',
        esCapital: false,
      },
      _count: { prestamos: 0 },
      createdAt: now,
      updatedAt: now,
    });

    const response = await service.updateStatus(
      'uuid-carlos',
      {
        estado: EstadoValidacionUsuario.APROBADO,
        motivo: 'Validado por Biblioteca',
      },
      'uuid-admin',
    );

    expect(response.estadoAnterior).toBe(EstadoValidacionUsuario.PENDIENTE);
    expect(response.estadoActual).toBe(EstadoValidacionUsuario.APROBADO);
    expect(response.usuario.estadoValidacion).toBe(
      EstadoValidacionUsuario.APROBADO,
    );
  });

  it('debe impedir que un administrador rechace su propia cuenta', async () => {
    mockPrismaService.usuario.findUnique.mockResolvedValue({
      id: 'uuid-admin',
      nombre: 'Admin Biblioteca',
      email: 'admin@faud.unsj.edu.ar',
      rol: RolUsuario.ADMINISTRADOR,
      estadoValidacion: EstadoValidacionUsuario.APROBADO,
      departamentoId: 'uuid-capital',
      departamento: {
        id: 'uuid-capital',
        nombre: 'Capital',
        esCapital: true,
      },
    });

    await expect(
      service.updateStatus(
        'uuid-admin',
        { estado: EstadoValidacionUsuario.RECHAZADO },
        'uuid-admin',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar NotFoundException si el usuario a actualizar no existe', async () => {
    mockPrismaService.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('uuid-inexistente', {
        estado: EstadoValidacionUsuario.APROBADO,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
