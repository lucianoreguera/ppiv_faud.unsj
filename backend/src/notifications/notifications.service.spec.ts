import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  EstadoPrestamo,
  EstadoValidacionUsuario,
  RolUsuario,
  TipoDocumento,
  TipoNotificacion,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (Fase 5 — Notificaciones y Cron RF06)', () => {
  let service: NotificationsService;

  const mockPrismaService = {
    prestamo: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notificacion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockEmailService = {
    sendExpirationReminder24hEmail: jest.fn(),
    sendLoanExpiredEmail: jest.fn(),
    sendLoanGrantedEmail: jest.fn(),
    sendLoanRevokedEmail: jest.fn(),
    sendAccountValidationEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('procesarPrestamosVencidos (Job de Vencimiento Automático)', () => {
    it('debe pasar de ACTIVO a VENCIDO los préstamos con fechaVencimiento <= now(), crear notificación PRESTAMO_VENCIDO y enviar email', async () => {
      const expiredDate = new Date(Date.now() - 2 * 3600 * 1000);

      mockPrismaService.prestamo.findMany.mockResolvedValue([
        {
          id: 'loan-expired-1',
          codigoReferencia: 24,
          estado: EstadoPrestamo.ACTIVO,
          fechaVencimiento: expiredDate,
          usuario: {
            id: 'user-jachal-1',
            nombre: 'Ana Pérez',
            email: 'ana.perez@jachal.gov.ar',
            departamento: { nombre: 'Jáchal' },
          },
          documento: {
            id: 'doc-1',
            titulo: 'Vivienda social en Cuyo',
            autor: 'L. Martínez',
          },
          notificaciones: [],
        },
      ]);

      mockPrismaService.prestamo.update.mockResolvedValue({
        id: 'loan-expired-1',
        estado: EstadoPrestamo.VENCIDO,
      });

      mockPrismaService.notificacion.create.mockResolvedValue({
        id: 'notif-expired-1',
        prestamoId: 'loan-expired-1',
        tipo: TipoNotificacion.PRESTAMO_VENCIDO,
        leida: false,
      });

      mockEmailService.sendLoanExpiredEmail.mockResolvedValue({
        sent: true,
        to: 'ana.perez@jachal.gov.ar',
        subject: 'Préstamo vencido',
        tipo: TipoNotificacion.PRESTAMO_VENCIDO,
        timestamp: new Date(),
      });

      const result = await service.procesarPrestamosVencidos();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          prestamoId: 'loan-expired-1',
          codigoFormateado: '#0024',
          usuarioEmail: 'ana.perez@jachal.gov.ar',
          tipoNotificacion: TipoNotificacion.PRESTAMO_VENCIDO,
          notificacionId: 'notif-expired-1',
          correoEnviado: true,
        }),
      );

      expect(mockPrismaService.prestamo.update).toHaveBeenCalledWith({
        where: { id: 'loan-expired-1' },
        data: { estado: EstadoPrestamo.VENCIDO },
      });

      expect(mockPrismaService.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prestamoId: 'loan-expired-1',
            tipo: TipoNotificacion.PRESTAMO_VENCIDO,
            leida: false,
          }),
        }),
      );

      expect(mockEmailService.sendLoanExpiredEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('enviarRecordatorio y procesarAlertasVencimiento24h (RF06)', () => {
    it('debe crear notificación PROXIMO_VENCIMIENTO_24H y enviar correo de recordatorio para préstamos que vencen en <= 24h', async () => {
      const dueIn12Hours = new Date(Date.now() + 12 * 3600 * 1000);

      mockPrismaService.prestamo.findMany.mockResolvedValue([
        { id: 'loan-24h-1' },
      ]);

      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'loan-24h-1',
        codigoReferencia: 105,
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: dueIn12Hours,
        usuario: {
          id: 'user-caucete-1',
          nombre: 'Sofía Navarro',
          email: 'sofia.navarro@caucete.gob.ar',
          departamento: { nombre: 'Caucete' },
        },
        documento: {
          id: 'doc-2',
          titulo: 'Accesibilidad urbana en San Juan',
          autor: 'Martín González',
        },
        notificaciones: [],
      });

      mockPrismaService.notificacion.create.mockResolvedValue({
        id: 'notif-24h-1',
        prestamoId: 'loan-24h-1',
        tipo: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
        leida: false,
      });

      mockEmailService.sendExpirationReminder24hEmail.mockResolvedValue({
        sent: true,
        to: 'sofia.navarro@caucete.gob.ar',
        subject: 'Recordatorio 24h',
        tipo: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
        timestamp: new Date(),
      });

      const alertas = await service.procesarAlertasVencimiento24h();

      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toEqual(
        expect.objectContaining({
          prestamoId: 'loan-24h-1',
          codigoFormateado: '#0105',
          usuarioEmail: 'sofia.navarro@caucete.gob.ar',
          tipoNotificacion: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
          notificacionId: 'notif-24h-1',
          correoEnviado: true,
        }),
      );

      expect(
        mockEmailService.sendExpirationReminder24hEmail,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sofia.navarro@caucete.gob.ar',
          codigoFormateado: '#0105',
          documentoTitulo: 'Accesibilidad urbana en San Juan',
        }),
      );
    });

    it('enviarRecordatorio debe ser idempotente y no duplicar notificación ni correo si ya existía PROXIMO_VENCIMIENTO_24H', async () => {
      const dueIn6Hours = new Date(Date.now() + 6 * 3600 * 1000);

      mockPrismaService.prestamo.findUnique.mockResolvedValue({
        id: 'loan-24h-existing',
        codigoReferencia: 88,
        estado: EstadoPrestamo.ACTIVO,
        fechaVencimiento: dueIn6Hours,
        usuario: {
          id: 'user-1',
          nombre: 'Ana Pérez',
          email: 'ana.perez@jachal.gov.ar',
          departamento: { nombre: 'Jáchal' },
        },
        documento: {
          id: 'doc-1',
          titulo: 'Vivienda social en Cuyo',
          autor: 'L. Martínez',
        },
        notificaciones: [
          {
            id: 'notif-already-sent',
            tipo: TipoNotificacion.PROXIMO_VENCIMIENTO_24H,
          },
        ],
      });

      const result = await service.enviarRecordatorio('loan-24h-existing');

      expect(result.notificacionId).toBe('notif-already-sent');
      expect(result.correoEnviado).toBe(false);
      expect(mockPrismaService.notificacion.create).not.toHaveBeenCalled();
      expect(
        mockEmailService.sendExpirationReminder24hEmail,
      ).not.toHaveBeenCalled();
    });

    it('enviarRecordatorio debe lanzar NotFoundException si el préstamo no existe', async () => {
      mockPrismaService.prestamo.findUnique.mockResolvedValue(null);

      await expect(
        service.enviarRecordatorio('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead y control de acceso de bandeja de notificaciones', () => {
    const sampleNotif = {
      id: 'notif-1',
      prestamoId: 'loan-1',
      tipo: TipoNotificacion.PRESTAMO_OTORGADO,
      mensaje: 'Préstamo otorgado',
      fechaEnvio: new Date(),
      leida: false,
      prestamo: {
        id: 'loan-1',
        codigoReferencia: 10,
        usuarioId: 'owner-user-id',
        estado: EstadoPrestamo.ACTIVO,
        fechaInicio: new Date(),
        fechaVencimiento: new Date(Date.now() + 86400000),
        usuario: {
          id: 'owner-user-id',
          nombre: 'Ana Pérez',
          email: 'ana.perez@jachal.gov.ar',
          departamento: { nombre: 'Jáchal' },
        },
        documento: {
          id: 'doc-1',
          titulo: 'Vivienda social en Cuyo',
          autor: 'L. Martínez',
          carrera: 'Arquitectura',
          tipo: TipoDocumento.INVESTIGACION,
          anio: 2021,
        },
      },
    };

    it('debe permitir al titular marcar su notificación como leída', async () => {
      mockPrismaService.notificacion.findUnique.mockResolvedValue(sampleNotif);
      mockPrismaService.notificacion.update.mockResolvedValue({
        ...sampleNotif,
        leida: true,
      });

      const ownerUser = {
        id: 'owner-user-id',
        nombre: 'Ana Pérez',
        email: 'ana.perez@jachal.gov.ar',
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.APROBADO,
        departamentoId: 'depto-jachal',
        departamento: {
          id: 'depto-jachal',
          nombre: 'Jáchal',
          esCapital: false,
        },
      };

      const res = await service.markAsRead('notif-1', ownerUser, {
        leida: true,
      });

      expect(res.notificacion.leida).toBe(true);
      expect(mockPrismaService.notificacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1' },
          data: { leida: true },
        }),
      );
    });

    it('debe rechazar con ForbiddenException si otro estudiante intenta marcar una notificación ajena', async () => {
      mockPrismaService.notificacion.findUnique.mockResolvedValue(sampleNotif);

      const otherUser = {
        id: 'other-user-id',
        nombre: 'Otro Alumno',
        email: 'otro@caucete.gob.ar',
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.APROBADO,
        departamentoId: 'depto-caucete',
        departamento: {
          id: 'depto-caucete',
          nombre: 'Caucete',
          esCapital: false,
        },
      };

      await expect(
        service.markAsRead('notif-1', otherUser, { leida: true }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
