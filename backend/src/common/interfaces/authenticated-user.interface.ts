import { EstadoValidacionUsuario, RolUsuario } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  departamentoId: string;
  departamentoNombre: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
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
}
