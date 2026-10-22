import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EstadoValidacionUsuario, Prisma, RolUsuario } from '@prisma/client';
import { EmailService } from '../notifications/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import {
  UpdateUserStatusResponseDto,
  UserAdminItemDto,
  UsersListResponseDto,
} from './dto/user-admin-response.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  /**
   * Lista los usuarios para el Panel de Administración de Biblioteca (RF05 - Figma pág. 8).
   * Incluye los contadores globales por pestaña (todos, pendientes, aprobados, rechazados)
   * y permite filtrar por estado, departamento, rol y búsqueda por texto.
   */
  async findAll(query: QueryUsersDto): Promise<UsersListResponseDto> {
    const where: Prisma.UsuarioWhereInput = {};

    if (query.estado) {
      where.estadoValidacion = query.estado;
    }

    if (query.departamentoId) {
      where.departamentoId = query.departamentoId;
    }

    if (query.rol) {
      where.rol = query.rol;
    }

    if (query.q && query.q.trim().length > 0) {
      const search = query.q.trim();
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        {
          departamento: {
            nombre: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [usuarios, groupedCounts] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { nombre: 'asc' }],
        include: {
          departamento: {
            select: {
              id: true,
              nombre: true,
              esCapital: true,
            },
          },
          _count: {
            select: {
              prestamos: true,
            },
          },
        },
      }),
      this.prisma.usuario.groupBy({
        by: ['estadoValidacion'],
        _count: {
          _all: true,
        },
      }),
    ]);

    let pendientes = 0;
    let aprobados = 0;
    let rechazados = 0;

    for (const group of groupedCounts) {
      if (group.estadoValidacion === EstadoValidacionUsuario.PENDIENTE) {
        pendientes = group._count._all;
      } else if (group.estadoValidacion === EstadoValidacionUsuario.APROBADO) {
        aprobados = group._count._all;
      } else if (group.estadoValidacion === EstadoValidacionUsuario.RECHAZADO) {
        rechazados = group._count._all;
      }
    }

    const items = usuarios.map((u) => this.toUserAdminItemDto(u));

    return {
      contadores: {
        todos: pendientes + aprobados + rechazados,
        pendientes,
        aprobados,
        rechazados,
      },
      total: items.length,
      items,
    };
  }

  /**
   * Obtiene el detalle de un usuario por su UUID.
   */
  async findOne(id: string): Promise<UserAdminItemDto> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        departamento: {
          select: {
            id: true,
            nombre: true,
            esCapital: true,
          },
        },
        _count: {
          select: {
            prestamos: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException(
        `No se encontró ningún usuario con ID "${id}".`,
      );
    }

    return this.toUserAdminItemDto(usuario);
  }

  /**
   * Aprueba o rechaza la solicitud de validación de un usuario departamental (RF05).
   */
  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    adminUserId?: string,
  ): Promise<UpdateUserStatusResponseDto> {
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        departamento: {
          select: {
            id: true,
            nombre: true,
            esCapital: true,
          },
        },
      },
    });

    if (!usuarioExistente) {
      throw new NotFoundException(
        `No se encontró ningún usuario con ID "${id}".`,
      );
    }

    if (
      adminUserId &&
      usuarioExistente.id === adminUserId &&
      dto.estado !== EstadoValidacionUsuario.APROBADO
    ) {
      throw new BadRequestException(
        'Un administrador no puede rechazar ni pasar a pendiente su propia cuenta.',
      );
    }

    const estadoAnterior = usuarioExistente.estadoValidacion;

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        estadoValidacion: dto.estado,
      },
      include: {
        departamento: {
          select: {
            id: true,
            nombre: true,
            esCapital: true,
          },
        },
        _count: {
          select: {
            prestamos: true,
          },
        },
      },
    });

    if (this.emailService && estadoAnterior !== dto.estado) {
      await this.emailService.sendAccountValidationEmail({
        to: usuarioActualizado.email,
        usuarioNombre: usuarioActualizado.nombre,
        departamentoNombre: usuarioActualizado.departamento.nombre,
        estado: dto.estado,
        motivo: dto.motivo,
      });
    }

    return {
      message: `El estado de validación del usuario ${usuarioActualizado.nombre} (${usuarioActualizado.departamento.nombre}) fue actualizado a ${dto.estado}.`,
      estadoAnterior,
      estadoActual: usuarioActualizado.estadoValidacion,
      motivo: dto.motivo,
      usuario: this.toUserAdminItemDto(usuarioActualizado),
    };
  }

  private toUserAdminItemDto(usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: RolUsuario;
    estadoValidacion: EstadoValidacionUsuario;
    departamentoId: string;
    departamento: {
      id: string;
      nombre: string;
      esCapital: boolean;
    };
    _count: {
      prestamos: number;
    };
    createdAt: Date;
    updatedAt: Date;
  }): UserAdminItemDto {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      estadoValidacion: usuario.estadoValidacion,
      departamentoId: usuario.departamentoId,
      departamento: usuario.departamento,
      totalPrestamos: usuario._count.prestamos,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }
}
