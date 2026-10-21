import { ApiProperty } from '@nestjs/swagger';
import { EstadoValidacionUsuario, RolUsuario } from '@prisma/client';

export class UserDepartmentSummaryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID del departamento',
  })
  id!: string;

  @ApiProperty({
    example: 'Jáchal',
    description: 'Nombre del departamento de San Juan',
  })
  nombre!: string;

  @ApiProperty({
    example: false,
    description: 'Indica si es Capital (true) o interior/gran San Juan (false)',
  })
  esCapital!: boolean;
}

export class UserProfileResponseDto {
  @ApiProperty({
    example: 'a3b8f042-1c2a-4d5e-8f90-123456789abc',
    description: 'Identificador único UUID del usuario',
  })
  id!: string;

  @ApiProperty({
    example: 'Ana Pérez',
    description: 'Nombre y apellido del usuario',
  })
  nombre!: string;

  @ApiProperty({
    example: 'ana.perez@jachal.gov.ar',
    description: 'Correo electrónico del usuario',
  })
  email!: string;

  @ApiProperty({
    enum: RolUsuario,
    example: RolUsuario.USUARIO,
    description: 'Rol dentro del sistema (USUARIO o ADMINISTRADOR)',
  })
  rol!: RolUsuario;

  @ApiProperty({
    enum: EstadoValidacionUsuario,
    example: EstadoValidacionUsuario.APROBADO,
    description:
      'Estado de validación administrativa por Biblioteca (PENDIENTE, APROBADO, RECHAZADO)',
  })
  estadoValidacion!: EstadoValidacionUsuario;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID del departamento asociado',
  })
  departamentoId!: string;

  @ApiProperty({
    type: UserDepartmentSummaryDto,
    description: 'Datos del departamento de residencia',
  })
  departamento!: UserDepartmentSummaryDto;

  @ApiProperty({
    example: '2026-10-21T18:00:00.000Z',
    description: 'Fecha de alta en el sistema',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-10-21T18:00:00.000Z',
    description: 'Fecha de última actualización',
  })
  updatedAt!: Date;
}

export class RegisterResponseDto {
  @ApiProperty({
    example:
      'Registro exitoso. Su cuenta se encuentra PENDIENTE de validación por parte de la Biblioteca FAUD-UNSJ.',
    description: 'Mensaje informativo sobre el estado inicial de la cuenta',
  })
  message!: string;

  @ApiProperty({
    type: UserProfileResponseDto,
    description: 'Datos del usuario recién registrado',
  })
  usuario!: UserProfileResponseDto;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token JWT de sesión para autenticar peticiones (Bearer)',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'Bearer',
    description: 'Esquema de autenticación HTTP',
  })
  tokenType!: string;

  @ApiProperty({
    example: '8h',
    description: 'Tiempo de vigencia configurado para la sesión',
  })
  expiresIn!: string;

  @ApiProperty({
    type: UserProfileResponseDto,
    description: 'Perfil del usuario autenticado',
  })
  usuario!: UserProfileResponseDto;
}
