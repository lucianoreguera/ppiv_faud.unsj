import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoValidacionUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DepartmentResponseDto,
  TerritorialMetricsResponseDto,
} from './dto/department-response.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los 19 departamentos de San Juan ordenados (Capital primero, luego alfabético)
   * incluyendo métricas de usuarios y documentos vinculados.
   */
  async findAll(): Promise<DepartmentResponseDto[]> {
    const departamentos = await this.prisma.departamento.findMany({
      orderBy: [{ esCapital: 'desc' }, { nombre: 'asc' }],
      include: {
        usuarios: {
          select: {
            estadoValidacion: true,
          },
        },
        _count: {
          select: {
            usuarios: true,
            documentos: true,
          },
        },
      },
    });

    return departamentos.map((depto) => {
      const usuariosAprobados = depto.usuarios.filter(
        (u) => u.estadoValidacion === EstadoValidacionUsuario.APROBADO,
      ).length;
      const usuariosPendientes = depto.usuarios.filter(
        (u) => u.estadoValidacion === EstadoValidacionUsuario.PENDIENTE,
      ).length;

      return {
        id: depto.id,
        nombre: depto.nombre,
        esCapital: depto.esCapital,
        totalUsuarios: depto._count.usuarios,
        usuariosAprobados,
        usuariosPendientes,
        totalDocumentos: depto._count.documentos,
      };
    });
  }

  /**
   * Devuelve el resumen de distribución territorial (Capital vs. 18 departamentos restantes)
   * junto con el desglose completo por departamento.
   */
  async getTerritorialMetrics(): Promise<TerritorialMetricsResponseDto> {
    const departamentos = await this.findAll();

    const usuariosCapital = departamentos
      .filter((d) => d.esCapital)
      .reduce((acc, d) => acc + d.totalUsuarios, 0);

    const usuariosDepartamentosAlejados = departamentos
      .filter((d) => !d.esCapital)
      .reduce((acc, d) => acc + d.totalUsuarios, 0);

    const totalDocumentosCatalogados = departamentos.reduce(
      (acc, d) => acc + d.totalDocumentos,
      0,
    );

    return {
      totalDepartamentos: departamentos.length,
      totalUsuariosProvincia: usuariosCapital + usuariosDepartamentosAlejados,
      usuariosCapital,
      usuariosDepartamentosAlejados,
      totalDocumentosCatalogados,
      departamentos,
    };
  }

  /**
   * Obtiene un departamento específico por su ID.
   */
  async findOne(id: string): Promise<DepartmentResponseDto> {
    const depto = await this.prisma.departamento.findUnique({
      where: { id },
      include: {
        usuarios: {
          select: {
            estadoValidacion: true,
          },
        },
        _count: {
          select: {
            usuarios: true,
            documentos: true,
          },
        },
      },
    });

    if (!depto) {
      throw new NotFoundException(
        `No se encontró el departamento con ID "${id}".`,
      );
    }

    const usuariosAprobados = depto.usuarios.filter(
      (u) => u.estadoValidacion === EstadoValidacionUsuario.APROBADO,
    ).length;
    const usuariosPendientes = depto.usuarios.filter(
      (u) => u.estadoValidacion === EstadoValidacionUsuario.PENDIENTE,
    ).length;

    return {
      id: depto.id,
      nombre: depto.nombre,
      esCapital: depto.esCapital,
      totalUsuarios: depto._count.usuarios,
      usuariosAprobados,
      usuariosPendientes,
      totalDocumentos: depto._count.documentos,
    };
  }
}
