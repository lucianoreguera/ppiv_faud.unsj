import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoValidacionUsuario, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    usuario: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    departamento: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mocked-jwt-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('8h'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('debe registrar un usuario nuevo en estado PENDIENTE con rol USUARIO', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.departamento.findUnique.mockResolvedValue({
        id: 'uuid-jachal',
        nombre: 'Jáchal',
        esCapital: false,
      });

      const now = new Date();
      mockPrismaService.usuario.create.mockResolvedValue({
        id: 'uuid-nuevo-usuario',
        nombre: 'Ramiro Quiroga',
        email: 'ramiro@jachal.gov.ar',
        passwordHash: 'hashed',
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
        departamentoId: 'uuid-jachal',
        departamento: {
          id: 'uuid-jachal',
          nombre: 'Jáchal',
          esCapital: false,
        },
        createdAt: now,
        updatedAt: now,
      });

      const response = await service.register({
        nombre: 'Ramiro Quiroga',
        email: 'Ramiro@Jachal.gov.ar',
        password: 'Password123!',
        departamentoId: 'uuid-jachal',
      });

      expect(response.usuario.email).toBe('ramiro@jachal.gov.ar');
      expect(response.usuario.rol).toBe(RolUsuario.USUARIO);
      expect(response.usuario.estadoValidacion).toBe(
        EstadoValidacionUsuario.PENDIENTE,
      );
      expect(response.message).toContain('PENDIENTE');
    });

    it('debe lanzar ConflictException si el email ya existe', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: 'uuid-existente',
      });

      await expect(
        service.register({
          nombre: 'Test',
          email: 'duplicado@jachal.gov.ar',
          password: 'Password123!',
          departamentoId: 'uuid-jachal',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar BadRequestException si el departamentoId no existe', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.departamento.findUnique.mockResolvedValue(null);

      await expect(
        service.register({
          nombre: 'Test',
          email: 'nuevo@jachal.gov.ar',
          password: 'Password123!',
          departamentoId: 'uuid-inexistente',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('debe lanzar ForbiddenException si el usuario está en estado PENDIENTE', async () => {
      const passwordHash = await bcrypt.hash('Alumno123!', 10);
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: 'uuid-pendiente',
        nombre: 'Carlos Gómez',
        email: 'carlos.gomez@vallefertil.gob.ar',
        passwordHash,
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
        departamentoId: 'uuid-vf',
        departamento: {
          id: 'uuid-vf',
          nombre: 'Valle Fértil',
          esCapital: false,
        },
      });

      await expect(
        service.login({
          email: 'carlos.gomez@vallefertil.gob.ar',
          password: 'Alumno123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe lanzar ForbiddenException si el usuario está en estado RECHAZADO', async () => {
      const passwordHash = await bcrypt.hash('Alumno123!', 10);
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: 'uuid-rechazado',
        nombre: 'Usuario Rechazado',
        email: 'rechazado@iglesia.gob.ar',
        passwordHash,
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.RECHAZADO,
        departamentoId: 'uuid-iglesia',
        departamento: {
          id: 'uuid-iglesia',
          nombre: 'Iglesia',
          esCapital: false,
        },
      });

      await expect(
        service.login({
          email: 'rechazado@iglesia.gob.ar',
          password: 'Alumno123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe emitir el JWT si las credenciales son válidas y la cuenta está APROBADA', async () => {
      const passwordHash = await bcrypt.hash('Alumno123!', 10);
      const now = new Date();
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: 'uuid-aprobado',
        nombre: 'Ana Pérez',
        email: 'ana.perez@jachal.gov.ar',
        passwordHash,
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.APROBADO,
        departamentoId: 'uuid-jachal',
        departamento: {
          id: 'uuid-jachal',
          nombre: 'Jáchal',
          esCapital: false,
        },
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.login({
        email: 'ana.perez@jachal.gov.ar',
        password: 'Alumno123!',
      });

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.usuario.estadoValidacion).toBe(
        EstadoValidacionUsuario.APROBADO,
      );
    });

    it('debe lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
      const passwordHash = await bcrypt.hash('Alumno123!', 10);
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: 'uuid-aprobado',
        nombre: 'Ana Pérez',
        email: 'ana.perez@jachal.gov.ar',
        passwordHash,
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.APROBADO,
        departamentoId: 'uuid-jachal',
        departamento: {
          id: 'uuid-jachal',
          nombre: 'Jáchal',
          esCapital: false,
        },
      });

      await expect(
        service.login({
          email: 'ana.perez@jachal.gov.ar',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
